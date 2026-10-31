import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarRange, Clock3, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { formatMoney } from '../money.js';

// The sales dashboard. Every figure is counted from the orders, by the day the order was placed in the restaurant's
// time zone. The top of the page answers "how are we doing": sales against the period before and last year, a few
// rings, and what needs doing now. Below it: the shape of the period (days, hours, weekdays, months), what sold,
// and how customers ordered and paid. A new order updates everything at once.

const CHANNELS = { delivery: 'Delivery', pickup: 'Pickup' };
const METHODS = { card: 'Card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', samsung_pay: 'Samsung Pay', cod: 'Cash on delivery', pay_on_arrival: 'Pay at pickup' };
const OPEN = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery'];
const OPEN_TEXT = { placed: 'New, waiting to be accepted', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', out_for_delivery: 'Out for delivery' };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const dayName = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDay = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function presetRange(id) {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (id) {
    case 'today': return [t, t];
    case 'yesterday': return [shift(t, -1), shift(t, -1)];
    case '7': return [shift(t, -6), t];
    case 'month': return [new Date(t.getFullYear(), t.getMonth(), 1), t];
    case 'lastMonth': return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)];
    case 'year': return [new Date(t.getFullYear(), 0, 1), t];
    default: return [shift(t, -29), t];
  }
}
const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7', '7 days'], ['30', '30 days'], ['month', 'This month'], ['lastMonth', 'Last month'], ['year', 'This year']];
const PRESET_TEXT = { today: 'Today', yesterday: 'Yesterday', 7: 'Last 7 days', 30: 'Last 30 days', month: 'This month', lastMonth: 'Last month', year: 'This year', custom: 'Chosen dates' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function ago(isoTime) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(isoTime)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} h ${mins % 60} min ago` : `${Math.floor(h / 24)} d ago`;
}

// A number that counts up to its new value. Shows the final value at once when motion is reduced.
function useCountUp(value) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (calm()) { setShown(value); from.current = value; return undefined; }
    const start = performance.now(), a = from.current, b = value;
    let frame;
    const step = (now) => {
      const t = Math.min(1, (now - start) / 700);
      setShown(Math.round(a + (b - a) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = b;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

function Count({ value, format = String }) {
  return <>{format(useCountUp(value))}</>;
}

// Change as a percentage chip, or a dash when there is nothing to compare with.
function Delta({ now, before, label, onDark = false }) {
  const cls = (tone) => `chip-delta ${tone}${onDark ? ' on-dark' : ''}`;
  if (!before) return <span className={cls('flat')}>{label ? `${label}: no data` : '—'}</span>;
  const p = Math.round(((now - before) / before) * 1000) / 10;
  const tone = p > 0 ? 'up' : p < 0 ? 'down' : 'flat';
  return (
    <span className={cls(tone)}>
      <span aria-hidden="true">{p > 0 ? '↑' : p < 0 ? '↓' : '→'}</span> {p > 0 ? '+' : ''}{p}%{label ? ` ${label}` : ''}
    </span>
  );
}

// A small line under the hero figure: the shape of the period, without axes.
function Sparkline({ values }) {
  if (values.length < 2) return null;
  const w = 300, h = 64, max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - (v / max) * (h - 6) - 3]);
  const line = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${w},${h} L0,${h} Z`} className="spark-fill" />
      <path d={line} className="spark-line" />
    </svg>
  );
}

// Concentric progress rings, each with its own colour, and a legend beside them that says what each one means.
function Rings({ rings }) {
  const size = 150, stroke = 13;
  return (
    <div className="rings">
      <svg viewBox={`0 0 ${size} ${size}`} className="rings-art" role="img" aria-label={rings.map((r) => `${r.label}: ${r.text}`).join('. ')}>
        {rings.map((r, i) => {
          const radius = size / 2 - stroke / 2 - i * (stroke + 5);
          const c = 2 * Math.PI * radius;
          return (
            <g key={r.label} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <circle cx={size / 2} cy={size / 2} r={radius} className="ring-track" style={{ stroke: r.colour }} strokeWidth={stroke} />
              <circle cx={size / 2} cy={size / 2} r={radius} className="ring" style={{ stroke: r.colour, '--c': c, '--off': c * (1 - Math.min(1, r.value)) }} strokeWidth={stroke} strokeDasharray={c} />
            </g>
          );
        })}
      </svg>
      <ul className="ring-legend">
        {rings.map((r) => (
          <li key={r.label} style={{ '--rc': r.colour }}>
            <span className="muted">{r.label}</span>
            <strong>{r.text}</strong>
            <span className="muted small">{r.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A donut of parts of a whole, with the total in the middle and a legend with percentages.
function Donut({ parts, total, caption }) {
  const size = 170, stroke = 22, r = size / 2 - stroke / 2, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-art" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} className="donut-track" strokeWidth={stroke} />
        {total > 0 ? parts.map((p) => {
          const len = (p.value / total) * c;
          const seg = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.colour} strokeWidth={stroke} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="donut-seg" />;
          offset += len;
          return seg;
        }) : null}
        <text x="50%" y="48%" textAnchor="middle" className="donut-total">{total}</text>
        <text x="50%" y="62%" textAnchor="middle" className="donut-caption">{caption}</text>
      </svg>
      <ul className="legend">
        {parts.map((p) => (
          <li key={p.label}>
            <span className="dot" style={{ background: p.colour }} aria-hidden="true" />
            <span>{p.label}</span>
            <strong>{p.value}</strong>
            <span className="muted">{pct(p.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A ranked list with a bar behind each row, for best sellers, payments and the like.
function BarList({ rows, empty }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="barlist">
      {rows.map((r) => (
        <li key={r.key} style={{ '--w': `${Math.max(2, (r.value / max) * 100)}%` }}>
          <span className="barlist-name">{r.label}</span>
          <span className="barlist-meta muted">{r.meta}</span>
          <strong className="barlist-value">{r.text}</strong>
        </li>
      ))}
    </ol>
  );
}

// An interactive bar chart drawn as SVG. Pointing at a bar, or moving along with the arrow keys, shows its figures;
// the bars grow in when the data arrives (not when motion is reduced).
function BarChart({ points, label, ticks, height = 180 }) {
  const [active, setActive] = useState(null);
  const ref = useRef(null);
  const id = `g-${label.replace(/\W/g, '')}`;
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 720, h = height;
  const bw = w / Math.max(1, points.length);
  const gap = bw > 6 ? Math.min(6, bw * 0.28) : 0;
  const at = (clientX) => {
    const box = ref.current.getBoundingClientRect();
    return Math.min(points.length - 1, Math.max(0, Math.floor(((clientX - box.left) / box.width) * points.length)));
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
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity=".45" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={w} y1={h - h * f} y2={h - h * f} className="grid" />)}
        {points.map((p, i) => {
          const bh = Math.round((p.value / max) * h);
          return <rect key={p.key} x={i * bw + gap / 2} y={h - bh} width={Math.max(1, bw - gap)} height={bh} rx={bw > 10 ? 5 : 0} fill={`url(#${id})`} className={active === i ? 'bar on' : 'bar'} style={{ animationDelay: `${Math.min(i * 12, 400)}ms` }} />;
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

function monthName(m) {
  const [yy, mo] = m.split('-').map(Number);
  return new Date(yy, mo - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const [preset, setPreset] = useState('30');
  const [range, setRange] = useState(() => presetRange('30').map(iso));
  const [report, setReport] = useState(null);
  const [today, setToday] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState('sales');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [live, setLive] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const load = useCallback(async (from, to, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const day = iso(new Date());
      const [r, t, o] = await Promise.all([api.salesReport(from, to), api.salesReport(day, day), api.orders().catch(() => null)]);
      setReport(r);
      setToday(t);
      if (o) setOpen(o.orders.filter((x) => OPEN.includes(x.status)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)));
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range[0], range[1]); }, [load, range]);

  // Live: a new order refreshes the figures at once (over the same stream the kitchen board uses), and a quiet
  // refresh every minute picks up orders that moved on or were cancelled. Nothing runs while the tab is hidden.
  useEffect(() => {
    let source = null;
    let soon = null;
    const refresh = () => { clearTimeout(soon); soon = setTimeout(() => load(range[0], range[1], true), 800); };
    const connect = () => {
      if (source || document.hidden) return;
      source = new EventSource('/v1/admin/orders/stream');
      source.addEventListener('ready', () => setLive(true));
      source.addEventListener('order', refresh);
      source.onerror = () => setLive(false);
    };
    const close = () => { source?.close(); source = null; setLive(false); };
    const onVisible = () => { if (document.hidden) close(); else { connect(); refresh(); } };
    connect();
    const tick = setInterval(() => { if (!document.hidden) load(range[0], range[1], true); }, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { close(); clearInterval(tick); clearTimeout(soon); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, range]);

  function choose(id) {
    setPreset(id);
    setShowCustom(false);
    setRange(presetRange(id).map(iso));
  }

  function custom(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPreset('custom');
    setRange([String(form.get('from')), String(form.get('to'))]);
  }

  const money = (minor) => formatMoney(minor, 2, report?.currency ?? '');
  const c = report?.current, p = report?.previous, y = report?.lastYear;
  const waiting = open?.filter((o) => o.status === 'placed').length ?? 0;
  const months = report ? report.monthly.slice(-12).reverse() : [];
  const monthAt = (m, back) => {
    const i = report.monthly.findIndex((x) => x.month === m);
    return i - back >= 0 ? report.monthly[i - back] : null;
  };
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section className="stack dash">
      <header className="dash-head">
        <div>
          <h1>{greeting()}</h1>
          <p className="muted">
            {dateLine}
            {today ? ` · ${today.current.received} ${today.current.received === 1 ? 'order' : 'orders'} today, ${money(today.current.salesMinor)} in sales` : ''}
            {open ? ` · ${waiting ? `${waiting} waiting to be accepted` : 'nothing waiting'}` : ''}
          </p>
        </div>
        <div className="row">
          {live ? <span className="live" role="status"><span className="dot" aria-hidden="true" />Live</span> : null}
          {updatedAt ? <span className="muted small">Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> : null}
          <button type="button" className="btn icon-btn" onClick={() => load(range[0], range[1])} disabled={loading} aria-label="Refresh" title="Refresh">
            <RefreshCw className={loading ? 'icon spin' : 'icon'} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="period">
        <div className="segmented" role="group" aria-label="Period">
          {PRESETS.map(([id, label]) => (
            <button key={id} type="button" className={preset === id ? 'seg on' : 'seg'} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
          ))}
          <button type="button" className={preset === 'custom' ? 'seg on' : 'seg'} aria-expanded={showCustom} onClick={() => setShowCustom((v) => !v)}>
            <CalendarRange className="icon" aria-hidden="true" />Dates
          </button>
        </div>
        {showCustom ? (
          <form className="row custom-dates" onSubmit={custom} key={range.join()}>
            <label>From <input type="date" name="from" defaultValue={range[0]} required /></label>
            <label>To <input type="date" name="to" defaultValue={range[1]} required /></label>
            <button type="submit" className="btn primary">Show</button>
          </form>
        ) : null}
      </div>

      {error ? <p role="alert" className="error">{error}</p> : null}
      {!report && !error ? <div className="dash-grid" aria-hidden="true"><div className="card skeleton span-8" /><div className="card skeleton span-4" /></div> : null}

      {report ? (
        <div className="dash-grid">
          <article className="hero span-8">
            <div className="hero-top">
              <span className="hero-label">Sales · {PRESET_TEXT[preset]}</span>
              <span className="hero-range">{shortDay(report.from)} – {shortDay(report.to)}</span>
            </div>
            <strong className="hero-value"><Count value={c.salesMinor} format={money} /></strong>
            <div className="row">
              <Delta now={c.salesMinor} before={p.salesMinor} label="vs period before" onDark />
              <Delta now={c.salesMinor} before={y.salesMinor} label="vs last year" onDark />
            </div>
            <Sparkline values={report.byDay.map((d) => d.salesMinor)} />
            <div className="hero-foot">
              <span><strong><Count value={c.received} /></strong> orders</span>
              <span><strong>{money(c.averageMinor)}</strong> average</span>
              <span><strong><Count value={report.customers.total} /></strong> customers</span>
            </div>
          </article>

          <article className="card span-4 stack">
            <h2>At a glance</h2>
            <Rings rings={[
              { label: 'Finished', colour: '#22c55e', value: c.received ? c.completed / c.received : 0, text: `${c.completed} / ${c.received}`, hint: 'orders delivered or collected' },
              { label: 'Returning', colour: '#38bdf8', value: report.customers.total ? report.customers.returning / report.customers.total : 0, text: `${report.customers.returning} / ${report.customers.total}`, hint: 'customers who ordered before' },
              { label: 'Against before', colour: '#f472b6', value: p.salesMinor ? c.salesMinor / p.salesMinor : (c.salesMinor ? 1 : 0), text: p.salesMinor ? `${pct(c.salesMinor, p.salesMinor)}%` : '—', hint: 'of the period before’s sales' },
            ]} />
          </article>

          <ul className="kpis span-12" aria-label="Totals">
            {[
              ['Orders received', c.received, p.received, y.received, String],
              ['Delivered or collected', c.completed, p.completed, y.completed, String],
              ['Average order', c.averageMinor, p.averageMinor, y.averageMinor, money],
            ].map(([label, now, before, year, fmt]) => (
              <li key={label} className="stat kpi">
                <span className="muted">{label}</span>
                <strong><Count value={now} format={fmt} /></strong>
                <span className="row" style={{ gap: 6 }}><Delta now={now} before={before} label="before" /><Delta now={now} before={year} label="last year" /></span>
              </li>
            ))}
            <li className="stat kpi"><span className="muted">New customers</span><strong><Count value={report.customers.new} /></strong><span className="muted small">first order ever in these days</span></li>
            <li className="stat kpi"><span className="muted">In progress</span><strong><Count value={c.inProgress} /></strong><span className="muted small">not finished yet</span></li>
            <li className="stat kpi"><span className="muted">Cancelled or refused</span><strong><Count value={c.cancelled} /></strong><span className="muted small">{c.received ? `${pct(c.cancelled, c.received)}% of orders` : '—'}</span></li>
            <li className="stat kpi"><span className="muted">Discounts given</span><strong>{money(c.discountMinor)}</strong><span className="row" style={{ gap: 6 }}><Delta now={c.discountMinor} before={p.discountMinor} label="before" /></span></li>
            <li className="stat kpi"><span className="muted">From returning customers</span><strong>{money(report.customers.returningSalesMinor)}</strong><span className="muted small">{c.salesMinor ? `${pct(report.customers.returningSalesMinor, c.salesMinor)}% of sales` : '—'}</span></li>
          </ul>

          <article className="card span-8 stack">
            <div className="row between">
              <h2>{metric === 'sales' ? 'Sales by day' : 'Orders by day'}</h2>
              <div className="segmented small" role="group" aria-label="Show">
                <button type="button" className={metric === 'sales' ? 'seg on' : 'seg'} aria-pressed={metric === 'sales'} onClick={() => setMetric('sales')}>Sales</button>
                <button type="button" className={metric === 'orders' ? 'seg on' : 'seg'} aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Orders</button>
              </div>
            </div>
            {c.received === 0 ? <p className="muted">No orders in these days.</p> : (
              <BarChart
                key={`${report.from}-${report.to}-${metric}`}
                label={metric === 'sales' ? 'Sales by day' : 'Orders by day'}
                points={report.byDay.map((d) => ({ key: d.day, value: metric === 'sales' ? d.salesMinor : d.orders, title: dayName(d.day), lines: [money(d.salesMinor), `${d.orders} ${d.orders === 1 ? 'order' : 'orders'}`] }))}
                ticks={(pts) => {
                  const step = Math.max(1, Math.ceil(pts.length / 6));
                  return pts.map((pt, i) => [i, pt.key]).filter(([i]) => i === 0 || i === pts.length - 1 || (i % step === 0 && i < pts.length - step / 2)).map(([i, k]) => [i, shortDay(k)]);
                }}
              />
            )}
          </article>

          <article className="card span-4 stack">
            <div className="row between">
              <h2>Needs attention</h2>
              <a className="btn ghost sm" href="#/orders">Live orders <ArrowRight className="icon" aria-hidden="true" /></a>
            </div>
            {open === null ? <p className="muted">Could not load the live orders.</p> : open.length === 0 ? (
              <p className="muted">No open orders. New ones appear here as they come in.</p>
            ) : (
              <ul className="queue">
                {open.slice(0, 5).map((o) => (
                  <li key={o.id} className={o.status === 'placed' ? 'urgent' : ''}>
                    <span className="queue-bar" aria-hidden="true" />
                    <div>
                      <strong>{o.number}</strong>
                      <span className="muted small">{OPEN_TEXT[o.status]} · {CHANNELS[o.channel] ?? o.channel}</span>
                    </div>
                    <span className="queue-time"><Clock3 className="icon" aria-hidden="true" />{ago(o.createdAt)}</span>
                  </li>
                ))}
                {open.length > 5 ? <li className="muted small more-line">and {open.length - 5} more</li> : null}
              </ul>
            )}
          </article>

          <article className="card span-4 stack">
            <h2>Order status</h2>
            <Donut
              total={c.received} caption="orders"
              parts={[
                { label: 'Delivered or collected', value: c.completed, colour: '#22c55e' },
                { label: 'In progress', value: c.inProgress, colour: '#38bdf8' },
                { label: 'Cancelled or refused', value: c.cancelled, colour: '#f43f5e' },
              ]}
            />
          </article>

          <article className="card span-8 stack">
            <h2>Busiest hours</h2>
            {c.received === 0 ? <p className="muted">No orders in these days.</p> : (
              <BarChart
                key={`${report.from}-${report.to}-hours`} height={150} label="Orders by hour of the day"
                points={report.byHour.map((x) => ({ key: x.hour, value: x.orders, title: `${String(x.hour).padStart(2, '0')}:00 to ${String(x.hour).padStart(2, '0')}:59`, lines: [`${x.orders} ${x.orders === 1 ? 'order' : 'orders'}`, money(x.salesMinor)] }))}
                ticks={(pts) => pts.filter((pt) => pt.key % 3 === 0).map((pt) => [pt.key, `${String(pt.key).padStart(2, '0')}:00`])}
              />
            )}
          </article>

          <article className="card span-6 stack">
            <h2>Best sellers</h2>
            <BarList
              empty="No dishes sold in these days."
              rows={report.topItems.map((r) => ({ key: r.nameEn, label: r.nameEn, meta: `${r.qty} sold`, value: r.salesMinor, text: money(r.salesMinor) }))}
            />
          </article>

          <article className="card span-6 stack">
            <h2>By day of the week</h2>
            <BarList
              empty="No orders in these days."
              rows={[1, 2, 3, 4, 5, 6, 0].map((d) => report.byWeekday[d]).map((d) => ({ key: d.weekday, label: WEEKDAYS[d.weekday], meta: `${d.orders} ${d.orders === 1 ? 'order' : 'orders'}`, value: d.salesMinor, text: money(d.salesMinor) }))}
            />
          </article>

          <article className="card span-6 stack">
            <h2>How customers ordered</h2>
            <BarList
              empty="No orders in these days."
              rows={report.channels.map((r) => ({ key: r.key, label: CHANNELS[r.key] ?? r.key, meta: `${r.orders} orders · ${pct(r.salesMinor, c.salesMinor)}%`, value: r.salesMinor, text: money(r.salesMinor) }))}
            />
          </article>

          <article className="card span-6 stack">
            <h2>How customers paid</h2>
            <BarList
              empty="No orders in these days."
              rows={report.payments.map((r) => ({ key: r.key, label: METHODS[r.key] ?? r.key, meta: `${r.orders} orders · ${pct(r.salesMinor, c.salesMinor)}%`, value: r.salesMinor, text: money(r.salesMinor) }))}
            />
          </article>

          <article className="card table-wrap span-12" tabIndex={0} role="region" aria-label="Month by month">
            <h2 className="pad-h">Month by month</h2>
            <table>
              <thead><tr><th scope="col">Month</th><th scope="col">Orders</th><th scope="col">Sales</th><th scope="col">Month on month</th><th scope="col">Year on year</th></tr></thead>
              <tbody>
                {months.map((m) => {
                  const before = monthAt(m.month, 1), year = monthAt(m.month, 12);
                  return (
                    <tr key={m.month}>
                      <td>{monthName(m.month)}</td>
                      <td className="num">{m.orders}</td>
                      <td className="num">{money(m.salesMinor)}</td>
                      <td><Delta now={m.salesMinor} before={before?.salesMinor} /></td>
                      <td><Delta now={m.salesMinor} before={year?.salesMinor} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </article>

          <p className="muted small span-12">
            {report.from} to {report.to}, compared with {report.previousFrom} to {report.previousTo} and {report.lastYearFrom} to {report.lastYearTo}. Days are counted in {report.timezone} time. Sales leave out cancelled and refused orders.
          </p>
        </div>
      ) : null}
    </section>
  );
}
