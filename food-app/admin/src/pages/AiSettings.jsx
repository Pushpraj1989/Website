import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// The assistant's provider, model and key. The key is typed here once and then only its last four characters show.
export default function AiSettings() {
  const [data, setData] = useState(null);
  const [provider, setProvider] = useState('openai');
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('');
  const [typedKey, setTypedKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.aiSettings().then((r) => {
      setData(r);
      if (r.settings.provider) setProvider(r.settings.provider);
      if (r.settings.model) { setModel(r.settings.model); setModels([{ id: r.settings.model, label: r.settings.model }]); }
      setEnabled(r.settings.enabled);
    }).catch((e) => setError(e.message));
  }, []);

  async function loadModels() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const r = await api.aiModels(provider, typedKey || undefined);
      setModels(r.models);
      if (!r.models.some((m) => m.id === model)) setModel(r.models[0]?.id ?? '');
      setMessage(r.models.length ? `${r.models.length} models found for this key.` : 'No chat models were found for this key.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const r = await api.saveAiSettings({ provider, model, apiKey: typedKey || undefined, enabled });
      setData({ ...data, settings: r.settings });
      setTypedKey('');
      setMessage('Saved. The key is stored encrypted and is not shown again.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="muted">{error || 'Loading…'}</p>;
  const providers = data.providers;
  const current = data.settings;

  return (
    <section className="stack">
      <h1>Assistant</h1>
      <p className="muted">
        The assistant answers customers about the restaurant, the menu, prices and their own orders, using the model you choose.
        It does not answer other questions.
      </p>
      <form className="card stack" onSubmit={save} aria-label="Assistant settings">
        <label>Provider
          <select value={provider} onChange={(e) => { setProvider(e.target.value); setModels([]); setModel(''); }}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>

        <label>Provider key
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={typedKey}
            onChange={(e) => setTypedKey(e.target.value)}
            placeholder={current.hasKey && current.provider === provider ? `Saved key ends ${current.keyHint}. Type a new one to replace it.` : 'Paste the key from the provider'}
            aria-describedby="key-help"
          />
        </label>
        <p id="key-help" className="muted">The key is sent to the provider only, stored encrypted, and never shown again. Create it in your provider's console with only the access it needs.</p>
        <div className="row">
          <button type="button" className="btn secondary" onClick={loadModels} disabled={busy || (!typedKey && !(current.hasKey && current.provider === provider))}>
            Load models
          </button>
        </div>

        <label>Model
          <select value={model} onChange={(e) => setModel(e.target.value)} disabled={models.length === 0}>
            {models.length === 0 ? <option value="">Load the models first</option> : null}
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>

        <label className="choice"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Switch the assistant on for customers</label>

        {message ? <p role="status" className="ok">{message}</p> : null}
        {error ? <p role="alert" className="error">{error}</p> : null}

        <div className="row">
          <button type="submit" className="btn primary" disabled={busy || !model} aria-busy={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <span className="muted">Current: {current.enabled ? 'on' : 'off'}{current.model ? `, ${current.model}` : ''}{current.keyHint ? `, key …${current.keyHint.replace('…', '')}` : ''}</span>
        </div>
      </form>
    </section>
  );
}
