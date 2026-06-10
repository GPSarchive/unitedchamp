# Security Audit — unitedchamp

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Base commit** | `dd2e299` |
| **Stack** | Next.js 16.2.1 (App Router, `src/proxy.ts` middleware), Supabase (PostgREST + Auth + Storage), Vercel KV rate limiting |
| **Scope** | Full repository: all 52 API routes, server actions, middleware, auth flows, storage proxies, client-side rendering sinks, configuration, dependencies |
| **Method** | Manual code review (route-by-route), data-flow tracing of user input into DB filters / HTML sinks / redirects, configuration review, `npm audit` |

Findings marked **FIXED** were remediated on this branch as part of the audit.

---

## Executive summary

The codebase has a notably strong baseline: nonce-based CSP, layered security headers, CSRF tokens on auth forms, open-redirect validation, DOMPurify on every `dangerouslySetInnerHTML` sink, multi-layer rate limiting, field whitelists on mutations, and good secrets hygiene. No critical vulnerability (unauthenticated data tampering or account takeover) was found.

The medium-severity issues found — PostgREST filter injection, an inconsistent same-origin guard that trusted the Host header, raw database error messages reaching clients, and fail-open auth rate limiting — have been **fixed on this branch**. The highest-priority remaining action is **upgrading Next.js**: `npm audit` reports unpatched advisories against 16.2.1, including middleware/proxy bypass issues that weaken the `src/proxy.ts` gating layer.

### Scorecard

| Area | Status |
|---|---|
| Authentication & session handling | ✅ Strong (Supabase SSR cookies, CSRF, per-email + per-IP limits) |
| Authorization (RBAC) | ✅ Strong (middleware gate **and** per-route `requireAdmin`) |
| XSS | ✅ Strong (DOMPurify everywhere, nonce CSP) |
| Open redirects | ✅ Strong (`safeNextUrl`) |
| CSRF | ✅ Good (tokens on auth, origin guard on mutations — now unified) |
| Injection (PostgREST filters) | ✅ **Fixed on this branch** |
| Information disclosure (errors) | ✅ **Fixed on this branch** |
| Rate limiting | ✅ **Improved on this branch** (auth limits now fail closed) |
| Secrets management | ✅ Strong (no committed `.env`, service-role key `server-only`) |
| Dependencies | ⚠️ Next.js advisories outstanding — upgrade required |
| Row-Level Security | ⚠️ Configured in Supabase (owner-verified) but not codified in migrations |
| CI security tooling | ⚠️ None (no workflows, no audit gate, no tests) |

---

## Findings

### HIGH

#### H-1. Next.js 16.2.1 has known advisories, including middleware/proxy bypass — *open, action required*

`npm audit` (run 2026-06-10) reports **1 high + 4 moderate** issues. Against `next@16.2.1` itself:

- Middleware/proxy bypass via dynamic route parameter injection (GHSA-492v-c6pp-mqqv)
- Middleware/proxy bypass via segment-prefetch routes, App Router (GHSA-267c-6grr-h53f)
- RSC cache poisoning (GHSA-vfv6-92ff-j949, GHSA-wfc6-r584-vfw7)
- DoS via Image Optimization API (GHSA-h64f-5h5j-jqjh), connection exhaustion (GHSA-mg66-mrh9-m8jx)
- SSRF via WebSocket upgrades (GHSA-c4j6-fc7j-m34r), XSS in `beforeInteractive` scripts (GHSA-gx5p-jg67-6x7h)

Impact here: `src/proxy.ts` performs rate limiting, bot blocking, the dashboard admin gate, and the API-mutation auth pre-check. A middleware bypass erodes that layer. Mitigating factor: every mutating route re-checks auth/admin itself (defense in depth), so a bypass alone does not grant write access — but rate limiting and headers would be skipped.

Also flagged (moderate): `postcss < 8.5.10` (via next/styled-components), `uuid < 11.1.1`, `ws 8.0.0–8.20.0`.

**Remediation:** upgrade `next` to the latest patched release and run `npm audit fix`; re-run `npm audit` until clean. Add an audit gate to CI (see M-5).

---

### MEDIUM

#### M-1. PostgREST filter injection via interpolated user input — **FIXED**

supabase-js `.or()` filters are a comma/paren-delimited mini-language; interpolating raw user input lets a crafted value inject additional filter clauses. Three sites:

| Site | Input | Exposure |
|---|---|---|
| `src/app/api/matches/videos/route.ts:39` | `cursorDate` query param | **Unauthenticated** endpoint querying via the **service-role** client (RLS bypassed) — an injected clause could alter which `matches` rows are returned |
| `src/app/api/players/route.ts:92` | `q` search param | Admin-gated |
| `src/app/dashboard/tournaments/TournamentCURD/actions.ts:579` | `search` | Admin-gated server action |

**Fix applied:** new helper `src/app/lib/pgrest.ts` — `isIsoTimestamp()` strictly validates the cursor before interpolation (preserving microsecond precision for correct pagination), and `sanitizeFilterTerm()` strips `, ( ) " \` from search terms at both search sites.

#### M-2. Same-origin guard duplicated 16× with insecure drift — **FIXED**

`ensureSameOrigin` was copy-pasted into 16 route files with two divergent behaviors:

- Hardened variant (`matches/*`): trusts only `ALLOWED_ORIGINS`; blocks all mutations when unset.
- Drifted variant (`announcements/*`, `articles/*`, `players/*`, `teams/*`): **auto-whitelisted `new URL(req.url).origin`** — i.e. trusted the request's own Host header, letting an attacker who can influence Host self-whitelist and defeat the cross-origin mutation guard.

**Fix applied:** single shared helper `src/app/lib/same-origin.ts` (hardened semantics; never derives the allow-list from the request; falls back to `NEXT_PUBLIC_SITE_URL` / Vercel deployment URLs when `ALLOWED_ORIGINS` is unset so deployments don't break). All 16 files now import it; `auth/sign-out` uses the boolean `isAllowedOrigin()`. **Operational note:** ensure `ALLOWED_ORIGINS` (or `NEXT_PUBLIC_SITE_URL`) is set in every environment — with no configured origin, mutations are now blocked (fail-safe) instead of silently trusting the Host header.

#### M-3. Raw database error messages returned to clients — **FIXED**

~70 response sites across ~27 routes returned Supabase/PostgREST `error.message` verbatim (e.g. `articles/route.ts:77`, `tournaments/[id]/save-all/route.ts` ×26, `tournaments/[id]/snapshot/route.ts` ×8, `announcements/route.ts:70`, all `storage/*` routes, `admin/users/[id]/roles`, named-variable cases like `upErr`/`linkErr`). Postgres errors can reveal table/constraint names and query structure; several of these routes are unauthenticated.

**Fix applied:** new helper `src/app/lib/api-error.ts` (`dbError()` / `safeErrorMessage()`) — logs the full error server-side, returns a generic message in production and the real message in development. All identified sites converted; status codes and response shapes (e.g. `requestId`, `ok:false`, fallback strings) unchanged. Note: admins no longer see raw DB errors in production responses — check server logs (the `[api:<context>]` prefix) instead.

#### M-4. Rate limiting failed open on KV outage, including auth brute-force limits — **FIXED**

`src/app/lib/rate-limit.ts` allowed all traffic whenever Vercel KV errored. For general traffic that is the right availability tradeoff, but it also disabled the sign-in brute-force limits — an attacker who can degrade KV (or time an outage) could brute-force unrestricted.

**Fix applied:** `checkLimit()` accepts `{ failClosed: true }`; the per-IP auth limit (`checkAuthLimit`), the per-email sign-in limit (`sign-in/route.ts`), and the batch path now **fail closed** on KV errors, while general limits still fail open. Unchanged by design: the limiter is bypassed in development and when KV is not configured at all.

#### M-5. No CI security tooling — *open*

No `.github/workflows`, no test framework, no dependency audit gate, no SAST. **Recommendation:** add a CI workflow running `npm audit --audit-level=high`, lint, and `tsc --noEmit`; enable Dependabot/Renovate; consider `eslint-plugin-security`.

#### M-6. No file-size limits on signed-upload endpoints — *open*

`teams/logo-upload` (direct upload through the route) enforces a 3 MB cap. The signed-URL routes (`storage/signed-upload`, `storage/article-img`, `storage/tournaments/image-upload`) validate content-type and path but hand the client a URL that uploads straight to the bucket, so size can't be enforced in the route — set Supabase bucket `file_size_limit` instead. All are admin-gated, so exposure is limited.

---

### LOW / INFORMATIONAL

| ID | Observation |
|---|---|
| L-1 | **RLS policies are not in the repo.** Owner confirmed RLS is configured in Supabase, but `migrations/*.sql` contains no `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY`, so policies can't be reviewed or reproduced from source. Recommend exporting them into a migration (`supabase db dump --schema public`) so drift is visible in PRs. |
| L-2 | `/api/matches/videos` queries via the **service-role** client with no auth (intentional — public video listing — and the column list is fixed). After the M-1 fix the residual risk is low; consider the anon client + RLS instead for belt-and-braces. |
| L-3 | CSRF tokens are only on auth forms; other mutations rely on the origin guard + SameSite cookies + per-route admin checks. Acceptable defense-in-depth; extending tokens to all mutations would be stricter. |
| L-4 | No rate limit on sign-up (per-IP auth limit applies, but no per-email/captcha). Consider Supabase captcha or a per-IP sign-up limit. |
| L-5 | CSP `style-src 'unsafe-inline'` (required by styled-components). Script-src is nonce-based, so impact is limited to style-based exfiltration tricks. |
| L-6 | `Access-Control-Allow-Origin: *` on `/api/public/team-logo/[...path]` — intentional (WebGL textures), GET-only, path-validated. |
| L-7 | `/api/debug/invocations` is admin-gated; fine to keep, but consider excluding from production builds. |
| L-8 | `ipFromRequest()` trusts `x-forwarded-for` etc.; on Vercel the platform sets these, but if self-hosted behind another proxy, validate the chain. |

---

## Strengths (keep these)

- **Headers/CSP** — `src/proxy.ts` + `next.config.ts`: per-request **nonce CSP**, HSTS w/ preload, X-Frame-Options, COOP/CORP, comprehensive Permissions-Policy, `poweredByHeader: false`, production source maps off, `console.*` stripped in prod.
- **Auth flows** — CSRF tokens (httpOnly, `SameSite=strict`) on sign-in/up/resend; per-email (5/15 min) + per-IP (10/min) limits; OAuth provider allowlist; server-side password policy; `safeNextUrl` (`src/app/lib/safe-redirect.ts`) blocks open redirects incl. `//` and backslash tricks.
- **XSS** — every `dangerouslySetInnerHTML` sink sanitizes with DOMPurify (`ArticlePreview`, `AnnouncementContent`, `AnnouncementCard`, preview clients); error boundary never renders `error.message`/stack.
- **Mutation hygiene** — `INSERTABLE_FIELDS`/`UPDATABLE_FIELDS` whitelists (mass-assignment safe), zod on tournament actions, system fields stripped on article updates.
- **Storage** — path-traversal validation on all object paths, SSRF host-allowlist + content-type check on `/api/storage/proxy`, UUID object names, service-role key isolated behind `'server-only'`.
- **Secrets** — no `.env` committed; only genuinely public values use `NEXT_PUBLIC_`.

---

## Recommendations roadmap

**Immediate**
1. Upgrade `next` + `npm audit fix` (H-1) and redeploy.
2. Verify `ALLOWED_ORIGINS` (or `NEXT_PUBLIC_SITE_URL`) is set in all environments (M-2 behavior change).

**Short term**
3. CI workflow: `npm audit --audit-level=high` + `tsc --noEmit` + lint on PRs; enable Dependabot (M-5).
4. Add upload size caps via bucket config or route checks (M-6).
5. Export RLS policies into versioned migrations (L-1).

**Ongoing**
6. Re-run `npm audit` monthly; re-review new routes against the shared helpers (`same-origin.ts`, `api-error.ts`, `pgrest.ts`) instead of copy-pasting guards.
7. Consider sign-up captcha (L-4) and CSRF tokens on all mutations (L-3).

---

## Appendix — API route inventory

Auth gate legend: **A** = admin required, **U** = any authenticated user, **–** = public, **(O)** = same-origin guard on mutations.

| Route | Methods | Gate | Notes |
|---|---|---|---|
| `/api/auth/sign-in` | POST | – | CSRF + per-email limit (fail-closed) |
| `/api/auth/sign-up` | POST | – | CSRF + password policy |
| `/api/auth/resend` | POST | – | CSRF |
| `/api/auth/sign-out` | GET/POST | (O) | origin allow-list (shared helper) |
| `/api/auth/oauth` | GET | – | provider allowlist (google/github) |
| `/api/auth/callback`, `/confirm` | GET | – | Supabase code/OTP exchange, `safeNextUrl` |
| `/api/auth/csrf`, `/refresh` | GET/POST | – | token issue / session refresh |
| `/api/me` | GET | U | session echo |
| `/api/teams` | GET / POST | – / A (O) | RLS reads; validated create |
| `/api/teams/[id]` (+`/restore`) | GET/PATCH/DELETE/POST | A (O) | logo path validation |
| `/api/teams/[id]/players` (+`/[playerId]`) | GET/POST/PATCH/DELETE | A (O) | roster management |
| `/api/teams/logo-upload`, `/[id]/trim-logo` | POST | A | signed upload |
| `/api/players` | GET/POST | A (O) | search term sanitized (M-1) |
| `/api/players/[id]` (+`/restore`) | GET/PATCH/DELETE/POST | A (O) | |
| `/api/matches` | GET / POST | – / A (O) | field whitelist |
| `/api/matches/[id]` (+`/stats`, `/postpone`) | GET/PATCH/DELETE/POST | A (O) | status-transition validation |
| `/api/matches/calendar` | GET | – | |
| `/api/matches/videos` | GET | – | service-role read; cursor validated (M-1) |
| `/api/articles` / `/api/articles/[id]` / `/slug/[slug]` | GET/POST/PATCH/DELETE | – reads / A (O) writes | drafts hidden from non-admins |
| `/api/articles-public` | GET | – | published only |
| `/api/announcements` (+`/[id]`) | GET/POST/PATCH/DELETE | – reads / A (O) writes | time-window filtering |
| `/api/tournaments` (+`/[id]/snapshot`, `/save-all`) | GET/POST | – / A | snapshot + batch save admin-only |
| `/api/tournoua/[id]/matches` | GET | – | |
| `/api/stages/[id]/standings`, `/reseed` | GET / POST | – / A | reseed uses service-role |
| `/api/storage/*` (sign, signed-upload, article-img, player-img, mask, delete-object, tournaments/image-upload, tournament-img-loader) | GET/POST | A | service-role signing, path validation |
| `/api/storage/proxy` | GET | U | SSRF host allowlist |
| `/api/public/team-logo/[...path]` | GET | – | path-validated, CORS `*` (intentional) |
| `/api/admin/users/[id]/roles` | POST | A | role grants via `auth.admin` |
| `/api/debug/invocations` | GET | A | diagnostics |

Server actions (all behind `requireAdmin`/role checks): match stats save, tournament CRUD (`TournamentCURD/actions.ts`, zod-validated), stage actions, progression, stats refresh/fix.
