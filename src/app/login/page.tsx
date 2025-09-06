// src/app/login/page.tsx
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  // Wrap useSearchParams usage in a Suspense boundary
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
          Loading…
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const next = searchParams.get('next') ?? '';
  const nextQS = next ? `&next=${encodeURIComponent(next)}` : '';

  return (
    <main style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Sign in</h1>
      {error && (
        <p style={{ color: 'crimson', marginTop: 8 }}>
          {decodeURIComponent(error)}
        </p>
      )}

      {/* Email/password posts to a server route that sets HttpOnly cookies */}
      <form method="post" action="/api/auth/sign-in" style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <input name="email" type="email" placeholder="you@example.com" required />
        <input name="password" type="password" placeholder="••••••••" required />
        {/* carry forward the intended destination */}
        <input type="hidden" name="next" value={next} />
        <button type="submit">Sign in</button>
      </form>

      <div style={{ margin: '16px 0', opacity: 0.6 }}>or</div>

      {/* OAuth starts on the server too */}
      <div style={{ display: 'grid', gap: 8 }}>
        <a href={`/api/auth/oauth?provider=github${nextQS}`}>Continue with GitHub</a>
        <a href={`/api/auth/oauth?provider=google${nextQS}`}>Continue with Google</a>
      </div>
    </main>
  );
}
