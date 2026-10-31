import React, { useState } from 'react';
import { api } from '../api.js';
import { illustrationSrc, ILLUSTRATION_LABELS } from '../art.js';

// Categories group the menu. Each one has a picture that stands in for dishes without a photo; the choice is saved
// with the category, so the customer app and this page always show the same picture.
export default function Categories({ catalog, onChanged }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function run(action, ok) {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(ok);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function add(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    await run(
      () => api.createCategory({ nameEn: f.get('nameEn'), nameAr: f.get('nameAr'), sortOrder: Number(f.get('sortOrder') || 0), illustration: f.get('illustration') }),
      'Category added.',
    );
    form.reset();
  }

  return (
    <section className="stack">
      <header className="toolbar">
        <div>
          <h1>Categories</h1>
          <p className="muted">Categories group the menu. A hidden category is not shown to customers.</p>
        </div>
      </header>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}

      <div className="card table-wrap" tabIndex={0} role="region" aria-label="Categories">
        <table>
          <thead>
            <tr>
              <th scope="col">Picture</th>
              <th scope="col">English</th>
              <th scope="col">Arabic</th>
              <th scope="col">Order</th>
              <th scope="col">Shown</th>
            </tr>
          </thead>
          <tbody>
            {catalog.categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <img className="thumb" src={illustrationSrc(c.illustration)} alt="" />
                  <label className="sr-only" htmlFor={`pic-${c.id}`}>Picture for {c.name.en}</label>
                  <select id={`pic-${c.id}`} value={c.illustration} onChange={(e) => run(() => api.updateCategory(c.id, { illustration: e.target.value }), 'Picture saved.')}>
                    {Object.entries(ILLUSTRATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </td>
                <td>{c.name.en}</td>
                <td dir="rtl">{c.name.ar}</td>
                <td>{c.sortOrder}</td>
                <td>
                  <button type="button" className={`pill ${c.active ? 'on' : 'off'}`} aria-pressed={c.active} onClick={() => run(() => api.updateCategory(c.id, { active: !c.active }), 'Saved.')}>
                    {c.active ? 'Shown' : 'Hidden'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="card stack" onSubmit={add}>
        <h2>Add a category</h2>
        <div className="form-grid">
        <label>English name<input name="nameEn" required maxLength={60} /></label>
        <label>Arabic name<input name="nameAr" required maxLength={60} dir="rtl" /></label>
        <label>Place in the list<input name="sortOrder" type="number" min="0" max="999" defaultValue="0" /></label>
        <label>Picture
          <select name="illustration" defaultValue="dish">
            {Object.entries(ILLUSTRATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        </div>
        <div className="actions"><button className="btn primary" type="submit">Add category</button></div>
      </form>
    </section>
  );
}
