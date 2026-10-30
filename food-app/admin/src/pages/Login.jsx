import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ brand, onSignedIn }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.signIn(new FormData(event.currentTarget).get('password'));
      await onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card stack" onSubmit={submit}>
        {brand ? (
          <div className="brand">{brand.logoUrl ? <img className="brand-logo" src={brand.logoUrl} alt="" /> : null}<span>{brand.name.en}</span></div>
        ) : null}
        <h1>Staff sign-in</h1>
        <p className="muted">Sign in to manage the menu, pictures and offers.</p>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error ? <p role="alert" className="error">{error}</p> : null}
        <button type="submit" className="btn primary block" disabled={busy} aria-busy={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
