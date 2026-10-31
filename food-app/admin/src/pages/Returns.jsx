import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatMoney, parseMoney } from '../money.js';

const DIGITS = 2;
const STATUS = { requested: 'Waiting for you', approved: 'Approved · pay back', rejected: 'Rejected', refunded: 'Refunded' };
const TONE = { requested: 'scheduled', approved: 'live', rejected: 'rejected', refunded: 'done' };

/**
 * Return requests from customers (shops). Open ones first. Approve with the refund (the items' price by default) and
 * whether the items go back into stock; card orders are refunded to the card at once, others are paid back by hand
 * and confirmed here. Reject with a short note the customer sees.
 */
export default function Returns() {
  const [returns, setReturns] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setReturns((await api.returns()).returns);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(action, done) {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(done);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const open = (returns ?? []).filter((r) => r.status === 'requested').length;
  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <h1>Returns</h1>
          <p className="muted">{returns === null ? 'Loading…' : open ? `${open} waiting for a decision.` : 'Nothing waiting.'} The return window is set under Business and look.</p>
        </div>
      </div>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      {returns && returns.length === 0 ? <div className="card"><p className="muted">No return requests yet.</p></div> : null}
      {(returns ?? []).map((r) => (
        <article key={r.id} className="card stack">
          <div className="row between">
            <strong>Order {r.orderNumber}</strong>
            <span className={`status ${TONE[r.status]}`}>{STATUS[r.status]}</span>
          </div>
          <ul className="plain">
            {r.lines.map((l) => <li key={l.lineId}>{l.qty} × {l.name.en} · {formatMoney(l.unitMinor * l.qty, DIGITS, r.currency)}</li>)}
          </ul>
          <p><span className="muted">Reason:</span> {r.reason}</p>
          {r.refundMinor !== null ? <p className="muted">Refund {formatMoney(r.refundMinor, DIGITS, r.currency)}{r.refundMethod === 'card' ? ' to the card' : r.refundMethod === 'manual' ? ' by cash or transfer' : ''}{r.restocked ? ' · back in stock' : ''}</p> : null}
          {r.staffNote ? <p className="muted">Note: {r.staffNote}</p> : null}
          {r.status === 'requested' ? <Decide item={r} onApprove={(body) => run(() => api.decideReturn(r.id, { decision: 'approve', ...body }), `Return for order ${r.orderNumber} approved.`)} onReject={(note) => run(() => api.decideReturn(r.id, { decision: 'reject', note }), `Return for order ${r.orderNumber} rejected.`)} /> : null}
          {r.status === 'approved' ? (
            <div className="actions"><button type="button" className="btn primary sm" onClick={() => run(() => api.markReturnRefunded(r.id), `Order ${r.orderNumber}: refund paid.`)}>I have paid it back</button></div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function Decide({ item, onApprove, onReject }) {
  const [refund, setRefund] = useState((item.itemsMinor / 100).toFixed(DIGITS));
  const [restock, setRestock] = useState(true);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  return (
    <div className="stack">
      <div className="form-grid">
        <label>Refund, {item.currency}<input value={refund} inputMode="decimal" onChange={(e) => setRefund(e.target.value)} /></label>
        <label className="choice"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put the items back in stock</label>
        <label>Note for the customer <span className="hint">needed to reject</span><input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
      </div>
      {problem ? <p role="alert" className="error">{problem}</p> : null}
      <div className="actions">
        <button type="button" className="btn primary sm" onClick={() => {
          const minor = parseMoney(refund, DIGITS);
          if (minor === null) return setProblem('Enter the refund like 90.00.');
          setProblem('');
          onApprove({ refundMinor: minor, restock, note });
        }}>Approve return</button>
        <button type="button" className="btn danger sm" onClick={() => {
          if (note.trim().length < 3) return setProblem('Add a short note saying why, for the customer.');
          setProblem('');
          onReject(note.trim());
        }}>Reject</button>
      </div>
    </div>
  );
}
