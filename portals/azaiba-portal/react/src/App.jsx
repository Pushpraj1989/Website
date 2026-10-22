import { HashRouter, Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { mediaUrl, useContent } from "./data.js";

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

// Card or list view: one choice for the whole site, remembered on this device.
function useViewPref() {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("portal-view") === "list" ? "list" : "cards"; } catch (e) { return "cards"; }
  });
  const choose = (next) => {
    setView(next);
    try { localStorage.setItem("portal-view", next); } catch (e) { /* private window: not kept */ }
  };
  return [view, choose];
}

function ViewToggle({ view, setView }) {
  return (
    <div className="view-toggle" role="group" aria-label="Show as">
      <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}>Cards</button>
      <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
    </div>
  );
}

const cardsClass = (view) => (view === "list" ? "cards as-list" : "cards");

function Shell() {
  const [view, setView] = useViewPref();
  const { site, buildings, listings, error } = useContent();
  if (error) return <p className="wrap page-head">Content could not be loaded. Please try again later.</p>;
  if (!site) return <p className="wrap page-head">Loading…</p>;
  const ctx = { site, buildings, listings, view, setView };
  return (
    <>
      <header className="topbar">
        <div className="wrap bar">
          <Link className="brand" to="/"><span className="brand-mark">{site.group}</span><span>{site.name}</span></Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/flats">Flats to rent</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>
          <Link className="btn btn-light" to="/contact">Book a visit</Link>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home {...ctx} />} />
          <Route path="/flats" element={<Flats {...ctx} />} />
          <Route path="/flat/:id" element={<FlatPage {...ctx} />} />
          <Route path="/building/:id" element={<BuildingPage {...ctx} />} />
          <Route path="/about" element={<About {...ctx} />} />
          <Route path="/contact" element={<Contact {...ctx} />} />
          <Route path="*" element={<p className="wrap page-head">Page not found. <Link to="/">Home</Link></p>} />
        </Routes>
      </main>
      <footer className="foot">
        <div className="wrap foot-grid">
          <div><strong>{site.group}</strong><p>{site.name}, {site.location}</p></div>
          <div><Link to="/flats">Flats to rent</Link><Link to="/contact">Contact</Link></div>
          <div className="muted">Rents are per month.</div>
        </div>
      </footer>
    </>
  );
}

function buildingName(buildings, id) {
  return buildings.find((b) => b.id === id)?.name ?? "";
}

function Home({ site, buildings, listings, view, setView }) {
  const navigate = useNavigate();
  const [q, setQ] = useState({ building: "", bhk: "", max: "" });
  const featured = listings.filter((l) => l.featured).slice(0, 4);
  const shown = featured.length ? featured : listings.slice(0, 4);
  return (
    <>
      <section className="hero">
        {site.hero_video && (
          <video className="hero-video" autoPlay muted loop playsInline preload="auto" poster={mediaUrl(buildings[0].cover)} aria-hidden="true" tabIndex={-1} src={mediaUrl(site.hero_webm || site.hero_video)} />
        )}
        <div className="wrap">
          <p className="eyebrow">{site.location}</p>
          <h1>{site.hero_title}</h1>
          <p className="lede">{site.hero_lede}</p>
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
              navigate(`/flats?${params.toString()}`);
            }}
          >
            <SelectField label="Building" value={q.building} onChange={(v) => setQ({ ...q, building: v })}
              options={[["", "All buildings"], ...buildings.map((b) => [b.id, b.name])]} />
            <SelectField label="Bedrooms" value={q.bhk} onChange={(v) => setQ({ ...q, bhk: v })}
              options={[["", "Any"], ["1 BHK", "1 BHK"], ["2 BHK", "2 BHK"], ["3 BHK", "3 BHK"]]} />
            <SelectField label="Max rent (OMR)" value={q.max} onChange={(v) => setQ({ ...q, max: v })}
              options={[["", "Any"], ["300", "300"], ["400", "400"], ["500", "500"]]} />
            <button className="btn btn-gold" type="submit">Search flats</button>
          </form>
        </div>
      </section>

      {site.video && (
        <section className="wrap video-band">
          <video controls playsinline preload="metadata" src={mediaUrl(site.video)} />
          <div>
            <h2>The building in motion</h2>
            <p>A short film of the buildings and their surroundings.</p>
          </div>
        </section>
      )}

      <section className="wrap">
        <div className="section-head"><h2>Featured flats</h2><ViewToggle view={view} setView={setView} /><Link to="/flats">All flats →</Link></div>
        <div className={cardsClass(view)}>
          {shown.map((l) => <FlatCard key={l.id} flat={l} buildingName={buildingName(buildings, l.building)} />)}
        </div>
      </section>

      <section className="wrap">
        <div className="section-head"><h2>Our buildings</h2><ViewToggle view={view} setView={setView} /></div>
        <div className={cardsClass(view)}>
          {buildings.map((b) => (
            <Link className="card" key={b.id} to={`/building/${b.id}`}>
              <img src={mediaUrl(b.cover)} alt={b.name} loading="lazy" />
              <div className="card-body">
                <h3>{b.name}</h3>
                <p className="muted">{b.area} · {b.floors} floors · {b.units} units</p>
                <p className="price">From {site.currency} {b.from_rent} <small>/ month</small></p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

function FlatCard({ flat, buildingName: name }) {
  return (
    <Link className="card" to={`/flat/${flat.id}`}>
      <img src={mediaUrl(flat.cover)} alt={flat.title} loading="lazy" />
      <div className="card-body">
        <p className="price">{flat.rent_text} <small>{flat.period_text}</small></p>
        <h3>{flat.bhk} flat</h3>
        <p className="muted">{name} · {flat.size_text} · {flat.status}</p>
      </div>
    </Link>
  );
}

function Flats({ buildings, listings, view, setView }) {
  const [params, setParams] = useSearchParams();
  const building = params.get("building") ?? "";
  const bhk = params.get("bhk") ?? "";
  const max = parseInt(params.get("max") ?? "", 10);
  const set = (key) => (value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  const rows = listings.filter(
    (l) => (!building || l.building === building) && (!bhk || l.bhk === bhk) && (Number.isNaN(max) || l.rent_omr <= max),
  );
  return (
    <>
      <section className="wrap page-head">
        <h1>Flats to rent</h1>
        <p className="muted">{rows.length} {rows.length === 1 ? "flat" : "flats"}</p>
        <ViewToggle view={view} setView={setView} />
      </section>
      <section className="wrap">
        <div className="search search-compact">
          <SelectField label="Building" value={building} onChange={set("building")}
            options={[["", "All buildings"], ...buildings.map((b) => [b.id, b.name])]} />
          <SelectField label="Bedrooms" value={bhk} onChange={set("bhk")}
            options={[["", "Any"], ["1 BHK", "1 BHK"], ["2 BHK", "2 BHK"], ["3 BHK", "3 BHK"]]} />
          <label className="field"><span>Max rent (OMR)</span>
            <input type="number" min="0" step="5" value={params.get("max") ?? ""} placeholder="Any" onChange={(e) => set("max")(e.target.value)} />
          </label>
        </div>
        <div className={cardsClass(view)}>
          {rows.map((l) => <FlatCard key={l.id} flat={l} buildingName={buildingName(buildings, l.building)} />)}
        </div>
        {rows.length === 0 && <p className="muted empty">No flats match. Try another building or rent.</p>}
      </section>
    </>
  );
}

function FlatPage({ site, buildings, listings }) {
  const { id } = useParams();
  const flat = listings.find((l) => l.id === id);
  if (!flat) return <p className="wrap page-head">Flat not found. <Link to="/flats">All flats</Link></p>;
  return (
    <section className="wrap detail">
      <nav className="crumbs"><Link to="/">Home</Link> / <Link to="/flats">Flats to rent</Link> / <span>{flat.bhk}</span></nav>
      <div className="detail-grid">
        <div>
          <img className="hero-img" src={mediaUrl(flat.cover)} alt={flat.title} />
          <div className="thumbs">
            {flat.gallery.map((img, i) => <img key={img} src={mediaUrl(img)} alt={`${flat.title} photo ${i + 1}`} loading="lazy" />)}
          </div>
          {flat.video && <video controls playsinline preload="metadata" className="detail-video" src={mediaUrl(flat.video)} />}
        </div>
        <aside className="panel">
          <h1>{flat.title}</h1>
          <p className="price">{flat.rent_text} <small>{flat.period_text}</small></p>
          <dl className="facts">
            <dt>Bedrooms</dt><dd>{flat.bhk}</dd>
            <dt>Size</dt><dd>{flat.size_text}</dd>
            <dt>Building</dt><dd><Link to={`/building/${flat.building}`}>{buildingName(buildings, flat.building)}</Link></dd>
            <dt>Status</dt><dd>{flat.status}{flat.available_from ? `, from ${flat.available_from}` : ""}</dd>
          </dl>
          <p>{flat.description}</p>
          <Link className="btn btn-gold" to={`/contact?flat=${flat.id}`}>Book a visit</Link>
        </aside>
      </div>
    </section>
  );
}

function BuildingPage({ buildings, listings, view, setView }) {
  const { id } = useParams();
  const b = buildings.find((x) => x.id === id);
  if (!b) return <p className="wrap page-head">Building not found. <Link to="/">Home</Link></p>;
  const own = listings.filter((l) => l.building === b.id);
  return (
    <section className="wrap detail">
      <nav className="crumbs"><Link to="/">Home</Link> / <Link to="/flats">Flats to rent</Link> / <span>{b.name}</span></nav>
      <h1>{b.name}</h1>
      <p className="muted">{b.area} · {b.floors} floors · {b.units} units · {b.status}</p>
      <img className="hero-img" src={mediaUrl(b.cover)} alt={b.name} />
      <p className="lede">{b.description}</p>
      <div className="thumbs">
        {b.gallery.map((img, i) => <img key={img} src={mediaUrl(img)} alt={`${b.name} photo ${i + 1}`} loading="lazy" />)}
      </div>
      {b.video && <video controls playsinline preload="metadata" className="detail-video" src={mediaUrl(b.video)} />}
      <div className="section-head"><h2>Flats in {b.name}</h2><ViewToggle view={view} setView={setView} /></div>
      <div className={cardsClass(view)}>
        {own.map((l) => <FlatCard key={l.id} flat={l} buildingName={b.name} />)}
      </div>
    </section>
  );
}

function About({ site }) {
  return (
    <>
      <section className="wrap page-head"><h1>{site.about_title}</h1></section>
      <section className="wrap prose"><p>{site.about_text}</p></section>
    </>
  );
}

function Contact({ site }) {
  const [params] = useSearchParams();
  return (
    <>
      <section className="wrap page-head"><h1>Book a visit</h1><p className="muted">Tell us which flat you want to see.</p></section>
      <section className="wrap contact-grid">
        <form className="panel form" action={`mailto:${site.email}`} method="post" encType="text/plain">
          <label className="field"><span>Name</span><input name="name" required /></label>
          <label className="field"><span>Phone</span><input name="phone" type="tel" required /></label>
          <label className="field"><span>Flat</span><input name="flat" defaultValue={params.get("flat") ?? ""} placeholder="Any flat" /></label>
          <label className="field"><span>Message</span><textarea name="message" rows="4" /></label>
          <button className="btn btn-gold" type="submit">Send enquiry</button>
        </form>
        <aside className="panel">
          <h2>{site.group} leasing office</h2>
          <p>{site.address}</p>
          <p>Phone: {site.phone}</p>
          <p>WhatsApp: {site.whatsapp}</p>
          <p>Email: {site.email}</p>
        </aside>
      </section>
    </>
  );
}
