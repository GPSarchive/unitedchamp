# Rate limiting: repair & setup guide

_Last verified: 2026-07-10 (Session 7). Docs current as of Vercel docs updated 2026-01._

## What's broken and why

Every request to the site passes through `src/proxy.ts`, which enforces multi-layer rate
limits (global / per-IP / per-endpoint / per-write / daily / auth brute-force) via
`src/app/lib/rate-limit.ts`, backed by **Vercel KV** through the `@vercel/kv` package.

**Vercel KV no longer exists as a product.** Vercel sunset it and auto-migrated stores to
Upstash Redis (December 2024); Redis is now provisioned through the Vercel Marketplace
instead. Our store's REST host (`united-toucan-12980.upstash.io`, from the old
`KV_REST_API_URL`) **no longer resolves** — the store is gone.

Observed impact (verified locally with a production build):

- `checkLimit()` throws on every call and **fails open** → rate limiting is silently OFF
  in production. Nothing is ever throttled — including login brute-force attempts against
  `/api/auth/*`.
- Every page/API request pays 2–3 dead Redis round-trips and logs
  `Rate limit error: TypeError: fetch failed … ENOTFOUND united-toucan-12980.upstash.io`.

The code itself needs **no changes**: `@vercel/kv@^3` talks to any Upstash Redis REST
endpoint and reads `KV_REST_API_URL` + `KV_REST_API_TOKEN` — which is exactly what the
new Marketplace integration injects. We only need a live store and fresh env vars.

Also note two built-in behaviors of `rate-limit.ts:26`:
- If `KV_REST_API_URL` is **unset**, every check short-circuits to "allow" cleanly
  (no errors, no network calls).
- In `NODE_ENV=development` (i.e. `next dev`) limits are always skipped. Local
  `next start` runs as production and WILL hit KV if the env var is set.

---

## Option A (recommended): new Upstash Redis via the Vercel Marketplace

1. **Vercel dashboard → your project (`unitedchamp`) → Storage tab.**
   First check whether a migrated store already exists here (it would appear as
   "Upstash for Redis"). If one exists but is broken/unlinked, remove it — a dead
   link keeps stale env vars around.
2. Click **Create Database** (or Browse Marketplace) → choose **Upstash** → product
   **Upstash for Redis** (sometimes listed as "Upstash KV").
3. Configure:
   - **Region**: pick the region closest to the Vercel deployment region (defaults are
     fine; lower latency = lower per-request overhead since the proxy awaits these
     calls before rendering).
   - **Plan**: the free tier is fine for this traffic; it can be upgraded in place.
4. **Connect it to the project** when prompted (select the `unitedchamp` project, all
   environments). This injects the env vars into the project — the important two:
   - `KV_REST_API_URL` ← read by our code
   - `KV_REST_API_TOKEN` ← read by `@vercel/kv` automatically
   plus `KV_URL`, `REDIS_URL`, `KV_REST_API_READ_ONLY_TOKEN` (unused by us, harmless).
   If the integration asks for an **environment-variables prefix**, keep the default
   `KV` — our code depends on the `KV_REST_API_*` names.
5. **Redeploy** the project (env var changes only apply to new deployments).
6. **Update `.env.local`** for local production testing: copy the new
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` values from
   Project → Settings → Environment Variables (or `vercel env pull`, but that
   overwrites the whole file — with our hand-maintained secrets in there, copy the two
   values manually instead).

## Option B: reuse an existing Upstash account

If you already have an Upstash account/database outside Vercel: Upstash Console →
create/pick a Redis DB → copy its **REST API** URL + token → set them as
`KV_REST_API_URL` / `KV_REST_API_TOKEN` in Vercel Project → Settings → Environment
Variables → redeploy. Same result, no marketplace link.

## Option C: turn rate limiting off cleanly (not recommended)

Delete `KV_REST_API_URL` from the Vercel env (and `.env.local`) and redeploy. The code
detects its absence and skips all checks silently — no errors, no dead calls. You lose
the auth brute-force limiter, which is the main thing worth keeping.

---

## Verification (after redeploy)

1. **Store reachable** — from the repo root:
   ```
   node scripts/check-rate-limit-kv.mjs
   ```
   Expect `PING -> PONG` and an `INCR/EXPIRE ok` line. (Script reads `.env.local`.)
2. **No more error spam** — Vercel → Deployment → Logs: the
   `Rate limit error: … ENOTFOUND` lines must be gone.
3. **Limits actually enforce** — the strictest limiter is auth (10/min/IP):
   ```
   for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<your-domain>/api/auth/whatever; done
   ```
   The last requests should return **429** (JSON body with `code: "RATE_LIMITED"`).
   Wait a minute and confirm it clears.
4. **Normal traffic unaffected** — browse `/`, `/matches`, a tournament page; the page
   limits are far above human traffic (global 100k/min, per-IP 20k/min, writes
   30/min/IP/path, daily 5k/IP — see `src/app/lib/rate-limit.ts:72-102`).

## Current limit values (for reference)

| check | limit | window | where |
|---|---|---|---|
| global | 100 000 | 1 min | every request |
| per-IP | 20 000 | 1 min | every request |
| per-endpoint | 18 000 | 1 min | `/api/*` |
| API writes | 30 | 1 min | per IP per path, POST/PUT/PATCH/DELETE |
| daily | 5 000 | 24 h | per IP, API writes |
| auth | 10 | 1 min | per IP, `/api/auth/*` |

Search-engine crawlers bypass all except auth (`proxy.ts:292`); static assets are
skipped entirely.

## Sources

- Vercel: "Redis on Vercel" — KV sunset + Marketplace path (vercel.com/docs/redis)
- Vercel changelog: "Upstash joins the Vercel Marketplace"
- Upstash docs: Vercel integration (upstash.com/docs/redis/howto/vercelintegration)
- Marketplace listing: "Upstash for Redis" (vercel.com/marketplace/upstash/upstash-kv) —
  injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`
