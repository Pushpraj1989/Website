import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const IMAGE_MAX = 3 * 1024 * 1024;
const VIDEO_MAX = 60 * 1024 * 1024;

// Many pictures and videos for one product. The first in the list is the cover, and the admin can reorder them.
// Checks here are for a quick answer; the server checks the file's real signature and size again.
export default function Gallery({ productId, productName, onChanged }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function load() {
    try {
      setItems((await api.gallery(productId)).media);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [productId]);

  async function upload(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setError('');
    setNote('');
    for (const file of files) {
      const isVideo = VIDEO_TYPES.includes(file.type);
      const isImage = IMAGE_TYPES.includes(file.type);
      if (!isVideo && !isImage) {
        setError(`${file.name}: choose a JPEG, PNG or WebP picture, or an MP4, MOV or WebM video.`);
        continue;
      }
      if (isImage && file.size > IMAGE_MAX) { setError(`${file.name} is larger than 3 MB.`); continue; }
      if (isVideo && file.size > VIDEO_MAX) { setError(`${file.name} is larger than 60 MB. Use a shorter or smaller video.`); continue; }
      setBusy(true);
      try {
        await api.uploadMedia(productId, file, productName, productName);
        setNote(`Added ${file.name}.`);
      } catch (err) {
        setError(`${file.name}: ${err.message}`);
      } finally {
        setBusy(false);
      }
    }
    await load();
    await onChanged?.();
  }

  async function move(index, delta) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await run(() => api.arrangeMedia(productId, next.map((m) => m.id), items.find((m) => m.primary).id), 'Order saved.');
  }

  async function setCover(id) {
    await run(() => api.arrangeMedia(productId, items.map((m) => m.id), id), 'Cover set.');
  }

  async function remove(id) {
    if (!window.confirm('Remove this from the product? The file is deleted if nothing else uses it.')) return;
    await run(() => api.removeMedia(productId, id), 'Removed.');
  }

  async function run(action, ok) {
    setError('');
    setNote('');
    try {
      await action();
      setNote(ok);
      await load();
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <fieldset className="stack gallery">
      <legend>Pictures and videos</legend>
      <p className="muted">The first item is the cover. Videos can play on the home screen, or behind the product page.</p>
      <label className="btn secondary file" aria-disabled={busy}>
        {busy ? 'Uploading…' : 'Add pictures or videos'}
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={upload} disabled={busy} />
      </label>
      {note ? <p role="status" className="ok">{note}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      {items === null ? <p className="muted">Loading…</p> : null}
      {items && items.length === 0 ? <p className="muted">No pictures or videos yet.</p> : null}
      <ul className="gallery-list">
        {(items ?? []).map((m, i) => (
          <li key={m.id} className={m.primary ? 'gallery-item cover' : 'gallery-item'}>
            {m.kind === 'video'
              ? <video className="gallery-thumb" src={m.url} muted preload="metadata" aria-label={`Video ${i + 1} of ${productName}`} />
              : <img className="gallery-thumb" src={m.url} alt={`Picture ${i + 1} of ${productName}`} />}
            <div className="stack gallery-meta">
              <span>{m.kind === 'video' ? 'Video' : 'Picture'} {i + 1}{m.primary ? ' · cover' : ''}</span>
              <div className="row">
                <button type="button" className="btn ghost sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${i + 1} up`}>Up</button>
                <button type="button" className="btn ghost sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${i + 1} down`}>Down</button>
                {!m.primary ? <button type="button" className="btn ghost sm" onClick={() => setCover(m.id)}>Make cover</button> : null}
                <button type="button" className="btn danger sm" onClick={() => remove(m.id)}>Remove</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
