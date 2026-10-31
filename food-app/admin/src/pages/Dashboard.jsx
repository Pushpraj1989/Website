import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatMoney } from '../money.js';

// The sales dashboard: orders and sales for the chosen days, each compared with the days just before and with the same
// days a year earlier, then sales by day, month by month (with change on the month before and the year before), how
// customers ordered and paid, and the best-selling dishes. Every figure is counted from the orders.

const CHANNELS = { delivery: 'Delivery', pickup: 'Pickup' };
const METHODS = { card: 'Card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', samsung_pay: 'Samsung Pay', cod: 'Cash on delivery', pay_on_arrival: 'Pay at pickup' };

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

function presetRange(id) {
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (id) {
    case 'today': return [t, t];
    case 'yesterday': return [shift(t, -1), shift(t, -1)];
    case '7': return [shift(t, -6), t];
    case '30': return [shift(t, -29), t];
    case 'month': return [new Date(t.getFullYear(), t.getMonth(), 1), t];
    case 'lastMonth': return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)];
    case 'year': return [new Date(t.getFullYear(), 0, 1), t];
    default: return [shift(t, -29), t];
  }
}
const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['lastMonth', 'Last month'], ['year', 'This year']];

// Change as a percentage, or null when there is nothing to compare with.
function change(now, before) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

function Change({ now, before, label }) {
  const pct = change(now, before);
  if (pct === null) return <span className="muted delta">{label ? `${label}: no data` : '—'}</span>;
  const cls = pct > 0 ? 'delta up' : pct < 0 ? 'delta down' : 'delta';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '■';
  return <span className={cls}><span aria-hidden="true">{arrow} </span>{pct > 0 ? '+' : ''}{pct}% {label}</span>;
}

function Kpi({ label, value, now, previous, lastYear }) {
  return (
    <li className="stat kpi">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <Change now={now} before={previous} label="vs before" />
      <Change now={now} before={lastYear} label="vs last year" />
    </li>
  );
}

// An interactive bar chart drawn as SVG. Pointing at a bar, or moving along with the arrow keys, shows its figures;
// the bars grow in when the data arrives (not when motion is reduced). The tables on the page hold the same numbers.
function BarChart({ points, label, ticks, height = 180 }) {
  const [active, setActive] = useState(null);
  const ref = useRef(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 720, h = height;
  const bw = w / Math.max(1, points.length);
  const gap = bw > 6 ? Math.min(4, bw * 0.2) : 0;
  const at = (clientX) => {
    const box = ref.current.getBoundingClientRect();
    const i = Math.floor(((clientX - box.left) / box.width) * points.length);
    return Math.min(points.length - 1, Math.max(0, i));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive((i) => Math.min(points.length - 1, (i ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive((i) => Math.max(0, (i ?? points.length) - 1)); }
    if (e.key === 'Escape') setActive(null);
  };
  const hit = active === null ? null : points[active];
  const left = active === null ? 0 : ((active + 0.5) / points.length) * 100;
  return (
    <div className="chart-box">
      <svg
        ref={ref} viewBox={`0 0 ${w} ${h + 20}`} className="chart" role="img" tabIndex={0}
        aria-label={`${label}. Use the left and right arrow keys to read each bar.`}
        onPointerMove={(e) => setActive(at(e.clientX))} onPointerLeave={() => setActive(null)} onKeyDown={onKey} onBlur={() => setActive(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={w} y1={h - h * f} y2={h - h * f} className="grid" />)}
        {points.map((p, i) => {
          const bh = Math.round((p.value / max) * h);
          return <rect key={p.key} x={i * bw + gap / 2} y={h - bh} width={Math.max(1, bw - gap)} height={bh} rx={bw > 10 ? 3 : 0} className={active === i ? 'bar on' : 'bar'} />;
        })}
        <line x1="0" x2={w} y1={h} y2={h} className="axis" />
        {ticks(points).map(([i, text]) => (
          <text key={i} x={i === 0 ? 0 : i === points.length - 1 ? w : (i + 0.5) * bw} y={h + 16} className="tick" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{text}</text>
        ))}
      </svg>
      {hit ? (
        <div className="tip" role="status" style={{ left: `clamp(70px, ${left}%, calc(100% - 70px))` }}>
          <strong>{hit.title}</strong>
          {hit.lines.map((l) => <span key={l}>{l}</span>)}
        </div>
      ) : null}
    </div>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dayName = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDay = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function monthName(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const [preset, setPreset] = useState('30');
  const [range, setRange] = useState(() => presetRange('30').map(iso));
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState('sales');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async (from, to, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setReport(await api.salesReport(from, to));
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range[0], range[1]); }, [load, range]);

  // Live: while the chosen days include today, a new order refreshes the figures at once (over the same stream the
  // kitchen board uses), and a quiet refresh every minute picks up orders that were delivered or cancelled.
  // Nothing runs while the tab is hidden.
  const includesToday = range[1] >= iso(new Date());
  useEffect(() => {
    if (!includesToday) { setLive(false); return undefined; }
    let source = null;
    let soon = null;
    const refresh = () => { clearTimeout(soon); soon = setTimeout(() => load(range[0], range[1], true), 800); };
    const open = () => {
      if (source || document.hidden) return;
      source = new EventSource('/v1/admin/orders/stream');
      source.addEventListener('ready', () => setLive(true));
      source.addEventListener('order', refresh);
      source.onerror = () => setLive(false);
    };
    const close = () => { source?.close(); source = null; setLive(false); };
    const onVisible = () => { if (document.hidden) close(); else { open(); refresh(); } };
    open();
    const tick = setInterval(() => { if (!document.hidden) load(range[0], range[1], true); }, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { close(); clearInterval(tick); clearTimeout(soon); document.removeEventListener('visibilitychange', onVisible); };
  }, [includesToday, load, range]);

  function choose(id) {
    setPreset(id);
    setRange(presetRange(id).map(iso));
  }

  function custom(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPreset('custom');
    setRange([String(form.get('from')), String(form.get('to'))]);
  }

  const digits = 2;
  const money = (minor) => formatMoney(minor, digits, report?.currency ?? '');
  const c = report?.current, p = report?.previous, y = report?.lastYear;
  const months = report ? report.monthly.slice(-12).reverse() : [];
  const monthAt = (m, back) => {
    const i = report.monthly.findIndex((x) => x.month === m);
    return i - back >= 0 ? report.monthly[i - back] : null;
  };

  return (
    <section className="stack">
      <div className="toolbar">
        <h1>Dashboard</h1>
        <div className="row">
          {live ? <span className="live" role="status"><span className="dot" aria-hidden="true" />Live</span> : null}
          {updatedAt ? <span className="muted">Updated {updatedAt.toLocaleTimeString()}</span> : null}
          <button type="button" className="btn" onClick={() => load(range[0], range[1])} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>

      <div className="card stack">
        <div className="chips" role="group" aria-label="Period">
          {PRESETS.map(([id, label]) => (
            <button key={id} type="button" className={preset === id ? 'chip active' : 'chip'} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
          ))}
        </div>
        <form className="row" onSubmit={custom} key={range.join()}>
          <label>From <input type="date" name="from" defaultValue={range[0]} required /></label>
          <label>To <input type="date" name="to" defaultValue={range[1]} required /></label>
          <button type="submit" className="btn">Show</button>
        </form>
        {report ? (
          <p className="muted">
            {report.from} to {report.to}, compared with {report.previousFrom} to {report.previousTo} (before) and {report.lastYearFrom} to {report.lastYearTo} (last year). Days are counted in {report.timezone} time.
          </p>
        ) : null}
      </div>

      {error ? <p role="alert" className="error">{error}</p> : null}
      {!report && !error ? <p className="muted">Loading…</p> : null}

      {report ? (
        <>
          <ul className="stats kpis" aria-label="Totals">
            <Kpi label="Sales" value={money(c.salesMinor)} now={c.salesMinor} previous={p.salesMinor} lastYear={y.salesMinor} />
            <Kpi label="Orders received" value={c.received} now={c.received} previous={p.received} lastYear={y.received} />
            <Kpi label="Delivered or collected" value={c.completed} now={c.completed} previous={p.completed} lastYear={y.completed} />
            <Kpi label="Average order" value={money(c.averageMinor)} now={c.averageMinor} previous={p.averageMinor} lastYear={y.averageMinor} />
            <li className="stat kpi"><span className="muted">In progress</span><strong>{c.inProgress}</strong><span className="muted delta">not finished yet</span></li>
            <li className="stat kpi"><span className="muted">Cancelled or refused</span><strong>{c.cancelled}</strong><span className="muted delta">{c.received ? `${Math.round((c.cancelled / c.received) * 1000) / 10}% of orders` : '—'}</span></li>
            <li className="stat kpi"><span className="muted">Discounts given</span><strong>{money(c.discountMinor)}</strong><Change now={c.discountMinor} before={p.discountMinor} label="vs before" /></li>
          </ul>

          <ul className="stats kpis" aria-label="Customers">
            <li className="stat kpi"><span className="muted">Customers who ordered</span><strong>{report.customers.total}</strong></li>
            <li className="stat kpi"><span className="muted">New customers</span><strong>{report.customers.new}</strong><span className="muted delta">first order ever in these days</span></li>
            <li className="stat kpi"><span className="muted">Returning customers</span><strong>{report.customers.returning}</strong><span className="muted delta">{money(report.customers.returningSalesMinor)} in sales</span></li>
            <li className="stat kpi"><span className="muted">Ordered more than once</span><strong>{report.customers.orderedMoreThanOnce}</strong><span className="muted delta">in these days</span></li>
          </ul>

          <div className="card stack">
            <div className="row between">
              <h2>{metric === 'sales' ? 'Sales by day' : 'Orders by day'}</h2>
              <div className="chips" role="group" aria-label="Show">
                <button type="button" className={metric === 'sales' ? 'chip active' : 'chip'} aria-pressed={metric === 'sales'} onClick={() => setMetric('sales')}>Sales</button>
                <button type="button" className={metric === 'orders' ? 'chip active' : 'chip'} aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Orders</button>
              </div>
            </div>
            {c.received === 0 ? <p className="muted">No orders in these days.</p> : (
              <BarChart
                key={`${report.from}-${metric}`}
                label={metric === 'sales' ? 'Sales by day' : 'Orders by day'}
                points={report.byDay.map((d) => ({ key: d.day, value: metric === 'sales' ? d.salesMinor : d.orders, title: dayName(d.day), lines: [money(d.salesMinor), `${d.orders} ${d.orders === 1 ? 'order' : 'orders'}`] }))}
                ticks={(pts) => {
                  const step = Math.max(1, Math.ceil(pts.length / 6));
                  return pts.map((p, i) => [i, p.key]).filter(([i]) => i === 0 || i === pts.length - 1 || (i % step === 0 && i < pts.length - step / 2)).map(([i, k]) => [i, shortDay(k)]);
                }}
              />
            )}
          </div>

          <div className="pair">
            <div className="card stack">
              <h2>Busiest hours</h2>
              {c.received === 0 ? <p className="muted">No orders in these days.</p> : (
                <BarChart
                  key={report.from} height={140} label="Orders by hour of the day"
                  points={report.byHour.map((x) => ({ key: x.hour, value: x.orders, title: `${String(x.hour).padStart(2, '0')}:00 to ${String(x.hour).padStart(2, '0')}:59`, lines: [`${x.orders} ${x.orders === 1 ? 'order' : 'orders'}`, money(x.salesMinor)] }))}
                  ticks={(pts) => pts.filter((p) => p.key % 3 === 0).map((p) => [p.key, `${String(p.key).padStart(2, '0')}:00`])}
                />
              )}
            </div>
            <div className="card table-wrap" tabIndex={0} role="region" aria-label="By day of the week">
              <h2 className="pad-h">By day of the week</h2>
              <table>
                <thead><tr><th scope="col">Day</th><th scope="col">Orders</th><th scope="col">Sales</th></tr></thead>
                <tbody>
                  {report.byWeekday.map((d) => (
                    <tr key={d.weekday}><td>{WEEKDAYS[d.weekday]}</td><td>{d.orders}</td><td>{money(d.salesMinor)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card table-wrap" tabIndex={0} role="region" aria-label="Month by month">
            <h2 className="pad-h">Month by month</h2>
            <table>
              <thead><tr><th scope="col">Month</th><th scope="col">Orders</th><th scope="col">Sales</th><th scope="col">Month on month</th><th scope="col">Year on year</th></tr></thead>
              <tbody>
                {months.map((m) => {
                  const before = monthAt(m.month, 1), year = monthAt(m.month, 12);
                  return (
                    <tr key={m.month}>
                      <td>{monthName(m.month)}</td>
                      <td>{m.orders}</td>
                      <td>{money(m.salesMinor)}</td>
                      <td><Change now={m.salesMinor} before={before?.salesMinor} label="" /></td>
                      <td><Change now={m.salesMinor} before={year?.salesMinor} label="" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pair">
            <div className="card table-wrap" tabIndex={0} role="region" aria-label="How customers ordered">
              <h2 className="pad-h">How customers ordered</h2>
              <table>
                <thead><tr><th scope="col">Type</th><th scope="col">Orders</th><th scope="col">Sales</th></tr></thead>
                <tbody>
                  {report.channels.length === 0 ? <tr><td colSpan={3} className="muted">No orders.</td></tr> : report.channels.map((r) => (
                    <tr key={r.key}><td>{CHANNELS[r.key] ?? r.key}</td><td>{r.orders}</td><td>{money(r.salesMinor)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card table-wrap" tabIndex={0} role="region" aria-label="How customers paid">
              <h2 className="pad-h">How customers paid</h2>
              <table>
                <thead><tr><th scope="col">Payment</th><th scope="col">Orders</th><th scope="col">Sales</th></tr></thead>
                <tbody>
                  {report.payments.length === 0 ? <tr><td colSpan={3} className="muted">No orders.</td></tr> : report.payments.map((r) => (
                    <tr key={r.key}><td>{METHODS[r.key] ?? r.key}</td><td>{r.orders}</td><td>{money(r.salesMinor)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card table-wrap" tabIndex={0} role="region" aria-label="Best sellers">
            <h2 className="pad-h">Best sellers</h2>
            <table>
              <thead><tr><th scope="col">Dish</th><th scope="col">Sold</th><th scope="col">Sales</th></tr></thead>
              <tbody>
                {report.topItems.length === 0 ? <tr><td colSpan={3} className="muted">No dishes sold in these days.</td></tr> : report.topItems.map((r) => (
                  <tr key={r.nameEn}><td>{r.nameEn}</td><td>{r.qty}</td><td>{money(r.salesMinor)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
