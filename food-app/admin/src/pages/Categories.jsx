import React, { useState } from 'react';
import { api } from '../api.js';

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
    const f = new FormData(event.currentTarget);
    await run(() => api.createCategory({ nameEn: f.get('nameEn'), nameAr: f.get('nameAr'), sortOrder: Number(f.get('sortOrder') || 0) }), 'Category added.');
    event.currentTarget.reset();
  }

  return (
    <section className="stack">
      <h1>Categories</h1>
      <p className="muted">Categories group the menu. A hidden category is not shown to customers.</p>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      <div className="card">
        <table>
          <thead><tr><th scope="col">English</th><th scope="col">Arabic</th><th scope="col">Order</th><th scope="col">Shown</th></tr></thead>
          <tbody>
            {catalog.categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name.en}</td>
                <td dir="rtl">{c.name.ar}</td>
                <td>{c.sortOrder}</td>
                <td>
                  <button type="button" className="btn secondary sm" onClick={() => run(() => api.updateCategory(c.id, { active: !c.active }), 'Saved.')}>
                    {c.active ? 'Hide' : 'Show'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card grid-form" onSubmit={add} aria-label="Add a category">
        <h2>Add a category</h2>
        <label>English name<input name="nameEn" required maxLength={60} /></label>
        <label>Arabic name<input name="nameAr" required maxLength={60} dir="rtl" /></label>
        <label>Order<input name="sortOrder" type="number" min="0" max="999" defaultValue="0" /></label>
        <button type="submit" className="btn primary">Add category</button>
      </form>
    </section>
  );
}
