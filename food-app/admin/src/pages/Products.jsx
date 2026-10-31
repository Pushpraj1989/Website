import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import { illustrationSrc } from '../art.js';
import { formatMoney, parseMoney } from '../money.js';
import Gallery from '../components/Gallery.jsx';

const DIGITS = 2; // AED
const CODE = 'AED';

/** The stock line for a product in the list: how many are left, per variant or in total. */
function stockSummary(p) {
  const active = (p.variants ?? []).filter((v) => v.active);
  if (active.length) {
    const counted = active.filter((v) => v.stock !== null);
    const out = counted.filter((v) => v.stock === 0).length;
    if (!counted.length) return `${active.length} options · not counted`;
    const total = counted.reduce((n, v) => n + v.stock, 0);
    return `${active.length} options · ${total} in stock${out ? ` · ${out} sold out` : ''}`;
  }
  if (p.stock === null || p.stock === undefined) return 'Not counted';
  return p.stock === 0 ? 'Sold out' : `${p.stock} in stock`;
}

/** A product's price in the list: "from" the lowest active variant when it has variants. */
function priceLabel(p) {
  const active = (p.variants ?? []).filter((v) => v.active);
  if (!active.length) return formatMoney(p.priceMinor, DIGITS, CODE);
  return `from ${formatMoney(Math.min(...active.map((v) => v.priceMinor)), DIGITS, CODE)}`;
}

export default function Products({ catalog, onChanged, shop = false }) {
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
              {shop ? <th scope="col">Stock</th> : null}
              <th scope="col">{shop ? 'In the shop' : 'On the menu'}</th>
              <th scope="col"><span className="sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {catalog.products.length === 0 ? (
              <tr><td colSpan={shop ? 7 : 6} className="muted">No products yet. Add the first one.</td></tr>
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
                <td className="num">{priceLabel(p)}</td>
                {shop ? <td className={/Sold out/.test(stockSummary(p)) ? 'error' : undefined}>{stockSummary(p)}</td> : null}
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
          shop={shop}
          product={editing === 'new' ? null : catalog.products.find((p) => p.id === editing.id) ?? editing}
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

function ProductEditor({ product, catalog, onChanged, onClose, onSaved, shop }) {
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
    if (shop && f.has('stock')) {
      const raw = String(f.get('stock') ?? '').trim();
      if (raw !== '' && !/^\d+$/.test(raw)) {
        setError('Enter the stock as a whole number, or leave it empty to not count it.');
        return;
      }
      body.stock = raw === '' ? null : Number(raw);
    }
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
        <div className="row between sheet-head">
          <h2 id="editor-title">{product ? 'Edit product' : 'New product'}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close"><X className="icon" aria-hidden="true" /></button>
        </div>

        <div className="form-grid">
          <label>Name (English)<input name="nameEn" required maxLength={80} defaultValue={product?.name.en ?? ''} /></label>
          <label>Name (Arabic)<input name="nameAr" required maxLength={80} dir="rtl" defaultValue={product?.name.ar ?? ''} /></label>
          <label>Category
            <select name="categoryId" defaultValue={product?.categoryId ?? categories[0]?.id} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name.en}</option>)}
            </select>
          </label>
          <label>Price, AED<input name="price" inputMode="decimal" required defaultValue={product ? (product.priceMinor / 100).toFixed(2) : ''} placeholder="45.00" /></label>
          <label>{shop ? 'Place in the shop' : 'Place on the menu'}<input name="sortOrder" type="number" min="0" max="999" defaultValue={product?.sortOrder ?? 0} /></label>
          {shop && !(product?.variants ?? []).some((v) => v.active) ? (
            <label>Stock left <span className="hint">empty = not counted</span>
              <input name="stock" inputMode="numeric" pattern="\d*" defaultValue={product?.stock ?? ''} placeholder="Not counted" />
            </label>
          ) : null}
          <label className="choice"><input name="available" type="checkbox" defaultChecked={product ? product.available : true} /> Shown to customers</label>
          <label>Description (English)<textarea name="descriptionEn" maxLength={300} rows={3} defaultValue={product?.description.en ?? ''} /></label>
          <label>Description (Arabic)<textarea name="descriptionAr" maxLength={300} rows={3} dir="rtl" defaultValue={product?.description.ar ?? ''} /></label>
        </div>

        {shop && product ? <Variants product={product} onSaved={onSaved} /> : null}
        {shop && !product ? <p className="hint">Save the product first, then add its sizes, colours or other options.</p> : null}

        {product ? (
          <details className="disclose">
            <summary>Pictures and videos</summary>
            <div className="body"><Gallery productId={product.id} productName={product.name.en} onChanged={onChanged} /></div>
          </details>
        ) : (
          <p className="hint">Save the product first, then add its pictures and videos.</p>
        )}

        {error ? <p role="alert" className="error">{error}</p> : null}
        <div className="actions submit">
          <button type="submit" className="btn primary" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : 'Save'}</button>
          {product ? <button type="button" className="btn danger" onClick={remove}>Delete</button> : null}
        </div>
      </form>
    </div>
  );
}

const blankVariant = () => ({ key: Math.random().toString(36).slice(2), id: null, nameEn: '', nameAr: '', sku: '', price: '', stock: '', active: true });

/**
 * A product's options (sizes, colours, shades, flavours): each with its own price and stock. Edited as a table and
 * saved together. With options, customers choose one before adding to the cart, and the product shows "from" the
 * lowest price.
 */
function Variants({ product, onSaved }) {
  const [rows, setRows] = useState(() => (product.variants ?? []).map((v) => ({
    key: v.id, id: v.id, nameEn: v.name.en, nameAr: v.name.ar, sku: v.sku,
    price: (v.priceMinor / 100).toFixed(2), stock: v.stock === null ? '' : String(v.stock), active: v.active,
  })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (key, field, value) => setRows((list) => list.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const move = (index, by) => setRows((list) => {
    const next = [...list];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    return next;
  });

  async function save() {
    setError('');
    const variants = [];
    for (const [i, r] of rows.entries()) {
      const price = parseMoney(r.price, DIGITS);
      if (!r.nameEn.trim() || !r.nameAr.trim()) return setError(`Option ${i + 1}: give it a name in English and Arabic.`);
      if (price === null) return setError(`Option ${i + 1}: enter the price like 45.00.`);
      if (r.stock !== '' && !/^\d+$/.test(String(r.stock).trim())) return setError(`Option ${i + 1}: enter the stock as a whole number, or leave it empty.`);
      variants.push({ id: r.id, name: { en: r.nameEn.trim(), ar: r.nameAr.trim() }, sku: r.sku.trim(), priceMinor: price, stock: r.stock === '' ? null : Number(r.stock), active: r.active });
    }
    setBusy(true);
    try {
      const { variants: saved } = await api.saveVariants(product.id, variants);
      setRows(saved.map((v) => ({ key: v.id, id: v.id, nameEn: v.name.en, nameAr: v.name.ar, sku: v.sku, price: (v.priceMinor / 100).toFixed(2), stock: v.stock === null ? '' : String(v.stock), active: v.active })));
      await onSaved(saved.length ? `Options saved: ${saved.filter((v) => v.active).length} on sale.` : 'Options removed. The product sells at its own price.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="variants stack">
      <legend><h3>Options</h3></legend>
      <p className="hint">Sizes, colours, shades or flavours, each with its own price and stock. Leave stock empty to not count it. Without options, the product sells at its own price.</p>
      {rows.length ? (
        <ol className="variant-list">
          {rows.map((r, i) => (
            <li key={r.key} className="variant-card">
              <div className="variant-head">
                <strong>Option {i + 1}</strong>
                <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                  <button type="button" className="btn ghost sm" aria-label={`Move option ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="icon" aria-hidden="true" /></button>
                  <button type="button" className="btn ghost sm" aria-label={`Move option ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="icon" aria-hidden="true" /></button>
                  <button type="button" className="btn ghost sm" aria-label={`Remove option ${i + 1}`} onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}><Trash2 className="icon" aria-hidden="true" /></button>
                </span>
              </div>
              <div className="variant-grid">
                <label>Name (English)<input aria-label={`Option ${i + 1} name in English`} value={r.nameEn} maxLength={60} placeholder="M / Black" onChange={(e) => change(r.key, 'nameEn', e.target.value)} /></label>
                <label>Name (Arabic)<input aria-label={`Option ${i + 1} name in Arabic`} value={r.nameAr} maxLength={60} dir="rtl" onChange={(e) => change(r.key, 'nameAr', e.target.value)} /></label>
                <label>SKU <span className="hint">optional</span><input aria-label={`Option ${i + 1} SKU`} value={r.sku} maxLength={40} onChange={(e) => change(r.key, 'sku', e.target.value)} /></label>
                <label>Price, {CODE}<input aria-label={`Option ${i + 1} price`} value={r.price} inputMode="decimal" placeholder="45.00" onChange={(e) => change(r.key, 'price', e.target.value)} /></label>
                <label>Stock <span className="hint">empty = not counted</span><input aria-label={`Option ${i + 1} stock`} value={r.stock} inputMode="numeric" placeholder="Not counted" onChange={(e) => change(r.key, 'stock', e.target.value)} /></label>
                <label className="choice"><input type="checkbox" aria-label={`Option ${i + 1} on sale`} checked={r.active} onChange={(e) => change(r.key, 'active', e.target.checked)} /> On sale</label>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      <div className="actions">
        <button type="button" className="btn secondary" onClick={() => setRows((list) => [...list, blankVariant()])}><Plus className="icon" aria-hidden="true" /> Add option</button>
        <button type="button" className="btn primary" disabled={busy} aria-busy={busy} onClick={save}>{busy ? 'Saving…' : 'Save options'}</button>
      </div>
    </fieldset>
  );
}
