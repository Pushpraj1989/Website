import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// Partner integrations: the apps that may issue vouchers for this restaurant. A key is shown once, when it is made or
// rotated. Partners only get the scopes and campaigns ticked here.
const SCOPES = {
  'vouchers:issue': 'Issue vouchers and batches',
  'vouchers:read': 'Read batch status',
  'codes:export': 'Read the codes they issued',
  'vouchers:validate': 'Check a code without using it',
  'campaigns:read': 'Read their campaigns and rules',
};

export default function Partners() {
  const [partners, setPartners] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [issued, setIssued] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, camps] = await Promise.all([api.partners(), api.campaigns()]);
      setPartners(list.partners);
      setCampaigns(camps.campaigns);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const scopes = Object.keys(SCOPES).filter((s) => f.get(`scope:${s}`));
    const campaignIds = campaigns.map((c) => c.id).filter((id) => f.get(`campaign:${id}`));
    try {
      const result = await api.createPartner({
        name: f.get('name'),
        scopes,
        campaignIds,
        dailyIssueLimit: Number(f.get('dailyIssueLimit')),
        requestsPerMinute: Number(f.get('requestsPerMinute')),
      });
      setIssued({ name: result.client.name, apiKey: result.apiKey });
      event.currentTarget.reset();
      setMessage('Partner created. Copy the key now: it is not shown again.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function rotate(p) {
    try {
      const result = await api.rotatePartnerKey(p.id);
      setIssued({ name: p.name, apiKey: result.apiKey });
      setMessage('A new key was made. The old key stopped working.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function revoke(p) {
    try {
      await api.revokePartner(p.id);
      setMessage(`${p.name} can no longer call the API.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="stack">
      <div className="row between">
        <h1>Partners</h1>
      </div>
      <p className="muted">Partner apps can issue vouchers from the campaigns you give them. They can never set a discount: the campaign sets it.</p>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      {issued ? (
        <div className="card stack" role="status" aria-label="New partner key">
          <h2>Key for {issued.name}</h2>
          <code className="key" style={{ wordBreak: 'break-all' }}>{issued.apiKey}</code>
          <div className="row">
            <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(issued.apiKey).catch(() => {})}>Copy key</button>
            <button type="button" className="btn ghost" onClick={() => setIssued(null)}>I have copied it</button>
          </div>
        </div>
      ) : null}

      <div className="card table-wrap" tabIndex={0} role="region" aria-label="Partners">
        {!partners ? <p className="muted">Loading…</p> : partners.length === 0 ? <p className="muted">No partners yet.</p> : (
          <table>
            <thead><tr><th scope="col">Partner</th><th scope="col">Permissions</th><th scope="col">Campaigns</th><th scope="col">Limits</th><th scope="col">Status</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.scopes.map((s) => SCOPES[s] ?? s).join(', ') || '—'}</td>
                  <td>{p.campaignIds.length}</td>
                  <td>{p.dailyIssueLimit} codes a day · {p.requestsPerMinute} requests a minute</td>
                  <td>{p.status === 'active' ? 'Active' : 'Revoked'}</td>
                  <td>
                    {p.status === 'active' ? (
                      <div className="row">
                        <button type="button" className="btn ghost" onClick={() => rotate(p)}>New key</button>
                        <button type="button" className="btn danger" onClick={() => revoke(p)}>Revoke</button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form className="card stack" onSubmit={create} aria-label="New partner">
        <h2>New partner</h2>
        <div className="form-grid">
          <label>Name<input name="name" required maxLength={120} /></label>
          <label>Most codes a day<input name="dailyIssueLimit" type="number" min="0" defaultValue="1000" required /></label>
          <label>Most requests a minute<input name="requestsPerMinute" type="number" min="1" defaultValue="60" required /></label>
        </div>
        <fieldset className="choices">
          <legend>Permissions</legend>
          {Object.entries(SCOPES).map(([s, label]) => (
            <label key={s} className="choice"><input type="checkbox" name={`scope:${s}`} defaultChecked={s !== 'codes:export'} /> {label}</label>
          ))}
        </fieldset>
        <fieldset className="choices">
          <legend>Campaigns they may issue from</legend>
          {campaigns.length === 0 ? <p className="muted">Create a campaign first.</p> : campaigns.map((c) => (
            <label key={c.id} className="choice"><input type="checkbox" name={`campaign:${c.id}`} /> {c.name}</label>
          ))}
        </fieldset>
        <div className="actions"><button type="submit" className="btn primary">Create partner and key</button></div>
      </form>
    </section>
  );
}
