import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatMoney, parseMoney } from '../money.js';

const DIGITS = 2;
const CODE = 'AED';

// Delivery areas: a name in each language, the fee and the smallest order, and the outline on the map.
// The outline is entered as one corner per line: longitude, then latitude (copy them from the map's pin).
export default function Zones() {
  const [zones, setZones] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      setZones((await api.zones()).zones);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setEditing({ id: null, nameEn: '', nameAr: '', fee: '', minOrder: '', active: true, outline: '' });
  }

  function startEdit(zone) {
    setEditing({
      id: zone.id,
      nameEn: zone.nameEn,
      nameAr: zone.nameAr,
      fee: formatMoney(zone.feeMinor, DIGITS, '').trim(),
      minOrder: formatMoney(zone.minOrderMinor, DIGITS, '').trim(),
      active: zone.active,
      outline: zone.polygon.map(([lng, lat]) => `${lng}, ${lat}`).join('\n'),
    });
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    const feeMinor = parseMoney(editing.fee, DIGITS);
    const minOrderMinor = parseMoney(editing.minOrder, DIGITS);
    if (feeMinor === null || minOrderMinor === null) {
      setError('Enter the fee and the minimum order as amounts, for example 10.00.');
      return;
    }
    const polygon = editing.outline
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(',').map((part) => Number(part.trim())));
    const body = { nameEn: editing.nameEn, nameAr: editing.nameAr, feeMinor, minOrderMinor, active: editing.active, polygon };
    try {
      if (editing.id) await api.updateZone(editing.id, body);
      else await api.createZone(body);
      setMessage('Saved. Customers see the change on their next checkout.');
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!zones) return <p>{error || 'Loading delivery areas…'}</p>;

  return (
    <section>
      <header className="toolbar">
        <h2>Delivery areas</h2>
        <button type="button" onClick={startNew}>Add an area</button>
      </header>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}

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

      {editing ? (
        <form className="card" onSubmit={save}>
          <h3>{editing.id ? 'Edit area' : 'New area'}</h3>
          <label>Name in English <input required maxLength={80} value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} /></label>
          <label>Name in Arabic <input required maxLength={80} dir="rtl" value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} /></label>
          <label>Delivery fee ({CODE}) <input required inputMode="decimal" value={editing.fee} onChange={(e) => setEditing({ ...editing, fee: e.target.value })} /></label>
          <label>Minimum order ({CODE}) <input required inputMode="decimal" value={editing.minOrder} onChange={(e) => setEditing({ ...editing, minOrder: e.target.value })} /></label>
          <label className="choice"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Taking orders for this area</label>
          <label>Outline, one corner per line (longitude, latitude), at least three
            <textarea required rows={6} value={editing.outline} onChange={(e) => setEditing({ ...editing, outline: e.target.value })} />
          </label>
          <div className="actions">
            <button type="submit">Save area</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
