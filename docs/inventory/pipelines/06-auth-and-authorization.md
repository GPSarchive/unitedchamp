# Pipeline 06 — Authentication & authorization

> **2026-09-14:** the verified role matrix and open findings now live in [docs/roles-and-permissions.md](../../roles-and-permissions.md); the admin audit trail is described in [docs/audit-log.md](../../audit-log.md). The `requireAdmin`/`requireEditor` note below still applies.

**One-line summary:** Supabase Auth handles identity (email + password, Google OAuth). The `admin` role lives in `auth.users.app_metadata.roles`. Form posts are protected by CSRF + per-email rate limits. Sessions are cookie-bound and refreshed by middleware.

---

## Routes — UI entry points

- `/login` ([page.tsx](../../../src/app/login/page.tsx)) — form-posts to `/api/auth/sign-in`, OAuth via link
- `/sign-up` ([page.tsx](../../../src/app/sign-up/page.tsx)) — form-posts to `/api/auth/sign-up`
- `/check-email` ([page.tsx](../../../src/app/check-email/page.tsx)) — confirmation reminder
- `/dashboard/*` — gated by [`dashboard/layout.tsx`](../../../src/app/dashboard/layout.tsx) (redirects to `/login` or `/403`)

## API endpoints

- `GET /api/auth/csrf` — mint CSRF token
- `POST /api/auth/sign-in` — CSRF + per-email rate limit
- `POST /api/auth/sign-up` — CSRF + password validation
- `POST /api/auth/sign-out` (+ GET delegate)
- `POST /api/auth/refresh` — rotate session cookies
- `GET /api/auth/oauth?provider=google|github`
- `GET /api/auth/callback` — OAuth code exchange
- `GET /api/auth/confirm` — email confirm/recovery/magic link
- `POST /api/auth/resend` — re-send confirmation email
- `GET /api/me` — current user (uses legacy auth-helpers — see [cleanup-candidates.md](../cleanup-candidates.md))
- `POST /api/admin/users/[id]/roles` — admin toggle

## Middleware

[`src/proxy.ts`](../../../src/proxy.ts) does:
- CSP nonce header (`x-nonce`)
- Rate limiting tiers (`@vercel/kv`)
- Bot exemption (search + social crawlers)
- **Supabase session refresh** via `@supabase/ssr`

## Lib / utilities

| File | Purpose |
|---|---|
| [`lib/csrf.ts`](../../../src/app/lib/csrf.ts) | HttpOnly `__csrf` cookie (1h TTL); generate + validate |
| [`lib/safe-redirect.ts`](../../../src/app/lib/safe-redirect.ts) | `safeNextUrl` — open-redirect protection |
| [`lib/password-validation.ts`](../../../src/app/lib/password-validation.ts) | Server-side password rules |
| [`lib/rate-limit.ts`](../../../src/app/lib/rate-limit.ts) | Vercel KV rate limiter; per-email auth limit = 5/15min, resend = 3/hour |
| [`lib/supabase/apiAuth.ts`](../../../src/app/lib/supabase/apiAuth.ts) | `requireAuth` / `requireAdmin` helpers |
| [`lib/supabase/{supabaseServer,supabaseAdmin,supabaseBrowser}.ts`](../../../src/app/lib/supabase/) | Client variants |

## Admin gating

Every admin-only route handler does roughly:

```ts
const supa = await createSupabaseRouteClient();
const { data: { user } } = await supa.auth.getUser();
const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
if (!user || !roles.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

The helper `requireAdmin()` exists for this, but 5+ routes inline it.

## Known issues

1. **Hardcoded `BASE_URL`** in `/api/auth/oauth/route.ts` — use env.
2. **`/api/me`** uses legacy `@supabase/auth-helpers-nextjs` while everything else moved to `@supabase/ssr`.
3. **Inlined `requireAdmin` in upload routes** — consolidate to `apiAuth.ts`.
4. **`safeNextUrl` fallback is `/home`** but `/home` redirects to `/` — redundant. Change fallback to `/` directly.
5. **Filename `src/proxy.ts`** — not the Next.js convention (`middleware.ts`). Confirm wiring.
6. **CSRF only on form posts** — JSON API endpoints rely on same-origin guard (`ALLOWED_ORIGINS` env). Document this trade-off.
