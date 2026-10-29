import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Placeholders a field can show. The server accepts only these, and fills them when a voucher is printed.
const PLACEHOLDERS = [
  ['voucher.code', 'Voucher code'],
  ['voucher.qr', 'QR code'],
  ['voucher.discount', 'Discount'],
  ['voucher.expiry_date', 'Expiry date'],
  ['campaign.name', 'Campaign name'],
  ['restaurant.name', 'Restaurant name'],
  ['customer.name', 'Customer name'],
  ['voucher.terms', 'Terms'],
  ['voucher.serial_number', 'Serial number'],
];
const MARGIN = 3;
const NUDGE = 1; // mm per arrow-key press

const STATUS = { draft: 'Draft', published: 'Published', archived: 'Archived' };

// Sample values for the editor's canvas only. The server fills real values when a voucher is printed.
const SAMPLE = {
  'voucher.code': 'SAMPLE-1234', 'voucher.discount': '30% OFF', 'voucher.expiry_date': '31 Dec 2026',
  'voucher.terms': 'Sample terms.', 'voucher.serial_number': 'SN-0001', 'campaign.name': 'Sample campaign',
  'restaurant.name': 'Sample Kitchen', 'customer.name': 'Customer name', 'voucher.qr': '',
};
const fillSample = (text) => text.replace(/\{\{([^}]*)\}\}/g, (_m, key) => SAMPLE[key] ?? '');
// One point is 0.3528 mm. Text is sized from the page's own scale, so it keeps its proportions at any width.
const PT_TO_MM = 0.3528;

export default function Templates() {
  const [templates, setTemplates] = useState(null);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setTemplates((await api.templates()).templates);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="stack">
      <div className="row between">
        <h1>Voucher designs</h1>
        <button type="button" className="btn primary" onClick={() => { setCreating(true); setSelected(null); setError(''); setMessage(''); }}>New design</button>
      </div>
      <p className="muted">A design places the code, a QR code and the terms on a picture. Publishing makes a numbered version; vouchers keep the version they were made with.</p>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}

      <div className={creating || selected ? 'split' : undefined}>
        <div className="card table-wrap" tabIndex={0} role="region" aria-label="Voucher designs">
          {!templates ? <p className="muted">Loading…</p> : templates.length === 0 ? <p className="muted">No designs yet.</p> : (
            <table>
              <thead><tr><th scope="col">Design</th><th scope="col">Status</th><th scope="col">Version</th><th scope="col"><span className="sr">Open</span></th></tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>{STATUS[t.status]}</td>
                    <td>{t.currentVersion ? `v${t.currentVersion}` : '—'}</td>
                    <td><button type="button" className="btn ghost" onClick={() => { setSelected(t.id); setCreating(false); setError(''); setMessage(''); }}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {creating ? <NewTemplate onSaved={(t) => { setCreating(false); setSelected(t.id); setMessage(`Created ${t.name}.`); load(); }} onCancel={() => setCreating(false)} onError={setError} /> : null}
        {selected && !creating ? <Editor key={selected} id={selected} onChanged={(text) => { setMessage(text); load(); }} onError={setError} /> : null}
      </div>
    </section>
  );
}

function NewTemplate({ onSaved, onCancel, onError }) {
  async function submit(event) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      const { template } = await api.createTemplate({ name: f.get('name'), widthMm: Number(f.get('widthMm')), heightMm: Number(f.get('heightMm')) });
      onSaved(template);
    } catch (err) {
      onError(err.message);
    }
  }
  return (
    <form className="card stack" onSubmit={submit} aria-label="New design">
      <h2>New design</h2>
      <label>Name<input name="name" required maxLength={120} /></label>
      <label>Width in millimetres<input name="widthMm" type="number" min="20" max="400" defaultValue="85" required /></label>
      <label>Height in millimetres<input name="heightMm" type="number" min="20" max="400" defaultValue="55" required /></label>
      <p className="muted">85 × 55 mm is a card. A4 is 210 × 297.</p>
      <div className="row">
        <button type="submit" className="btn primary">Create design</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Editor({ id, onChanged, onError }) {
  const [data, setData] = useState(null);
  const [layout, setLayout] = useState(null);
  const [active, setActive] = useState(null);
  const [preview, setPreview] = useState(null);
  const canvas = useRef(null);
  const drag = useRef(null);
  const [canvasPx, setCanvasPx] = useState(520);

  useLayoutEffect(() => {
    if (!canvas.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setCanvasPx(entry.contentRect.width));
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await api.template(id);
      setData(result);
      setLayout(result.template.draft);
    } catch (err) {
      onError(err.message);
    }
  }, [id, onError]);

  useEffect(() => { load(); }, [load]);

  const editable = data && data.template.status !== 'archived';

  function update(patch) {
    setLayout((l) => ({ ...l, ...patch }));
  }
  function updateField(fieldId, patch) {
    setLayout((l) => ({ ...l, fields: l.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }));
  }
  function addField(type) {
    const id2 = `${type === 'qr' ? 'qr' : 'text'}-${Date.now().toString(36)}`;
    const field = type === 'qr'
      ? { id: id2, type: 'qr', content: '{{voucher.qr}}', x: 60, y: 10, w: 20, h: 20, fontSizePt: 12, fontWeight: 400, align: 'left', color: '#1C1917' }
      : { id: id2, type: 'text', content: '{{voucher.code}}', x: 10, y: 30, w: 60, h: 8, fontSizePt: 14, fontWeight: 700, align: 'center', color: '#1C1917' };
    setLayout((l) => ({ ...l, fields: [...l.fields, field] }));
    setActive(id2);
  }
  function removeField(fieldId) {
    setLayout((l) => ({ ...l, fields: l.fields.filter((f) => f.id !== fieldId) }));
    setActive(null);
  }

  async function save() {
    try {
      const { template } = await api.saveTemplate(id, { name: data.template.name, ...layout });
      setData((d) => ({ ...d, template }));
      onChanged('Draft saved.');
    } catch (err) {
      onError(err.message);
    }
  }

  async function publish() {
    try {
      await api.saveTemplate(id, layout);
      await api.publishTemplate(id);
      await load();
      onChanged('Published a new version.');
    } catch (err) {
      onError(err.message);
    }
  }

  async function run(action, text) {
    try {
      await action();
      await load();
      onChanged(text);
    } catch (err) {
      onError(err.message);
    }
  }

  async function showPreview() {
    try {
      setPreview(await api.templatePreview(id, 'draft'));
    } catch (err) {
      onError(err.message);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { template } = await api.templateBackground(id, file);
      setData((d) => ({ ...d, template }));
      setLayout(template.draft);
      onChanged('Background added.');
    } catch (err) {
      onError(err.message);
    }
  }

  // Dragging moves a field on the page. Positions are clamped to the print margin, so no field can leave it.
  function clampMove(field, x, y) {
    const maxX = layout.widthMm - MARGIN - field.w;
    const maxY = layout.heightMm - MARGIN - field.h;
    return { x: Math.min(Math.max(x, MARGIN), maxX), y: Math.min(Math.max(y, MARGIN), maxY) };
  }
  function onPointerDown(event, field) {
    if (!editable) return;
    setActive(field.id);
    drag.current = { id: field.id, startX: event.clientX, startY: event.clientY, x0: field.x, y0: field.y, scale: canvas.current.getBoundingClientRect().width / layout.widthMm };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event) {
    const d = drag.current;
    if (!d) return;
    const field = layout.fields.find((f) => f.id === d.id);
    const next = clampMove(field, d.x0 + (event.clientX - d.startX) / d.scale, d.y0 + (event.clientY - d.startY) / d.scale);
    updateField(d.id, { x: Math.round(next.x * 10) / 10, y: Math.round(next.y * 10) / 10 });
  }
  function onKeyDown(event, field) {
    const step = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] }[event.key];
    if (!step || !editable) return;
    event.preventDefault();
    const next = clampMove(field, field.x + step[0], field.y + step[1]);
    updateField(field.id, next);
  }

  if (!layout) return <div className="card"><p className="muted">Loading…</p></div>;
  const selected = layout.fields.find((f) => f.id === active);
  // A rough check: a character is about half its size wide, and wrapped lines are about 1.15 sizes tall. If the
  // wrapped text is taller than the box, it warns; it does not block the save.
  const wouldOverflow = (f) => {
    if (f.type !== 'text') return false;
    const sizeMm = f.fontSizePt * PT_TO_MM;
    const width = fillSample(f.content).length * sizeMm * 0.5 * (f.fontWeight === 700 ? 1.1 : 1);
    const lines = Math.max(1, Math.ceil(width / f.w));
    return lines * sizeMm * 1.15 > f.h;
  };
  const pct = (mm, total) => `${(mm / total) * 100}%`;

  return (
    <div className="card stack">
      <div className="row between">
        <h2>{data.template.name}</h2>
        <span className="pill">{STATUS[data.template.status]}{data.template.currentVersion ? ` · v${data.template.currentVersion}` : ''}</span>
      </div>
      <div className="row">
        <button type="button" className="btn" disabled={!editable} onClick={save}>Save draft</button>
        <button type="button" className="btn primary" disabled={!editable} onClick={publish}>Publish</button>
        <button type="button" className="btn" onClick={showPreview}>Preview with sample values</button>
        <button type="button" className="btn ghost" onClick={() => run(() => api.duplicateTemplate(id), 'Copied the design.')}>Duplicate</button>
        {data.template.status !== 'archived' ? <button type="button" className="btn danger" onClick={() => run(() => api.archiveTemplate(id), 'Archived.')}>Archive</button> : null}
      </div>
      {data.versions.length ? <p className="muted">Published versions: {data.versions.map((v) => `v${v.version}`).join(', ')}</p> : null}

      <div className="row">
        <label>Width (mm)<input type="number" min="20" max="400" value={layout.widthMm} disabled={!editable} onChange={(e) => update({ widthMm: Number(e.target.value) })} /></label>
        <label>Height (mm)<input type="number" min="20" max="400" value={layout.heightMm} disabled={!editable} onChange={(e) => update({ heightMm: Number(e.target.value) })} /></label>
        <label>Background picture<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editable} onChange={upload} /></label>
      </div>

      <div className="row">
        <button type="button" className="btn" disabled={!editable} onClick={() => addField('text')}>Add text</button>
        <button type="button" className="btn" disabled={!editable} onClick={() => addField('qr')}>Add QR code</button>
      </div>

      <div
        ref={canvas}
        className="design-canvas"
        role="group"
        aria-label={`Design, ${layout.widthMm} by ${layout.heightMm} millimetres`}
        style={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: `${layout.widthMm} / ${layout.heightMm}`, background: 'var(--surface, #f5f5f4)', border: '1px solid var(--border, #e7e5e4)', borderRadius: 8, touchAction: 'none', overflow: 'hidden' }}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        {layout.fields.map((f) => (
          <div
            key={f.id}
            role="button"
            tabIndex={0}
            aria-label={`${f.type === 'qr' ? 'QR code' : 'Text'}: ${f.content}. Use the arrow keys to move it.`}
            aria-pressed={active === f.id}
            onPointerDown={(e) => onPointerDown(e, f)}
            onKeyDown={(e) => onKeyDown(e, f)}
            onFocus={() => setActive(f.id)}
            style={{
              position: 'absolute',
              left: pct(f.x, layout.widthMm), top: pct(f.y, layout.heightMm),
              width: pct(f.w, layout.widthMm), height: pct(f.h, layout.heightMm),
              outline: active === f.id ? '2px solid var(--accent, #b45309)' : '1px dashed #78716c',
              display: 'flex', alignItems: 'center', justifyContent: f.align === 'left' ? 'flex-start' : f.align === 'right' ? 'flex-end' : 'center',
              fontSize: `${f.fontSizePt * PT_TO_MM * (canvasPx / layout.widthMm)}px`, fontWeight: f.fontWeight, color: f.color, cursor: editable ? 'move' : 'default', overflow: 'hidden', lineHeight: 1.15, textAlign: f.align, padding: 0,
            }}
          >
            {f.type === 'qr' ? '▦ QR' : fillSample(f.content)}
          </div>
        ))}
      </div>
      <p className="muted">Drag a field, or select it and press the arrow keys. Fields stay inside a 3 mm margin.</p>

      {selected ? (
        <fieldset className="stack" disabled={!editable}>
          <legend>Field</legend>
          {selected.type === 'text' ? (
            <>
              <label>Text<input value={selected.content} maxLength={200} onChange={(e) => updateField(selected.id, { content: e.target.value })} /></label>
              <label>Insert a placeholder<select value="" onChange={(e) => e.target.value && updateField(selected.id, { content: `${selected.content}{{${e.target.value}}}` })}>
                <option value="">Choose…</option>
                {PLACEHOLDERS.filter(([k]) => k !== 'voucher.qr').map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select></label>
            </>
          ) : <p className="muted">A QR code shows the voucher's own QR code when it is printed.</p>}
          <div className="row">
            <label>Left (mm)<input type="number" step="0.5" value={selected.x} onChange={(e) => updateField(selected.id, { x: Number(e.target.value) })} /></label>
            <label>Top (mm)<input type="number" step="0.5" value={selected.y} onChange={(e) => updateField(selected.id, { y: Number(e.target.value) })} /></label>
            <label>Width (mm)<input type="number" step="0.5" value={selected.w} onChange={(e) => updateField(selected.id, { w: Number(e.target.value) })} /></label>
            <label>Height (mm)<input type="number" step="0.5" value={selected.h} onChange={(e) => updateField(selected.id, { h: Number(e.target.value) })} /></label>
          </div>
          {selected.type === 'text' ? (
            <div className="row">
              <label>Size (pt)<input type="number" min="6" max="72" value={selected.fontSizePt} onChange={(e) => updateField(selected.id, { fontSizePt: Number(e.target.value) })} /></label>
              <label>Weight<select value={selected.fontWeight} onChange={(e) => updateField(selected.id, { fontWeight: Number(e.target.value) })}><option value={400}>Regular</option><option value={700}>Bold</option></select></label>
              <label>Align<select value={selected.align} onChange={(e) => updateField(selected.id, { align: e.target.value })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
              <label>Colour<input type="color" value={selected.color} onChange={(e) => updateField(selected.id, { color: e.target.value })} /></label>
            </div>
          ) : null}
          {wouldOverflow(selected) ? <p role="status" className="muted">This text may not fit its box at this size. Make the box taller or the text smaller, or shorten it. It wraps onto more lines.</p> : null}
          <button type="button" className="btn danger" onClick={() => removeField(selected.id)}>Remove field</button>
        </fieldset>
      ) : null}

      {preview ? (
        <div className="card stack" aria-label="Preview with sample values">
          <h3>Preview (sample values)</h3>
          <ul>{preview.fields.map((f) => <li key={f.id}>{f.type === 'qr' ? 'QR code (sample)' : f.text}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
