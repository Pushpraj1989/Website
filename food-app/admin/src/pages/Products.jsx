import React, { useState } from 'react';
import { api } from '../api.js';
import { illustrationSrc } from '../art.js';
import { formatMoney, parseMoney } from '../money.js';
import Gallery from '../components/Gallery.jsx';

const DIGITS = 2; // AED
const CODE = 'AED';

export default function Products({ catalog, onChanged }) {
  const [editing, setEditing] = useState(null); // null, 'new', or a product
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const categoryName = (id) => catalog.categories.find((c) => c.id === id)?.name.en ?? '—';

  async function toggleAvailable(product) {
    setError('');
    try {
      await api.updateProduct(product.id, { available: !product.available });
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="stack">
      <div className="row between">
        <h1>Products</h1>
        <button type="button" className="btn primary" onClick={() => { setEditing('new'); setMessage(''); setError(''); }}>Add product</button>
      </div>
      <p className="muted">Changes show in the customer app the next time the menu is opened.</p>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}

      <div className={editing ? 'split' : undefined}>
      <div className="card table-wrap" tabIndex={0} role="region" aria-label="Products">
        <table>
          <thead>
            <tr>
              <th scope="col">Picture</th>
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">On the menu</th>
              <th scope="col"><span className="sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {catalog.products.length === 0 ? (
              <tr><td colSpan={6} className="muted">No products yet. Add the first one.</td></tr>
            ) : null}
            {catalog.products.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.imageUrl
                    ? <img className="thumb" src={p.imageUrl} alt={`Picture of ${p.name.en}`} />
                    // No photo yet: the category's illustration stands in, so the list never looks blank.
                    : <img className="thumb" src={illustrationSrc(catalog.categories.find((c) => c.id === p.categoryId)?.illustration)} alt="" title="No photo yet. The category picture is shown." />}
                </td>
                <td>
                  <strong>{p.name.en}</strong>
                  <div dir="rtl" className="muted">{p.name.ar}</div>
                </td>
                <td>{categoryName(p.categoryId)}</td>
                <td className="num">{formatMoney(p.priceMinor, DIGITS, CODE)}</td>
                <td>
                  <button type="button" className={p.available ? 'pill on' : 'pill off'} aria-pressed={p.available} onClick={() => toggleAvailable(p)}>
                    {p.available ? 'Shown' : 'Hidden'}
                  </button>
                </td>
                <td><button type="button" className="btn secondary sm" onClick={() => setEditing(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <ProductEditor
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          catalog={catalog}
          onChanged={onChanged}
          onClose={() => setEditing(null)}
          onSaved={async (text) => {
            setMessage(text);
            await onChanged();
          }}
        />
      ) : null}
      </div>
    </section>
  );
}

function ProductEditor({ product, catalog, onChanged, onClose, onSaved }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState(product?.id ?? null);
  const categories = catalog.categories;

  async function save(event) {
    event.preventDefault();
    setError('');
    const f = new FormData(event.currentTarget);
    const price = parseMoney(f.get('price'), DIGITS);
    if (price === null) {
      setError('Enter the price in AED with up to two decimals, like 45.00.');
      return;
    }
    const body = {
      categoryId: f.get('categoryId'),
      nameEn: f.get('nameEn'),
      nameAr: f.get('nameAr'),
      descriptionEn: f.get('descriptionEn'),
      descriptionAr: f.get('descriptionAr'),
      priceMinor: price,
      available: f.get('available') === 'on',
      sortOrder: Number(f.get('sortOrder') || 0),
    };
    setBusy(true);
    try {
      let productId = id;
      if (productId) {
        await api.updateProduct(productId, body);
      } else {
        const created = await api.createProduct(body);
        productId = created.product.id;
        setId(productId);
      }
      await onSaved(product ? 'Product saved.' : 'Product added.');
      if (!product) onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${product.name.en}?`)) return;
    try {
      const result = await api.deleteProduct(id);
      await onSaved(result.result === 'hidden' ? 'Hidden, because customers have ordered it before. Order history keeps it.' : 'Product deleted.');
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="editor-title">
      <form className="card stack" onSubmit={save} key={id ?? 'new'}>
        <div className="row between">
          <h2 id="editor-title">{product ? 'Edit product' : 'New product'}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
        </div>

        {product ? (
          <Gallery productId={product.id} productName={product.name.en} onChanged={onChanged} />
        ) : (
          <p className="muted">Save the product first, then add its pictures and videos.</p>
        )}

        <label>Category
          <select name="categoryId" defaultValue={product?.categoryId ?? categories[0]?.id} required>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name.en}</option>)}
          </select>
        </label>
        <div className="grid-form">
          <label>Name (English)<input name="nameEn" required maxLength={80} defaultValue={product?.name.en ?? ''} /></label>
          <label>Name (Arabic)<input name="nameAr" required maxLength={80} dir="rtl" defaultValue={product?.name.ar ?? ''} /></label>
        </div>
        <div className="grid-form">
          <label>Description (English)<textarea name="descriptionEn" maxLength={300} defaultValue={product?.description.en ?? ''} /></label>
          <label>Description (Arabic)<textarea name="descriptionAr" maxLength={300} dir="rtl" defaultValue={product?.description.ar ?? ''} /></label>
        </div>
        <div className="grid-form">
          <label>Price (AED)<input name="price" inputMode="decimal" required defaultValue={product ? (product.priceMinor / 100).toFixed(2) : ''} placeholder="45.00" /></label>
          <label>Order on the menu<input name="sortOrder" type="number" min="0" max="999" defaultValue={product?.sortOrder ?? 0} /></label>
        </div>
        <label className="choice"><input name="available" type="checkbox" defaultChecked={product ? product.available : true} /> Shown to customers</label>

        {error ? <p role="alert" className="error">{error}</p> : null}
        <div className="row">
          <button type="submit" className="btn primary" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : 'Save'}</button>
          {product ? <button type="button" className="btn danger" onClick={remove}>Delete</button> : null}
        </div>
      </form>
    </div>
  );
}
