import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatMoney, parseMoney } from '../money.js';

const DIGITS = 2;
const CODE = 'AED';
const STATUS = { draft: 'Draft', scheduled: 'Scheduled', active: 'Live', paused: 'Paused', completed: 'Ended', cancelled: 'Cancelled' };
// The buttons a campaign offers depend on where it is. The server checks the same rules.
const ACTIONS = {
  draft: [['activate', 'Start campaign']],
  scheduled: [['pause', 'Pause'], ['cancel', 'Cancel']],
  active: [['pause', 'Pause'], ['complete', 'End now'], ['cancel', 'Cancel']],
  paused: [['resume', 'Resume'], ['complete', 'End now'], ['cancel', 'Cancel']],
  completed: [],
  cancelled: [],
};
const TYPES = { percent: 'Percent off', fixed: 'Fixed amount off (AED)', free_delivery: 'Free delivery', item_free: 'Free item', bundle: 'Bundle' };
const FUNDING = { restaurant: 'Restaurant pays', platform: 'Platform pays', shared: 'Shared' };

const toLocalInput = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (value) => (value ? new Date(value).toISOString() : '');
const optionalMoney = (text) => (text ? parseMoney(text, DIGITS) : undefined);

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState(null);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setCampaigns((await api.campaigns()).campaigns);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="stack">
      <div className="row between">
        <h1>Campaigns</h1>
        <button type="button" className="btn primary" onClick={() => { setCreating(true); setSelected(null); setError(''); setMessage(''); }}>New campaign</button>
      </div>
      <p className="muted">A campaign groups its rules (the discounts) and its code pools. A campaign starts only once it has at least one rule.</p>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}

      <div className={creating || selected ? 'split' : undefined}>
        <div className="card table-wrap" tabIndex={0} role="region" aria-label="Campaigns">
          {!campaigns ? <p className="muted">Loading…</p> : campaigns.length === 0 ? <p className="muted">No campaigns yet.</p> : (
            <table>
              <thead>
                <tr><th scope="col">Campaign</th><th scope="col">Runs</th><th scope="col">Status</th><th scope="col"><span className="sr">Open</span></th></tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{new Date(c.startsAt).toLocaleDateString()} – {new Date(c.endsAt).toLocaleDateString()}</td>
                    <td><span className={`pill ${c.status}`}>{STATUS[c.status]}</span></td>
                    <td><button type="button" className="btn ghost" onClick={() => { setSelected(c.id); setCreating(false); setError(''); setMessage(''); }}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {creating ? <NewCampaign onSaved={(c) => { setCreating(false); setMessage(`Created ${c.name}.`); load(); setSelected(c.id); }} onCancel={() => setCreating(false)} onError={setError} /> : null}
        {selected && !creating ? <CampaignDetail key={selected} id={selected} onChanged={(text) => { setMessage(text); load(); }} onError={setError} /> : null}
      </div>
    </section>
  );
}

function NewCampaign({ onSaved, onCancel, onError }) {
  async function submit(event) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const budget = optionalMoney(f.get('budget'));
    if (budget === null) return onError('Enter the budget in AED, like 500.00.');
    try {
      const { campaign } = await api.createCampaign({
        name: f.get('name'),
        startsAt: fromLocal(f.get('startsAt')),
        endsAt: fromLocal(f.get('endsAt')),
        fundingSource: f.get('fundingSource'),
        budgetMinor: budget,
        maxIssuance: f.get('maxIssuance') ? Number(f.get('maxIssuance')) : undefined,
      });
      onSaved(campaign);
    } catch (err) {
      onError(err.message);
    }
  }
  return (
    <form className="card stack" onSubmit={submit} aria-label="New campaign">
      <h2>New campaign</h2>
      <label>Name<input name="name" required maxLength={120} /></label>
      <label>Starts<input name="startsAt" type="datetime-local" required /></label>
      <label>Ends<input name="endsAt" type="datetime-local" required /></label>
      <label>Who pays<select name="fundingSource" defaultValue="restaurant">{Object.entries(FUNDING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Budget in AED (optional)<input name="budget" inputMode="decimal" /></label>
      <label>Most vouchers to issue (optional)<input name="maxIssuance" type="number" min="1" /></label>
      <div className="row">
        <button type="submit" className="btn primary">Create as draft</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function CampaignDetail({ id, onChanged, onError }) {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api.campaign(id));
    } catch (err) {
      onError(err.message);
    }
  }, [id, onError]);

  useEffect(() => { load(); }, [load]);

  async function act(action) {
    try {
      await api.campaignAction(id, action);
      await load();
      onChanged('Campaign updated.');
    } catch (err) {
      onError(err.message);
    }
  }

  if (!data) return <div className="card"><p className="muted">Loading…</p></div>;
  const { campaign, offers, pools } = data;
  return (
    <div className="card stack">
      <div className="row between">
        <h2>{campaign.name}</h2>
        <span className={`pill ${campaign.status}`}>{STATUS[campaign.status]}</span>
      </div>
      <p className="muted">{new Date(campaign.startsAt).toLocaleString()} – {new Date(campaign.endsAt).toLocaleString()} · {FUNDING[campaign.fundingSource]}{campaign.budgetMinor !== null ? ` · budget ${formatMoney(campaign.budgetMinor, DIGITS, CODE)}` : ''}</p>
      <div className="row">
        {(ACTIONS[campaign.status] ?? []).map(([action, label]) => (
          <button key={action} type="button" className={action === 'cancel' ? 'btn danger' : 'btn'} onClick={() => act(action)}>{label}</button>
        ))}
      </div>

      <h3>Rules</h3>
      {offers.length === 0 ? <p className="muted">No rules yet.</p> : (
        <ul>{offers.map((o) => <li key={o.id}>{o.name.en} — {TYPES[o.type]}{o.code ? ` (code ${o.code})` : ''}</li>)}</ul>
      )}
      {campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'active' || campaign.status === 'paused' ? (
        <RuleForm campaign={campaign} onSaved={() => { load(); onChanged('Rule added.'); }} onError={onError} />
      ) : null}

      <h3>Code pools</h3>
      {pools.length === 0 ? <p className="muted">No pools yet. A pool is where codes are made for one rule.</p> : null}
      {pools.map((p) => <PoolPanel key={p.id} pool={p} offers={offers} onChanged={onChanged} onError={onError} />)}
      {offers.length > 0 ? <PoolForm campaignId={campaign.id} offers={offers} onSaved={() => { load(); onChanged('Pool created.'); }} onError={onError} /> : null}
    </div>
  );
}

function RuleForm({ campaign, onSaved, onError }) {
  const [type, setType] = useState('percent');
  async function submit(event) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    let value = 0;
    if (type === 'percent') {
      const pct = Number(f.get('percent'));
      if (!(pct > 0 && pct <= 100)) return onError('Enter a percentage from 0 to 100.');
      value = Math.round(pct * 100);
    } else if (type === 'fixed') {
      value = parseMoney(f.get('amount'), DIGITS);
      if (value === null || value <= 0) return onError('Enter the amount in AED, like 5.00.');
    }
    const minSpend = optionalMoney(f.get('minSpend'));
    if (minSpend === null) return onError('Enter the minimum order in AED, like 50.00.');
    try {
      await api.addCampaignRule(campaign.id, {
        name: { en: f.get('nameEn'), ar: f.get('nameAr') },
        type,
        value,
        appliesTo: 'order',
        audience: f.get('audience'),
        minSubtotalMinor: minSpend ?? 0,
        code: f.get('code') || undefined,
        usageLimit: f.get('usageLimit') ? Number(f.get('usageLimit')) : undefined,
        startsAt: fromLocal(f.get('startsAt')),
        endsAt: fromLocal(f.get('endsAt')),
      });
      event.currentTarget.reset();
      onSaved();
    } catch (err) {
      onError(err.message);
    }
  }
  return (
    <form className="stack" onSubmit={submit} aria-label="Add a rule">
      <h4>Add a rule</h4>
      <label>Name (English)<input name="nameEn" required maxLength={80} /></label>
      <label>Name (Arabic)<input name="nameAr" required maxLength={80} dir="rtl" /></label>
      <label>Type<select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      {type === 'percent' ? <label>Percent off<input name="percent" inputMode="decimal" required defaultValue={10} /></label> : null}
      {type === 'fixed' ? <label>Amount off (AED)<input name="amount" inputMode="decimal" required defaultValue="5.00" /></label> : null}
      <label>Who can use it<select name="audience" defaultValue="any"><option value="any">Everyone</option><option value="guest">Guests</option><option value="member">Members</option></select></label>
      <label>Minimum order in AED (optional)<input name="minSpend" inputMode="decimal" /></label>
      <label>Shared code (optional)<input name="code" maxLength={30} placeholder="WEEKEND10" /></label>
      <label>Uses in total (optional)<input name="usageLimit" type="number" min="0" /></label>
      <label>Starts<input name="startsAt" type="datetime-local" required defaultValue={toLocalInput(campaign.startsAt)} /></label>
      <label>Ends<input name="endsAt" type="datetime-local" required defaultValue={toLocalInput(campaign.endsAt)} /></label>
      <button type="submit" className="btn">Add rule</button>
    </form>
  );
}

function PoolForm({ campaignId, offers, onSaved, onError }) {
  async function submit(event) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api.createPool(campaignId, {
        offerId: f.get('offerId'),
        codePattern: f.get('codePattern'),
        quantityLimit: f.get('quantityLimit') ? Number(f.get('quantityLimit')) : undefined,
      });
      event.currentTarget.reset();
      onSaved();
    } catch (err) {
      onError(err.message);
    }
  }
  return (
    <form className="stack" onSubmit={submit} aria-label="New code pool">
      <h4>New code pool</h4>
      <label>Rule<select name="offerId" required>{offers.map((o) => <option key={o.id} value={o.id}>{o.name.en}</option>)}</select></label>
      <label>Code pattern<input name="codePattern" required defaultValue="FOOD##@@" maxLength={40} /></label>
      <p className="muted"># is a digit, @ is a letter, * is a letter or digit. Other characters are copied as they are.</p>
      <label>Most codes in this pool (optional)<input name="quantityLimit" type="number" min="1" /></label>
      <button type="submit" className="btn">Create pool</button>
    </form>
  );
}

function PoolPanel({ pool, offers, onChanged, onError }) {
  const [summary, setSummary] = useState(null);
  const [key, setKey] = useState(null);
  const [lastBatch, setLastBatch] = useState(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      setSummary(await api.pool(pool.id));
    } catch (err) {
      onError(err.message);
    }
  }, [pool.id, onError]);

  useEffect(() => { load(); }, [load]);

  const rule = offers.find((o) => o.id === pool.offerId);

  async function generate(event) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    // One key per attempt: a double click or a retry sends the same key, so the server makes one batch.
    const idempotencyKey = key ?? crypto.randomUUID();
    setKey(idempotencyKey);
    try {
      const { batch } = await api.createBatch(pool.id, { quantity: Number(f.get('quantity')), expiresAt: fromLocal(f.get('expiresAt')) }, idempotencyKey);
      setLastBatch(batch);
      setKey(null);
      event.currentTarget.reset();
      load();
      if (batch.status === 'completed') onChanged(`Made ${batch.generatedQuantity} codes.`);
      else finish(batch);
    } catch (err) {
      onError(err.message);
    }
  }

  // A queued batch is finished a few chunks at a time. This keeps asking until it is completed, or it fails.
  async function finish(batch) {
    setWorking(true);
    try {
      let current = batch;
      for (let i = 0; i < 500 && current.status !== 'completed' && current.status !== 'failed'; i++) {
        current = (await api.runBatch(current.id)).batch;
        onChanged(`Made ${current.generatedQuantity} of ${current.requestedQuantity} codes.`);
      }
      await load();
      if (current.status === 'completed') onChanged(`Batch complete: ${current.requestedQuantity} codes.`);
    } catch (err) {
      onError(err.message);
      await load();
    } finally {
      setWorking(false);
    }
  }

  async function download(path, name, label) {
    try {
      await api.downloadPool(pool.id, path, name);
      onChanged(`${label} downloaded. The download is recorded.`);
    } catch (err) {
      onError(err.message);
    }
  }

  async function addCode(event) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      const { voucher } = await api.addManualCode(pool.id, { code: f.get('code'), expiresAt: fromLocal(f.get('expiresAt')) });
      event.currentTarget.reset();
      load();
      onChanged(`Added code ending ${voucher.codeHint}.`);
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div className="card stack">
      <div className="row between">
        <h4>{rule ? rule.name.en : 'Rule'} · {pool.codePattern}</h4>
        <span className="muted">{pool.issuedCount}{pool.quantityLimit ? ` of ${pool.quantityLimit}` : ''} issued</span>
      </div>
      {summary ? <p className="muted">{Object.entries(summary.vouchersByStatus).map(([s, n]) => `${n} ${s}`).join(' · ') || 'No codes yet'}</p> : null}
      {lastBatch ? <p role="status" className="ok">Last batch: {lastBatch.generatedQuantity} of {lastBatch.requestedQuantity} codes, {lastBatch.status}.</p> : null}
      {summary && summary.batches.some((b) => b.status === 'queued' || b.status === 'running') ? (
        <div className="stack">
          <h5>Batches in progress</h5>
          {summary.batches.filter((b) => b.status === 'queued' || b.status === 'running').map((b) => (
            <div key={b.id} className="row between">
              <span>{b.generatedQuantity} of {b.requestedQuantity} codes made</span>
              <button type="button" className="btn primary" disabled={working} onClick={() => finish(b)}>{working ? 'Making codes…' : 'Continue making codes'}</button>
            </div>
          ))}
        </div>
      ) : null}
      {summary && summary.batches.some((b) => b.status === 'failed') ? (
        <p role="alert" className="error">A batch stopped: {summary.batches.find((b) => b.status === 'failed').errorDetails}. The codes already made are kept.</p>
      ) : null}
      <div className="row">
        <button type="button" className="btn" onClick={() => download('print?format=a4', 'vouchers-a4.pdf', 'A4 sheets')}>Print A4 sheets</button>
        <button type="button" className="btn" onClick={() => download('print?format=card', 'vouchers-cards.pdf', 'Single cards')}>Print single cards</button>
        <button type="button" className="btn ghost" onClick={() => download('export', 'voucher-codes.csv', 'Code export')}>Export codes (CSV)</button>
      </div>
      <p className="muted">Printing and exporting codes are recorded with the time and the staff session. Print only usable vouchers: revoked and expired ones are left out.</p>

      <form className="stack" onSubmit={generate} aria-label="Generate codes">
        <h5>Generate codes</h5>
        <label>How many (up to 10,000; large batches are made in the background)<input name="quantity" type="number" min="1" max="10000" required /></label>
        <label>Expires<input name="expiresAt" type="datetime-local" required /></label>
        <button type="submit" className="btn primary">Generate codes</button>
      </form>

      <form className="stack" onSubmit={addCode} aria-label="Add one code">
        <h5>Add one code</h5>
        <label>Code<input name="code" required maxLength={30} placeholder="SUMMER-2026" /></label>
        <label>Expires<input name="expiresAt" type="datetime-local" required /></label>
        <button type="submit" className="btn">Add code</button>
      </form>
    </div>
  );
}
