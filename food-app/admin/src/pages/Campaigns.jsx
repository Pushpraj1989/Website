import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { X } from 'lucide-react';
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
// The rule's settings as short facts, so staff can check a rule at a glance.
function ruleFacts(o) {
  const money = (minor) => formatMoney(minor, DIGITS, CODE);
  const facts = [o.type === 'percent' ? `${o.value / 100}% off` : o.type === 'fixed' ? `${money(o.value)} off` : TYPES[o.type]];
  if (o.maxDiscountMinor != null) facts.push(`at most ${money(o.maxDiscountMinor)}`);
  if (o.minSubtotalMinor > 0) facts.push(`min order ${money(o.minSubtotalMinor)}`);
  if (o.audience !== 'any') facts.push(o.audience === 'member' ? 'members only' : 'guests only');
  if (o.perCustomerLimit != null) facts.push(o.perCustomerLimit === 1 ? 'once per customer' : `${o.perCustomerLimit} per customer`);
  if (o.usageLimit != null) facts.push(`${o.usedCount ?? 0} of ${o.usageLimit} used`);
  return facts;
}

/** A panel's title row. On a phone the panel is a full-screen sheet, and this row stays at the top with Close. */
function SheetHead({ id, title, onClose, children }) {
  return (
    <div className="row between sheet-head">
      <h2 id={id}>{title}</h2>
      <div className="row">
        {children}
        {onClose ? <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close"><X className="icon" aria-hidden="true" /></button> : null}
      </div>
    </div>
  );
}

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
        {selected && !creating ? <CampaignDetail key={selected} id={selected} onClose={() => setSelected(null)} onChanged={(text) => { setMessage(text); load(); }} onError={setError} /> : null}
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
    <form className="card stack" onSubmit={submit} aria-labelledby="new-campaign-title">
      <SheetHead id="new-campaign-title" title="New campaign" onClose={onCancel} />
      <div className="form-grid">
        <label className="full">Name<input name="name" required maxLength={120} /></label>
        <label>Starts<input name="startsAt" type="datetime-local" required /></label>
        <label>Ends<input name="endsAt" type="datetime-local" required /></label>
        <label>Who pays<select name="fundingSource" defaultValue="restaurant">{Object.entries(FUNDING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Budget, AED <span className="hint">optional</span><input name="budget" inputMode="decimal" placeholder="500.00" /></label>
        <label>Most vouchers <span className="hint">optional</span><input name="maxIssuance" type="number" min="1" /></label>
      </div>
      <div className="actions submit">
        <button type="submit" className="btn primary">Create as draft</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function CampaignDetail({ id, onClose, onChanged, onError }) {
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
    <div className="card stack" role="region" aria-labelledby="campaign-title">
      <SheetHead id="campaign-title" title={campaign.name} onClose={onClose}>
        <span className={`pill ${campaign.status}`}>{STATUS[campaign.status]}</span>
      </SheetHead>
      <p className="muted">{new Date(campaign.startsAt).toLocaleString()} – {new Date(campaign.endsAt).toLocaleString()} · {FUNDING[campaign.fundingSource]}{campaign.budgetMinor !== null ? ` · budget ${formatMoney(campaign.budgetMinor, DIGITS, CODE)}` : ''}</p>
      <div className="row">
        {(ACTIONS[campaign.status] ?? []).map(([action, label]) => (
          <button key={action} type="button" className={action === 'cancel' ? 'btn danger' : 'btn'} onClick={() => act(action)}>{label}</button>
        ))}
      </div>

      <h3>Rules</h3>
      {offers.length === 0 ? <p className="muted">No rules yet. Add one to start the campaign.</p> : (
        <ul className="rules">
          {offers.map((o) => (
            <li key={o.id}>
              <strong>{o.name.en}{o.code ? <> · <code>{o.code}</code></> : null}</strong>
              <ul className="facts" aria-label="Rule details">{ruleFacts(o).map((f) => <li key={f}>{f}</li>)}</ul>
            </li>
          ))}
        </ul>
      )}
      {campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'active' || campaign.status === 'paused' ? (
        <details className="disclose" open={offers.length === 0}>
          <summary>Add a rule</summary>
          <div className="body"><RuleForm campaign={campaign} onSaved={() => { load(); onChanged('Rule added.'); }} onError={onError} /></div>
        </details>
      ) : null}

      <h3>Code pools</h3>
      {pools.length === 0 ? <p className="muted">No pools yet. A pool is where codes are made for one rule.</p> : null}
      {pools.map((p) => <PoolPanel key={p.id} pool={p} offers={offers} onChanged={onChanged} onError={onError} />)}
      {offers.length > 0 ? (
        <details className="disclose" open={pools.length === 0}>
          <summary>New code pool</summary>
          <div className="body"><PoolForm campaignId={campaign.id} offers={offers} onSaved={() => { load(); onChanged('Pool created.'); }} onError={onError} /></div>
        </details>
      ) : null}
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
    const maxDiscount = type === 'percent' ? optionalMoney(f.get('maxDiscount')) : undefined;
    if (maxDiscount === null) return onError('Enter the largest discount in AED, like 20.00.');
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
        perCustomerLimit: f.get('perCustomerLimit') ? Number(f.get('perCustomerLimit')) : undefined,
        maxDiscountMinor: maxDiscount,
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
      <div className="form-grid">
        <label>Name (English)<input name="nameEn" required maxLength={80} /></label>
        <label>Name (Arabic)<input name="nameAr" required maxLength={80} dir="rtl" /></label>
        <label>Type<select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {type === 'percent' ? <label>Percent off<input name="percent" inputMode="decimal" required defaultValue={10} /></label> : null}
        {type === 'percent' ? <label>Largest discount, AED <span className="hint">optional</span><input name="maxDiscount" inputMode="decimal" placeholder="20.00" /></label> : null}
        {type === 'fixed' ? <label>Amount off, AED<input name="amount" inputMode="decimal" required defaultValue="5.00" /></label> : null}
        <label>Minimum order, AED <span className="hint">optional</span><input name="minSpend" inputMode="decimal" placeholder="30.00" /></label>
        <label>Who can use it<select name="audience" defaultValue="any"><option value="any">Everyone</option><option value="guest">Guests</option><option value="member">Members</option></select></label>
        <label>Shared code <span className="hint">optional</span><input name="code" maxLength={30} placeholder="WEEKEND10" /></label>
        <label>Uses in total <span className="hint">optional</span><input name="usageLimit" type="number" min="0" /></label>
        <label>Uses per customer <span className="hint">optional</span><input name="perCustomerLimit" type="number" min="1" max="1000" placeholder="1" /></label>
        <label>Starts<input name="startsAt" type="datetime-local" required defaultValue={toLocalInput(campaign.startsAt)} /></label>
        <label>Ends<input name="endsAt" type="datetime-local" required defaultValue={toLocalInput(campaign.endsAt)} /></label>
      </div>
      <div className="actions"><button type="submit" className="btn primary">Add rule</button></div>
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
      <div className="form-grid">
        <label>Rule<select name="offerId" required>{offers.map((o) => <option key={o.id} value={o.id}>{o.name.en}</option>)}</select></label>
        <label>Code pattern<input name="codePattern" required defaultValue="FOOD##@@" maxLength={40} aria-describedby="pattern-help" /></label>
        <label>Most codes <span className="hint">optional</span><input name="quantityLimit" type="number" min="1" /></label>
      </div>
      <p className="hint" id="pattern-help"># is a digit, @ is a letter, * is a letter or digit. Other characters are copied as they are.</p>
      <div className="actions"><button type="submit" className="btn primary">Create pool</button></div>
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

      <details className="disclose">
        <summary>Generate codes</summary>
        <form className="body" onSubmit={generate} aria-label="Generate codes">
          <div className="form-grid">
            <label>How many <span className="hint">up to 10,000</span><input name="quantity" type="number" min="1" max="10000" required /></label>
            <label>Expires<input name="expiresAt" type="datetime-local" required /></label>
            <button type="submit" className="btn primary">Generate</button>
          </div>
          <p className="hint">Large batches are made in the background; you can keep working.</p>
        </form>
      </details>

      <details className="disclose">
        <summary>Add one code</summary>
        <form className="body" onSubmit={addCode} aria-label="Add one code">
          <div className="form-grid">
            <label>Code<input name="code" required maxLength={30} placeholder="SUMMER-2026" /></label>
            <label>Expires<input name="expiresAt" type="datetime-local" required /></label>
            <button type="submit" className="btn">Add code</button>
          </div>
        </form>
      </details>
    </div>
  );
}
