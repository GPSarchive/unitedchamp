// src/app/sign-up/page.tsx
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SignUpPage() {
  // Wrap the hook usage in Suspense
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
          Loading…
        </main>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}

function SignUpContent() {
  const sp = useSearchParams();
  const error = sp.get('error');
  const email = sp.get('email') ?? '';

  return (
    <main style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Create your account</h1>
      {error && <p style={{ color: 'crimson' }}>{decodeURIComponent(error)}</p>}
      <form method="post" action="/api/auth/sign-up" style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <input name="email" type="email" placeholder="you@example.com" defaultValue={email} required />
        <input name="password" type="password" placeholder="Password" required minLength={6} />
        <input name="passwordConfirm" type="password" placeholder="Confirm password" required minLength={6} />
        <button type="submit">Sign up</button>
      </form>
    </main>
  );
}
