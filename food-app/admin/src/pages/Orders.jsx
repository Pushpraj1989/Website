import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatMoney } from '../money.js';

const DIGITS = 2;
const SOUND_KEY = 'kitchen-sound';

// The order each step moves to next. The server checks every move; this only chooses the button to show.
function nextStatus(order) {
  switch (order.status) {
    case 'accepted': return { to: 'preparing', label: 'Start preparing' };
    case 'preparing': return { to: 'ready', label: 'Mark ready' };
    case 'ready': return order.channel === 'delivery' ? { to: 'out_for_delivery', label: 'Out for delivery' } : { to: 'collected', label: 'Collected' };
    case 'out_for_delivery': return { to: 'delivered', label: 'Delivered' };
    default: return null;
  }
}

// New orders need attention (accent); orders in the kitchen or on the way are live (green); finished ones are quiet;
// cancelled and rejected ones are red, so they never read as a success.
function statusTone(status) {
  if (status === 'placed') return 'scheduled';
  if (status === 'cancelled' || status === 'rejected') return status;
  if (status === 'delivered' || status === 'collected') return 'done';
  return 'live';
}

const STATUS_TEXT = {
  placed: 'New', awaiting_payment: 'Awaiting payment', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', collected: 'Collected', cancelled: 'Cancelled', rejected: 'Rejected',
};

// A short two-tone chime made in the browser, so no audio file is needed.
function chime(context) {
  const now = context.currentTime;
  [880, 660].forEach((freq, i) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.25 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.22);
    osc.connect(gain).connect(context.destination);
    osc.start(now + i * 0.25);
    osc.stop(now + i * 0.25 + 0.24);
  });
}

// The kitchen board. New orders arrive over the staff stream; the list refreshes and a chime sounds when the
// kitchen has turned sound on (browsers only allow sound after a click, so the switch is a button).
export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; } });
  const [etas, setEtas] = useState({});
  const audio = useRef(null);
  const soundRef = useRef(sound);

  const load = useCallback(async () => {
    try {
      setOrders((await api.orders()).orders);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { soundRef.current = sound; }, [sound]);

  // One connection while this page is open. The browser reconnects by itself if the network drops.
  useEffect(() => {
    const source = new EventSource('/v1/admin/orders/stream');
    source.addEventListener('order', (event) => {
      const order = JSON.parse(event.data);
      setBanner(`New order ${order.number}`);
      load();
      if (soundRef.current && audio.current) chime(audio.current);
    });
    return () => source.close();
  }, [load]);

  async function toggleSound() {
    const next = !sound;
    if (next) {
      audio.current = audio.current || new (window.AudioContext || window.webkitAudioContext)();
      await audio.current.resume();
      chime(audio.current);
    }
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* the switch still works for this visit */ }
  }

  async function act(order, action) {
    setError('');
    try {
      if (action === 'accept') await api.acceptOrder(order.id, Number(etas[order.id] ?? 25));
      else await api.setOrderStatus(order.id, action);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!orders && !error) return <p className="muted">Loading orders…</p>;

  // Waiting orders first, then the rest by time. Each row says what the kitchen does next.
  const sorted = orders ? [...orders].sort((a, b) => (a.status === 'placed' ? 0 : 1) - (b.status === 'placed' ? 0 : 1) || new Date(b.createdAt) - new Date(a.createdAt)) : [];
  const waiting = sorted.filter((o) => o.status === 'placed').length;

  return (
    <section className="stack">
      <header className="toolbar">
        <div>
          <h1>Orders</h1>
          <p className="muted">{waiting === 0 ? 'No orders waiting for you.' : `${waiting} waiting to be accepted.`}</p>
        </div>
        <button type="button" className={`pill ${sound ? 'on' : 'off'}`} aria-pressed={sound} onClick={toggleSound}>
          {sound ? 'Sound on' : 'Sound off'}
        </button>
      </header>
      {banner ? (
        <div className="card" role="status" style={{ borderColor: 'var(--accent)' }}>
          <strong>{banner}</strong>
          <button type="button" className="btn ghost sm" onClick={() => setBanner('')}>Dismiss</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      {orders && orders.length === 0 ? (
        <div className="card"><p>No orders yet. New orders appear here as soon as they are placed.</p></div>
      ) : null}
      {orders && orders.length > 0 ? (
        <div className="card table-wrap" tabIndex={0} role="region" aria-label="Orders">
          <table>
            <thead>
              <tr><th scope="col">Order</th><th scope="col">Channel</th><th scope="col">Status</th><th scope="col">Items</th><th scope="col">Address</th><th scope="col">Total</th><th scope="col">Next</th></tr>
            </thead>
            <tbody>
              {sorted.map((o) => {
                const next = nextStatus(o);
                return (
                  <tr key={o.id}>
                    <td><strong>{o.number}</strong></td>
                    <td>{o.channel === 'delivery' ? 'Delivery' : 'Pickup'}</td>
                    <td><span className={`status ${statusTone(o.status)}`}>{STATUS_TEXT[o.status] ?? o.status}</span>{o.etaMinutes ? <span className="muted"> · {o.etaMinutes} min</span> : null}</td>
                    <td>{o.lines.map((l) => `${l.qty} × ${l.name?.en ?? ''}`).join(', ')}</td>
                    <td>{o.address ?? '—'}</td>
                    <td className="num">{formatMoney(o.total, DIGITS, o.currency)}</td>
                    <td>
                      {o.status === 'placed' ? (
                        <div className="actions">
                          <label>Minutes
                            <input type="number" min={5} max={180} value={etas[o.id] ?? 25} onChange={(e) => setEtas({ ...etas, [o.id]: e.target.value })} style={{ width: 72 }} />
                          </label>
                          <button type="button" className="btn primary sm" onClick={() => act(o, 'accept')}>Accept order {o.number}</button>
                        </div>
                      ) : next ? (
                        <button type="button" className="btn sm" onClick={() => act(o, next.to)}>{next.label}</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
