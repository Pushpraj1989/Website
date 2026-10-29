import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Products from './pages/Products.jsx';
import Categories from './pages/Categories.jsx';
import Offers from './pages/Offers.jsx';
import Campaigns from './pages/Campaigns.jsx';
import Templates from './pages/Templates.jsx';
import Promotions from './pages/Promotions.jsx';
import Zones from './pages/Zones.jsx';
import Orders from './pages/Orders.jsx';
import AiSettings from './pages/AiSettings.jsx';

const SECTIONS = [
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'offers', label: 'Offers' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'designs', label: 'Voucher designs' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'zones', label: 'Delivery areas' },
  { id: 'assistant', label: 'Assistant' },
];

// Hash routing keeps the console working without a server rewrite.
function currentSection() {
  const id = window.location.hash.replace('#/', '');
  return SECTIONS.some((s) => s.id === id) ? id : 'products';
}

export default function App() {
  const [signedIn, setSignedIn] = useState(null);
  const [section, setSection] = useState(currentSection());
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    try {
      setCatalog(await api.catalog());
      setLoadError('');
      setSignedIn(true);
    } catch (error) {
      if (error.status === 401) setSignedIn(false);
      else setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    reload();
    const onHash = () => setSection(currentSection());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [reload]);

  if (signedIn === null) return <p className="pad muted">Loading…</p>;
  if (!signedIn) return <Login onSignedIn={reload} />;

  async function signOut() {
    // Ending the staff session is done by letting the cookie expire; the console shows the sign-in page again.
    document.cookie = 'staff=; Max-Age=0; path=/';
    setSignedIn(false);
  }

  return (
    <div className="shell">
      <aside className="side" aria-label="Sections">
        <div className="brand">Sample Kitchen</div>
        <nav>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#/${s.id}`} className={section === s.id ? 'nav active' : 'nav'} aria-current={section === s.id ? 'page' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
        <button type="button" className="btn ghost block" onClick={signOut}>Sign out</button>
      </aside>
      <main className="main">
        {loadError ? <p role="alert" className="error">{loadError}</p> : null}
        {!catalog ? <p className="muted">Loading…</p> : null}
        {catalog && section === 'products' ? <Products catalog={catalog} onChanged={reload} /> : null}
        {catalog && section === 'categories' ? <Categories catalog={catalog} onChanged={reload} /> : null}
        {catalog && section === 'offers' ? <Offers catalog={catalog} onChanged={reload} /> : null}
        {catalog && section === 'campaigns' ? <Campaigns /> : null}
        {catalog && section === 'designs' ? <Templates /> : null}
        {catalog && section === 'promotions' ? <Promotions catalog={catalog} /> : null}
        {section === 'zones' ? <Zones /> : null}
        {section === 'orders' ? <Orders /> : null}
        {catalog && section === 'assistant' ? <AiSettings /> : null}
      </main>
    </div>
  );
}
