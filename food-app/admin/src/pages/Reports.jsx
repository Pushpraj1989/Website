import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatMoney } from '../money.js';

// Promotion reports: what was issued and used, what it cost and who paid, partner use, failed batches, and whether the
// records agree with each other. Nothing here is a separate total: every figure is counted from the records.
const money = (minor) => formatMoney(minor, 2, 'AED');

export default function Reports() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setReport(await api.promotionReport());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!report) return <section className="stack"><h1>Promotion reports</h1>{error ? <p role="alert" className="error">{error}</p> : <p className="muted">Loading…</p>}</section>;
  const s = report.summary;

  return (
    <section className="stack">
      <div className="row between">
        <h1>Promotion reports</h1>
        <div className="row">
          <button type="button" className="btn" onClick={load}>Refresh</button>
          <button type="button" className="btn ghost" onClick={() => api.downloadPromotionCsv().catch((err) => setError(err.message))}>Download campaigns (CSV)</button>
        </div>
      </div>
      {error ? <p role="alert" className="error">{error}</p> : null}

      <div className="row" role="list" aria-label="Summary">
        {[['Issued', s.issued], ['Still usable', s.available], ['Used', s.redeemed], ['Expired', s.expired], ['Revoked', s.revoked], ['Discount given', money(s.discountMinor)]].map(([label, value]) => (
          <div key={label} className="card" role="listitem"><div className="muted">{label}</div><strong style={{ fontSize: 22 }}>{value}</strong></div>
        ))}
      </div>

      <p role="status" className={report.reconciled ? 'ok' : 'error'}>
        {report.reconciled ? 'The records agree with each other.' : 'Some records do not agree. See the checks below before you rely on these figures.'}
      </p>

      <div className="card table-wrap" tabIndex={0} role="region" aria-label="Campaigns">
        <table>
          <thead><tr><th scope="col">Campaign</th><th scope="col">Paid by</th><th scope="col">Issued</th><th scope="col">Used</th><th scope="col">Rate</th><th scope="col">Discount given</th><th scope="col">Expired</th><th scope="col">Revoked</th></tr></thead>
          <tbody>
            {report.campaigns.length === 0 ? <tr><td colSpan={8} className="muted">No campaigns yet.</td></tr> : report.campaigns.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong><div className="muted">{c.status}</div></td>
                <td>{c.fundedBy}</td><td>{c.issued}</td><td>{c.redeemed}</td>
                <td>{c.redemptionRate === null ? '—' : `${c.redemptionRate}%`}</td>
                <td>{money(c.discountMinor)}</td><td>{c.expired}</td><td>{c.revoked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap" tabIndex={0} role="region" aria-label="Partners">
        <h2>Partners (last 30 days)</h2>
        {report.partners.length === 0 ? <p className="muted">No partners yet.</p> : (
          <table>
            <thead><tr><th scope="col">Partner</th><th scope="col">Codes requested</th><th scope="col">Requests</th><th scope="col">Refused</th><th scope="col">Checks</th><th scope="col">Last request</th></tr></thead>
            <tbody>
              {report.partners.map((p) => (
                <tr key={p.id}><td>{p.name}{p.status === 'revoked' ? ' (revoked)' : ''}</td><td>{p.codesRequested}</td><td>{p.requests}</td><td>{p.refused}</td><td>{p.validations}</td><td>{p.lastRequest ? new Date(p.lastRequest).toLocaleString() : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card stack">
        <h2>Checks</h2>
        <ul>{report.reconciliation.map((c) => <li key={c.name}>{c.count === 0 ? 'OK' : `${c.count} to look at`} — {c.meaning}</li>)}</ul>
        <h2>Batches that stopped</h2>
        {report.failedBatches.length === 0 ? <p className="muted">None.</p> : (
          <ul>{report.failedBatches.map((b) => <li key={b.id}>{b.campaign}: {b.generated} of {b.requested} codes made. {b.reason}</li>)}</ul>
        )}
      </div>
    </section>
  );
}
