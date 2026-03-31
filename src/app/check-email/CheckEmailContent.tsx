'use client';

import { useEffect, useState } from 'react';

export default function CheckEmailContent({
  email,
  message,
}: {
  email: string;
  message: string;
}) {
  const [csrfToken, setCsrfToken] = useState('');
  useEffect(() => {
    fetch('/api/auth/csrf').then(r => r.json()).then(d => setCsrfToken(d.token)).catch(() => {});
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Confirm your email</h1>
      <p>
        We sent a confirmation link to <strong>{email || 'your email'}</strong>.
      </p>
      {message && <p style={{ color: 'green' }}>{message}</p>}

      <form
        method="post"
        action="/api/auth/resend"
        style={{ display: 'flex', gap: 8, marginTop: 16 }}
      >
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input
          name="email"
          type="email"
          defaultValue={email}
          placeholder="you@example.com"
          required
        />
        <button type="submit">Resend link</button>
      </form>
    </main>
  );
}
