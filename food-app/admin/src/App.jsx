import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChartColumn, ClipboardList, Bot, Handshake, LayoutGrid, LogOut, Map as MapIcon, Megaphone, Menu, Palette, Percent, Tags, UtensilsCrossed, X } from 'lucide-react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Products from './pages/Products.jsx';
import Categories from './pages/Categories.jsx';
import Offers from './pages/Offers.jsx';
import Campaigns from './pages/Campaigns.jsx';
import Templates from './pages/Templates.jsx';
import Partners from './pages/Partners.jsx';
import Reports from './pages/Reports.jsx';
import Promotions from './pages/Promotions.jsx';
import Zones from './pages/Zones.jsx';
import Orders from './pages/Orders.jsx';
import AiSettings from './pages/AiSettings.jsx';

const SECTIONS = [
  { id: 'orders', label: 'Orders', short: 'Orders', Icon: ClipboardList },
  { id: 'products', label: 'Products', short: 'Menu', Icon: UtensilsCrossed },
  { id: 'categories', label: 'Categories', Icon: LayoutGrid },
  { id: 'offers', label: 'Offers', Icon: Percent },
  { id: 'campaigns', label: 'Campaigns', short: 'Campaigns', Icon: Megaphone },
  { id: 'designs', label: 'Voucher designs', Icon: Palette },
  { id: 'partners', label: 'Partners', Icon: Handshake },
  { id: 'reports', label: 'Promotion reports', short: 'Reports', Icon: ChartColumn },
  { id: 'promotions', label: 'Promotions', Icon: Tags },
  { id: 'zones', label: 'Delivery areas', Icon: MapIcon },
  { id: 'assistant', label: 'Assistant', Icon: Bot },
];
// The phone's tab bar holds the four sections staff open most; the rest are under More.
const TABS = ['orders', 'products', 'campaigns', 'reports'];

// On a phone, tables are shown as cards. Each cell is given its column's name so the card can label it, and the
// table roles are set explicitly, because changing a table's display drops its semantics in some browsers.
function useCardTables(ref, active) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const label = () => {
      for (const table of root.querySelectorAll('table')) {
        const heads = [...table.querySelectorAll('thead th')].map((th) => (th.querySelector('.sr, .sr-only') ? '' : th.textContent.trim()));
        table.setAttribute('role', 'table');
        for (const row of table.querySelectorAll('tr')) {
          row.setAttribute('role', 'row');
          [...row.children].forEach((cell, i) => {
            if (cell.tagName === 'TH') { cell.setAttribute('role', 'columnheader'); return; }
            cell.setAttribute('role', 'cell');
            if (cell.getAttribute('data-label') !== (heads[i] ?? '')) cell.setAttribute('data-label', heads[i] ?? '');
          });
        }
      }
    };
    label();
    const watcher = new MutationObserver(label);
    watcher.observe(root, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, [ref, active]);
}

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
  const mainRef = useRef(null);
  const moreRef = useRef(null);
  useCardTables(mainRef, signedIn);

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
    const onHash = () => {
      setSection(currentSection());
      moreRef.current?.close();
      window.scrollTo(0, 0);
    };
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

  const navLinks = (
    <nav aria-label="Sections">
      {SECTIONS.map(({ id, label, Icon }) => (
        <a key={id} href={`#/${id}`} className={section === id ? 'nav active' : 'nav'} aria-current={section === id ? 'page' : undefined}>
          <Icon className="icon" aria-hidden="true" />{label}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Sample Kitchen</div>
        {navLinks}
        <button type="button" className="btn ghost block" onClick={signOut}>Sign out</button>
      </aside>
      <header className="appbar">
        <span className="title">Sample Kitchen</span>
        <button type="button" className="btn ghost sm" onClick={signOut} aria-label="Sign out"><LogOut className="icon" aria-hidden="true" /></button>
      </header>
      <nav className="tabbar" aria-label="Main sections">
        {TABS.map((id) => {
          const { short, Icon } = SECTIONS.find((s) => s.id === id);
          return (
            <a key={id} href={`#/${id}`} className={section === id ? 'tab active' : 'tab'} aria-current={section === id ? 'page' : undefined}>
              <Icon className="icon" aria-hidden="true" />{short}
            </a>
          );
        })}
        <button type="button" className={TABS.includes(section) ? 'tab' : 'tab active'} aria-haspopup="dialog" onClick={() => moreRef.current?.showModal()}>
          <Menu className="icon" aria-hidden="true" />More
        </button>
      </nav>
      <dialog ref={moreRef} className="more" aria-label="All sections" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="grab" aria-hidden="true" />
        <div className="row between" style={{ padding: '0 8px 8px' }}>
          <strong>All sections</strong>
          <button type="button" className="btn ghost sm" onClick={() => moreRef.current?.close()} aria-label="Close"><X className="icon" aria-hidden="true" /></button>
        </div>
        {navLinks}
      </dialog>
      <main className="main" ref={mainRef}>
        {loadError ? <p role="alert" className="error">{loadError}</p> : null}
        {!catalog ? <p className="muted">Loading…</p> : null}
        {catalog && section === 'products' ? <Products catalog={catalog} onChanged={reload} /> : null}
        {catalog && section === 'categories' ? <Categories catalog={catalog} onChanged={reload} /> : null}
        {catalog && section === 'offers' ? <Offers catalog={catalog} onChanged={reload} /> : null}
        {catalog && section === 'campaigns' ? <Campaigns /> : null}
        {catalog && section === 'designs' ? <Templates /> : null}
        {catalog && section === 'partners' ? <Partners /> : null}
        {catalog && section === 'reports' ? <Reports /> : null}
        {catalog && section === 'promotions' ? <Promotions catalog={catalog} /> : null}
        {section === 'zones' ? <Zones /> : null}
        {section === 'orders' ? <Orders /> : null}
        {catalog && section === 'assistant' ? <AiSettings /> : null}
      </main>
    </div>
  );
}
