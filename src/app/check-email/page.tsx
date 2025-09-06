// src/app/check-email/page.tsx
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CheckEmailPage() {
  // Wrap any use of useSearchParams in a Suspense boundary
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui' }}>
          Loading…
        </main>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}

function CheckEmailContent() {
  const sp = useSearchParams();
  const email = sp.get('email') ?? '';
  const message = sp.get('msg');

  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Confirm your email</h1>
      <p>
        We sent a confirmation link to <strong>{email || 'your email'}</strong>.
      </p>
      {message && <p style={{ color: 'green' }}>{decodeURIComponent(message)}</p>}

      <form
        method="post"
        action="/api/auth/resend"
        style={{ display: 'flex', gap: 8, marginTop: 16 }}
      >
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
