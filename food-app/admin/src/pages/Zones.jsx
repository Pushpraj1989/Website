import React, { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { api } from '../api.js';
import { formatMoney, parseMoney } from '../money.js';
import { addCorner, undoCorner, ring, outlineProblem, boundsOf, centreOf } from '../zoneGeometry.js';

const DIGITS = 2;
const CODE = 'AED';
// The picture source is configuration, not code: set VITE_MAP_STYLE_URL at build time to change provider.
const STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
const EMPTY = { type: 'FeatureCollection', features: [] };
// The map's web worker is served as a file next to the page, so the bundle does not need to build it.
setWorkerUrl(mapWorkerUrl);

function outlineFeatures(zones, editingId) {
  return {
    type: 'FeatureCollection',
    features: zones
      .filter((z) => z.id !== editingId)
      .map((z) => ({
        type: 'Feature',
        properties: { active: z.active },
        geometry: { type: 'Polygon', coordinates: [ring(z.polygon)] },
      })),
  };
}

function draftFeatures(points) {
  if (points.length === 0) return EMPTY;
  const features = [{ type: 'Feature', properties: {}, geometry: points.length >= 3 ? { type: 'Polygon', coordinates: [ring(points)] } : { type: 'LineString', coordinates: points } }];
  for (const p of points) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } });
  return { type: 'FeatureCollection', features };
}

// Delivery areas on a map. Staff click the map to place the corners of an area in order; the outline is checked
// before it can be saved. Other areas are shown for context, so a new area does not overlap one by accident.
export default function Zones() {
  const [zones, setZones] = useState(null);
  const [editing, setEditing] = useState(null);
  const [points, setPoints] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const mapEl = useRef(null);
  const map = useRef(null);
  const editingRef = useRef(false);

  async function load() {
    try {
      setZones((await api.zones()).zones);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const instance = new MapLibreMap({ container: mapEl.current, style: STYLE_URL, center: [55.3, 25.1], zoom: 8 });
    map.current = instance;
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.on('load', () => {
      instance.addSource('others', { type: 'geojson', data: EMPTY });
      instance.addSource('draft', { type: 'geojson', data: EMPTY });
      instance.addLayer({ id: 'others-fill', type: 'fill', source: 'others', paint: { 'fill-color': ['case', ['get', 'active'], '#15803d', '#78716c'], 'fill-opacity': 0.2 } });
      instance.addLayer({ id: 'others-line', type: 'line', source: 'others', paint: { 'line-color': ['case', ['get', 'active'], '#15803d', '#78716c'], 'line-width': 2 } });
      instance.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#b45309', 'fill-opacity': 0.25 } });
      instance.addLayer({ id: 'draft-line', type: 'line', source: 'draft', filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#b45309', 'line-width': 3 } });
      instance.addLayer({ id: 'draft-points', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#b45309', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
    });
    instance.on('click', (event) => {
      if (!editingRef.current) return;
      const { lng, lat } = event.lngLat;
      setPoints((current) => addCorner(current, [lng, lat]));
    });
    return () => instance.remove();
  }, []);

  // Other areas are drawn whenever the list changes, except the one being edited.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !zones) return;
    const draw = () => {
      instance.getSource('others')?.setData(outlineFeatures(zones, editing?.id ?? null));
      if (!editing) {
        const bounds = boundsOf(zones.map((z) => z.polygon));
        if (bounds) instance.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 13 });
      }
    };
    if (instance.isStyleLoaded() && instance.getSource('others')) draw();
    else instance.once('load', draw);
  }, [zones, editing]);

  // The draft outline is drawn as corners are added.
  useEffect(() => {
    map.current?.getSource('draft')?.setData(draftFeatures(points));
  }, [points]);

  function startNew() {
    editingRef.current = true;
    setEditing({ id: null, nameEn: '', nameAr: '', fee: '', minOrder: '', active: true });
    setPoints([]);
    setMessage('');
    setError('');
  }

  function startEdit(zone) {
    editingRef.current = true;
    setEditing({
      id: zone.id,
      nameEn: zone.nameEn,
      nameAr: zone.nameAr,
      fee: formatMoney(zone.feeMinor, DIGITS, '').trim(),
      minOrder: formatMoney(zone.minOrderMinor, DIGITS, '').trim(),
      active: zone.active,
    });
    setPoints(zone.polygon);
    setMessage('');
    setError('');
    const bounds = boundsOf([zone.polygon]);
    if (bounds) map.current?.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 14 });
  }

  function stopEditing() {
    editingRef.current = false;
    setEditing(null);
    setPoints([]);
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    const problem = outlineProblem(points);
    if (problem) {
      setError(problem);
      return;
    }
    const feeMinor = parseMoney(editing.fee, DIGITS);
    const minOrderMinor = parseMoney(editing.minOrder, DIGITS);
    if (feeMinor === null || minOrderMinor === null) {
      setError('Enter the fee and the minimum order as amounts, for example 10.00.');
      return;
    }
    const body = { nameEn: editing.nameEn, nameAr: editing.nameAr, feeMinor, minOrderMinor, active: editing.active, polygon: points };
    try {
      if (editing.id) await api.updateZone(editing.id, body);
      else await api.createZone(body);
      setMessage('Saved. Customers see the change on their next checkout.');
      stopEditing();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const problem = editing ? outlineProblem(points) : null;

  return (
    <section>
      <header className="toolbar">
        <h2>Delivery areas</h2>
        {!editing ? <button type="button" onClick={startNew}>Add an area</button> : null}
      </header>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}

      {!zones ? <p>{error || 'Loading delivery areas…'}</p> : null}
      <div ref={mapEl} className="zone-map" aria-label="Delivery areas map" />

      {!zones ? null : editing ? (
        <form className="card" onSubmit={save}>
          <h3>{editing.id ? 'Edit area' : 'New area'}</h3>
          <p>{points.length === 0 ? 'Click the map to place the first corner. Place the corners in order around the area.' : `${points.length} corner${points.length === 1 ? '' : 's'} placed.`}</p>
          {problem && points.length > 0 ? <p className="error">{problem}</p> : null}
          <div className="actions">
            <button type="button" onClick={() => setPoints((p) => undoCorner(p))} disabled={points.length === 0}>Undo last corner</button>
            <button type="button" onClick={() => setPoints([])} disabled={points.length === 0}>Clear outline</button>
          </div>
          <label>Name in English <input required maxLength={80} value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} /></label>
          <label>Name in Arabic <input required maxLength={80} dir="rtl" value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} /></label>
          <label>Delivery fee ({CODE}) <input required inputMode="decimal" value={editing.fee} onChange={(e) => setEditing({ ...editing, fee: e.target.value })} /></label>
          <label>Minimum order ({CODE}) <input required inputMode="decimal" value={editing.minOrder} onChange={(e) => setEditing({ ...editing, minOrder: e.target.value })} /></label>
          <label className="choice"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Taking orders for this area</label>
          <div className="actions">
            <button type="submit" disabled={problem !== null}>Save area</button>
            <button type="button" onClick={stopEditing}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          {zones.length === 0 ? <p>No delivery areas yet. Add one so customers can order to an address.</p> : (
            <table>
              <thead>
                <tr><th>Name</th><th>Fee</th><th>Minimum order</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td>{z.nameEn} · {z.nameAr}</td>
                    <td className="num">{formatMoney(z.feeMinor, DIGITS, CODE)}</td>
                    <td className="num">{formatMoney(z.minOrderMinor, DIGITS, CODE)}</td>
                    <td>{z.active ? 'Active' : 'Off'}</td>
                    <td><button type="button" onClick={() => startEdit(z)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
