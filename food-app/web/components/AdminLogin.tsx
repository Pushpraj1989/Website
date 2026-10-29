'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';

export function AdminLogin({ locale }: { locale: Locale }) {
  const s = t(locale);
  const router = useRouter();
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    const response = await fetch('/v1/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error?.message ?? s.errorGeneric);
      return;
    }
    router.push('/admin');
  }

  return (
    <form className="stack" onSubmit={submit} style={{ maxWidth: 420 }}>
      <label>
        {s.password}
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p role="alert" className="error">{error}</p> : null}
      <button type="submit" className="btn primary lg">{s.signIn}</button>
    </form>
  );
}
