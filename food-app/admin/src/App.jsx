import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChartColumn, Gauge, Moon, Paintbrush, Store, Sun, ClipboardList, Bot, Handshake, LayoutGrid, LogOut, Map as MapIcon, Megaphone, Menu, Palette, Percent, Tags, UtensilsCrossed, X } from 'lucide-react';
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
import Dashboard from './pages/Dashboard.jsx';
import Appearance from './pages/Appearance.jsx';
import { changeAppearance, loadAppearance, setBrandColour } from './appearance.js';
import AiSettings from './pages/AiSettings.jsx';
import Settings from './pages/Settings.jsx';

// The side menu, in groups: what is happening, what is sold, how it is promoted, and how the restaurant is set up.
const SECTIONS = [
  { id: 'dashboard', group: 'Overview', label: 'Dashboard', short: 'Dashboard', Icon: Gauge },
  { id: 'orders', group: 'Overview', label: 'Live orders', short: 'Orders', Icon: ClipboardList },
  { id: 'products', group: 'Menu', label: 'Dishes', short: 'Menu', Icon: UtensilsCrossed },
  { id: 'categories', group: 'Menu', label: 'Categories', Icon: LayoutGrid },
  { id: 'promotions', group: 'Marketing', label: 'Home and pop-ups', Icon: Tags },
  { id: 'offers', group: 'Marketing', label: 'Offers and codes', Icon: Percent },
  { id: 'campaigns', group: 'Marketing', label: 'Voucher campaigns', Icon: Megaphone },
  { id: 'designs', group: 'Marketing', label: 'Voucher designs', Icon: Palette },
  { id: 'reports', group: 'Marketing', label: 'Promotion reports', Icon: ChartColumn },
  { id: 'restaurant', group: 'Settings', label: 'Restaurant and look', Icon: Store },
  { id: 'zones', group: 'Settings', label: 'Delivery areas', Icon: MapIcon },
  { id: 'assistant', group: 'Settings', label: 'Assistant', Icon: Bot },
  { id: 'partners', group: 'Settings', label: 'Partners', Icon: Handshake },
  { id: 'appearance', group: 'Settings', label: 'Appearance', Icon: Paintbrush },
];

// A shop sees shop words: Products instead of Dishes, Shop instead of Menu, Business instead of Restaurant.
const SHOP_WORDS = { products: { label: 'Products', short: 'Shop' }, restaurant: { label: 'Business and look' } };
const sectionsFor = (shop) => SECTIONS.map((s) => ({
  ...s,
  ...(shop ? SHOP_WORDS[s.id] ?? {} : {}),
  group: shop && s.group === 'Menu' ? 'Shop' : s.group,
}));

// The quick light/dark switch beside the menu. The full set of choices is under Settings, Appearance.
function ThemeToggle({ className }) {
  const [, redraw] = useState(0);
  const dark = document.documentElement.dataset.mode === 'dark';
  return (
    <button
      type="button" className={className} aria-label={dark ? 'Switch to light' : 'Switch to dark'} title={dark ? 'Light' : 'Dark'}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        changeAppearance({ ...loadAppearance(), mode: dark ? 'light' : 'dark' }, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
        setTimeout(() => redraw((n) => n + 1), 30);
      }}
    >
      {dark ? <Sun className="icon" aria-hidden="true" /> : <Moon className="icon" aria-hidden="true" />}
    </button>
  );
}
// The phone's tab bar holds the four sections staff open most; the rest are under More.
const TABS = ['dashboard', 'orders', 'products'];

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
  return SECTIONS.some((s) => s.id === id) ? id : 'dashboard';
}

export default function App() {
  const [signedIn, setSignedIn] = useState(null);
  const [section, setSection] = useState(currentSection());
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [brand, setBrand] = useState(null);
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

  // The restaurant's own name, logo and colour, from its settings. The console takes the colour as its accent.
  const loadBrand = useCallback(async () => {
    try {
      const { brand: b } = await api.brand();
      setBrand(b);
      document.title = `${b.name.en} · Admin`;
      document.documentElement.style.setProperty('--brand', b.color);
      setBrandColour(b.color);
    } catch {
      // The console still works with its own default look.
    }
  }, []);

  useEffect(() => {
    loadBrand();
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
  if (!signedIn) return <Login brand={brand} onSignedIn={reload} />;
  const shop = brand?.businessType === 'shop';
  const sections = sectionsFor(shop);

  async function signOut() {
    // Ending the staff session is done by letting the cookie expire; the console shows the sign-in page again.
    document.cookie = 'staff=; Max-Age=0; path=/';
    setSignedIn(false);
  }

  const navLinks = (
    <nav aria-label="Sections">
      {sections.map(({ id, group, label, Icon }, i) => (
        <React.Fragment key={id}>
          {group !== sections[i - 1]?.group ? <span className="nav-group">{group}</span> : null}
          <a href={`#/${id}`} className={section === id ? 'nav active' : 'nav'} aria-current={section === id ? 'page' : undefined}>
            <Icon className="icon" aria-hidden="true" />{label}
          </a>
        </React.Fragment>
      ))}
    </nav>
  );

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">{brand?.logoUrl ? <img className="brand-logo" src={brand.logoUrl} alt="" /> : null}<span>{brand?.name.en ?? ''}</span></div>
        {navLinks}
        <div className="side-foot">
          <button type="button" className="btn ghost" onClick={signOut}><LogOut className="icon" aria-hidden="true" />Sign out</button>
          <ThemeToggle className="btn icon-btn" />
        </div>
      </aside>
      <header className="appbar">
        <span className="title brand">{brand?.logoUrl ? <img className="brand-logo" src={brand.logoUrl} alt="" /> : null}<span>{brand?.name.en ?? ''}</span></span>
        <div className="row" style={{ gap: 4 }}>
          <ThemeToggle className="btn ghost sm" />
          <button type="button" className="btn ghost sm" onClick={signOut} aria-label="Sign out"><LogOut className="icon" aria-hidden="true" /></button>
        </div>
      </header>
      <nav className="tabbar" aria-label="Main sections">
        {TABS.map((id) => {
          const { short, Icon } = sections.find((s) => s.id === id);
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
        {section === 'dashboard' ? <Dashboard /> : null}
        {catalog && section === 'products' ? <Products catalog={catalog} onChanged={reload} shop={shop} /> : null}
        {catalog && section === 'categories' ? <Categories catalog={catalog} onChanged={reload} /> : null}
        {catalog && section === 'offers' ? <Offers catalog={catalog} onChanged={reload} /> : null}
        {catalog && section === 'campaigns' ? <Campaigns /> : null}
        {catalog && section === 'designs' ? <Templates restaurantName={brand?.name.en} /> : null}
        {catalog && section === 'partners' ? <Partners /> : null}
        {catalog && section === 'reports' ? <Reports /> : null}
        {catalog && section === 'promotions' ? <Promotions catalog={catalog} /> : null}
        {section === 'zones' ? <Zones /> : null}
        {section === 'orders' ? <Orders /> : null}
        {catalog && section === 'assistant' ? <AiSettings /> : null}
        {section === 'restaurant' ? <Settings onBrandChanged={loadBrand} /> : null}
        {section === 'appearance' ? <Appearance /> : null}
      </main>
    </div>
  );
}
