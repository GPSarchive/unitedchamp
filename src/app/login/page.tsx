'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="fallback">
          Loading…
          <style jsx>{`
            .fallback {
              max-width: 360px;
              margin: 4rem auto;
              font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
              color: #e5e7eb;
            }
          `}</style>
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

  // --- Sports backgrounds (switchable via ?bg=track|court|stadium|soccer|cycling|tennis) ---
  const bgParam = (searchParams.get('bg') || 'track').toLowerCase();
  const bgMap: Record<string, string> = {
    track:
      "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=1960&auto=format&fit=crop",
    court:
      "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=1960&auto=format&fit=crop", // basketball court
    stadium:
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1960&auto=format&fit=crop", // stadium lights
    soccer:
      "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=1960&auto=format&fit=crop",
    cycling:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1960&auto=format&fit=crop",
    tennis:
      "https://images.unsplash.com/photo-1503428593586-e225b39bddfe?q=80&w=1960&auto=format&fit=crop",
  };
  const bgUrl = bgMap[bgParam] || bgMap.track;

  return (
    <div className="page">
      <div className="bg" aria-hidden style={{ ['--bg-url' as any]: `url('${bgUrl}')` }} />

      {/* Quick theme switcher */}
      <div className="themes">
        {['track','court','stadium','soccer','cycling','tennis'].map((key) => (
          <a key={key} className={`chip ${bgParam===key? 'active':''}`} href={`?bg=${key}${next ? `&next=${encodeURIComponent(next)}` : ''}`}>
            {key}
          </a>
        ))}
      </div>

      <main className="card" role="main">
        <header className="header">
          <div className="logo">🏃‍♂️</div>
          <h1>Sign in</h1>
          <p className="sub">Welcome back</p>
        </header>

        {error && (
          <p className="error" role="alert">{decodeURIComponent(error)}</p>
        )}

        {/* Email/password posts to a server route that sets HttpOnly cookies */}
        <form method="post" action="/api/auth/sign-in" className="form">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" required />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="••••••••" required />

          {/* carry forward the intended destination */}
          <input type="hidden" name="next" value={next} />

          <button type="submit" className="btn primary">Sign in</button>
        </form>

        <div className="divider" aria-hidden>or</div>

        {/* OAuth starts on the server too */}
        <div className="oauth">
          <a className="btn ghost" href={`/api/auth/oauth?provider=google${nextQS}`}>
            <svg
              aria-hidden
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 48 48"
              className="icon"
            >
              <path d="M44.5 20H24v8.5h11.8C34.4 32.9 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.1-2.3-.5-4z" fill="#FFC107"/>
              <path d="M6.3 14.7l7 5.1C14.9 16.3 19.1 12 24 12c3.1 0 5.9 1.2 8 3.1l6-6C34.6 5.1 29.6 3 24 3 16 3 8.8 7.6 6.3 14.7z" fill="#FF3D00"/>
              <path d="M24 45c5.4 0 10.4-2.1 14.1-5.6l-6.5-5.3C29.4 36 26.9 37 24 37c-6 0-10.9-4.1-12.3-9.6l-7.2 5.6C7.9 40.4 15.4 45 24 45z" fill="#4CAF50"/>
              <path d="M44.5 20H24v8.5h11.8c-.6 2.9-2.4 5.4-4.9 7.1l6.5 5.3c-.5.5 7.6-5 7.6-16.9 0-1.3-.1-2.3-.5-4z" fill="#1976D2"/>
            </svg>
            Continue with Google
          </a>
        </div>
      </main>

      <footer className="foot">
        <p>
          By signing in you agree to our <a href="#">Terms</a> &amp; <a href="#">Privacy</a>.
        </p>
      </footer>

      <style jsx>{`
        :global(html, body, #__next) { height: 100%; }
        .page {
          position: relative;
          min-height: 100vh;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
          color: #e5e7eb; /* gray-200 */
          overflow: hidden;
        }

        /* Sporty background: layered images + gradients */
        .bg {
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(1200px 600px at 70% 10%, rgba(34,197,94,0.18), transparent 60%),
            radial-gradient(1200px 600px at 20% 90%, rgba(59,130,246,0.18), transparent 60%),
            linear-gradient(180deg, rgba(3,7,18,0.9), rgba(3,7,18,0.9)),
            var(--bg-url);
          background-size: cover, cover, cover, cover;
          background-position: center, center, center, center;
          filter: saturate(1.1) contrast(1.05);
          transform: scale(1.05);
          z-index: -2;
        }

        /* Subtle animated grid overlay for a sporty-tech feel */
        .bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 40px 40px, 40px 40px;
          mask-image: radial-gradient(circle at 50% 50%, rgba(0,0,0,0.7), transparent 70%);
          animation: drift 18s linear infinite;
          pointer-events: none;
        }

        @keyframes drift {
          from { transform: translateY(0); }
          to { transform: translateY(-40px); }
        }

        .themes {
          position: fixed;
          right: 16px;
          top: 16px;
          display: flex;
          gap: 8px;
          z-index: 10;
        }
        .chip {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(2,6,23,0.55);
          border: 1px solid rgba(255,255,255,0.18);
          text-decoration: none;
          color: #e5e7eb;
          font-size: 12px;
          backdrop-filter: blur(6px);
          transition: background 150ms ease, transform 120ms ease, border-color 120ms ease;
        }
        .chip:hover { background: rgba(2,6,23,0.75); transform: translateY(-1px); border-color: rgba(255,255,255,0.35); }
        .chip.active { background: linear-gradient(90deg, rgba(34,197,94,0.85), rgba(59,130,246,0.85)); border: none; }

        .card {
          width: 100%;
          max-width: 420px;
          margin: 8vh auto 2rem;
          padding: 24px;
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 10px 40px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.04);
          backdrop-filter: blur(10px) saturate(120%);
          border-radius: 18px;
        }

        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { margin: 0.25rem 0 0; font-size: 1.75rem; letter-spacing: 0.2px; }
        .sub { margin: 4px 0 0; opacity: 0.7; font-size: 0.95rem; }
        .logo { font-size: 1.5rem; line-height: 1; }

        .error {
          margin: 10px 0 0;
          color: #fca5a5; /* red-300 */
          background: rgba(220, 38, 38, 0.12);
          border: 1px solid rgba(220, 38, 38, 0.35);
          padding: 8px 10px;
          border-radius: 10px;
        }

        .form {
          display: grid;
          gap: 10px;
          margin-top: 16px;
        }
        .form label {
          font-size: 0.85rem;
          opacity: 0.8;
        }
        .form input[type='email'],
        .form input[type='password']{
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(2,6,23,0.6);
          color: #e5e7eb;
          outline: none;
          transition: box-shadow 150ms ease, border-color 150ms ease, transform 120ms ease;
        }
        .form input::placeholder { color: #9ca3af; }
        .form input:focus {
          border-color: rgba(59,130,246,0.7);
          box-shadow: 0 0 0 4px rgba(59,130,246,0.25);
          transform: translateY(-1px);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(15,23,42,0.6);
          color: #e5e7eb;
          text-decoration: none;
          cursor: pointer;
          transition: transform 140ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
          will-change: transform;
        }
        .btn:focus-visible { outline: 3px solid rgba(34,197,94,0.6); outline-offset: 2px; }
        .btn:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.35); box-shadow: 0 10px 24px rgba(0,0,0,0.35); }
        .btn:active { transform: translateY(0); box-shadow: none; }

        .primary {
          background: linear-gradient(90deg, rgba(34,197,94,0.85), rgba(59,130,246,0.85));
          border: none;
        }
        .primary:hover { box-shadow: 0 10px 24px rgba(59,130,246,0.35), 0 10px 24px rgba(34,197,94,0.25); }

        .ghost { background: rgba(2,6,23,0.55); }
        .ghost:hover { background: rgba(2,6,23,0.75); }

        .divider {
          margin: 16px 0;
          text-align: center;
          opacity: 0.7;
          position: relative;
        }
        .divider::before, .divider::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 40%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28));
        }
        .divider::after { right: 0; transform: translateY(-50%) rotate(180deg); }
        .divider::before { left: 0; transform: translateY(-50%); }

        .oauth { display: grid; gap: 8px; }
        .icon { filter: drop-shadow(0 1px 0 rgba(0,0,0,0.4)); }

        .foot { text-align: center; margin: 18px 0 32px; font-size: 0.85rem; opacity: 0.75; }
        .foot a { color: #93c5fd; }

        @media (max-width: 480px) {
          .card { margin: 10vh 16px 2rem; padding: 18px; }
        }
      `}</style>
    </div>
  );
}
