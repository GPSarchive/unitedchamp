# Infra / lib catalog

The plumbing layer: Supabase clients, auth/security helpers, image config, search utils, consent, navigation chrome, middleware. Everything in this catalog is "below" the routes/API layer.

See [00-overview.md](00-overview.md) for vocabulary.

---

## Middleware

| File | Purpose |
|---|---|
| [src/proxy.ts](../../src/proxy.ts) | The single middleware entry. Handles: CSP nonce generation (passed via `x-nonce` header), rate limiting (global / endpoint / IP / API write / daily / auth — all via `@vercel/kv`), search-engine + social bot exemption, Supabase session refresh via `@supabase/ssr`. `CSP_REPORT_ONLY=1` env switches to report-only mode. |

**Note**: the filename is `proxy.ts` rather than the Next.js convention `middleware.ts`. Confirm whether it's wired via `next.config.ts` or whether this is dead code with `middleware.ts` living elsewhere.

---

## Supabase clients (`src/app/lib/supabase/`)

There are **five** clients defined here. Some are duplicates or legacy.

| File | Type | Use case |
|---|---|---|
| [supabaseAdmin.ts](../../src/app/lib/supabase/supabaseAdmin.ts) | Service role | Server-side privileged writes; bypasses RLS. `server-only`. |
| [supabaseServer.ts](../../src/app/lib/supabase/supabaseServer.ts) | SSR cookie-bound | Exports `createSupabaseRSCClient` (read-only, for RSC) + `createSupabaseRouteClient` (read/write, for Route Handlers + Server Actions). Most route handlers use these. |
| [Server.ts](../../src/app/lib/supabase/Server.ts) | SSR cookie-bound | **Near-duplicate of `supabaseServer.ts`** — same two functions, slightly different `remove` implementation (uses `cookieStore.delete` vs `maxAge: 0`). Only used by `src/app/matches/[id]/page.tsx`. Flag as cleanup. |
| [supabaseBrowser.ts](../../src/app/lib/supabase/supabaseBrowser.ts) | Browser | `createSupabaseBrowserClient` using `@supabase/ssr`. Modern. |
| [client.ts](../../src/app/lib/supabase/client.ts) | Browser (legacy) | Uses the deprecated `@supabase/auth-helpers-nextjs` `createBrowserSupabaseClient`. Probably superseded by `supabaseBrowser.ts`. Flag as cleanup candidate. |
| [supabaseClient.ts](../../src/app/lib/supabase/supabaseClient.ts) | Anon | Plain `createClient` with anon key. Also exports a `DbEvent` type. Confirm consumers; may be redundant. |
| [apiAuth.ts](../../src/app/lib/supabase/apiAuth.ts) | Helpers | `requireAuth` + `requireAdmin` — return `{ ok: true, user }` or `{ ok: false, response: NextResponse }`. Used by route handlers. Several other handlers inline this same logic instead of importing — flagged in [api.md](api.md). |
| [signDbToken.ts](../../src/app/lib/supabase/signDbToken.ts) | JWT signer | Mints ES256 JWTs with `SUPABASE_JWT_SECRET` for fine-grained DB access. Confirm call sites — not found in main grep. |

---

## Security & auth helpers

| File | Purpose |
|---|---|
| [csrf.ts](../../src/app/lib/csrf.ts) | `generateCsrfToken` + `validateCsrfToken`. HttpOnly `__csrf` cookie, 1h TTL. Used by sign-in/up/resend. |
| [safe-redirect.ts](../../src/app/lib/safe-redirect.ts) | `safeNextUrl(raw, fallback='/home')` — blocks open-redirect attacks. Allows only same-origin relative paths. |
| [password-validation.ts](../../src/app/lib/password-validation.ts) | `validatePassword` — server-side rules: ≥8 chars, lowercase, uppercase, digit. |
| [rate-limit.ts](../../src/app/lib/rate-limit.ts) | Comprehensive rate limiter on Vercel KV. Pre-configured tiers: global / endpoint / IP / API-write / daily / auth. `checkRateLimits` and `checkLimitsBatch` for combining. Fails open if KV is down. Disabled in development. |

---

## Image / media

| File | Purpose |
|---|---|
| [image-config.ts](../../src/app/lib/image-config.ts) | Central image URL resolver. `USE_PUBLIC_BUCKET = true` (hardcoded toggle). `resolveImageUrl(path, type)` supports `PLAYER`/`TEAM`/`TOURNAMENT`. Optional `NEXT_PUBLIC_CDN_DOMAIN`. Bucket name `GPSarchive's Project` hardcoded here too — flag for env-ification. |
| [OptimizedImage.tsx](../../src/app/lib/OptimizedImage.tsx) | Wrapper component for tournament/team/player images. The recommended replacement for `player-images.ts`. |
| [player-images.ts](../../src/app/lib/player-images.ts) | **Deprecated** (says so in the comment). `resolvePlayerPhotoUrl` falls back to `/player-placeholder.svg`. Migrate callers to `OptimizedImage`. |
| [colorExtraction.ts](../../src/app/lib/colorExtraction.ts) | Client-side dominant-color extractor for uploaded images. Uses Canvas API. Feeds the `teams.colour` column. |
| [utils/images.ts](../../src/app/lib/utils/images.ts) | `safeImageSrc`, `parseStoragePath`, plus signed-URL helpers. Lower-level than `image-config.ts`. |
| [utils/media.ts](../../src/app/lib/utils/media.ts) | Other media utilities (video URL parsing etc.). |

---

## Data fetch helpers / repos

| File | Purpose |
|---|---|
| [fetchRecentNewsCount.ts](../../src/app/lib/fetchRecentNewsCount.ts) | Counts articles + announcements published in the last 2 days. `cache()`'d. Powers the navbar/header news bubble. |
| [refreshPlayerStats.ts](../../src/app/lib/refreshPlayerStats.ts) | `"use server"`. Backfills `player_career_stats` + `player_tournament_stats` from `match_player_stats`. Batches in chunks of 300. Wired to `/dashboard/refresh-stats`. |
| [repos/tournaments.ts](../../src/app/lib/repos/tournaments.ts) | Read helpers: `listRunningTournaments`, `listCompletedTournaments`, `getTournamentBySlug`, etc. Plus `createTournament` via RPC. The only file that uses the `v_tournament_standings` view. |
| [utils/bracket.ts](../../src/app/lib/utils/bracket.ts) | `groupMatchesByRound`, knockout-match types. Used by bracket viewers. |
| [utils/standings.ts](../../src/app/lib/utils/standings.ts) | `StandingRow` type + `Tiebreaker` union (`points`, `goal_diff`, `goals_for`, `h2h_*`, `fair_play`). |
| [types.ts](../../src/app/lib/types.ts) | The big shared type dump: `TeamRow`, `PlayerRow`, `MatchRowRaw`, `CalendarEvent`, `PlayerAssociation`, etc. ~300+ lines. Several routes also define ad-hoc local types — consolidation opportunity. |
| [getBaseUrl.ts](../../src/app/lib/getBaseUrl.ts) | Resolves the app's public origin from env (`NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → request URL → localhost). |

---

## Chrome (Navbar / Footer / Consent)

| File | Purpose |
|---|---|
| [Navbar/Navbar.tsx](../../src/app/lib/Navbar/Navbar.tsx) | RSC entrypoint. Fetches current user + recent news count, hands off to `NavbarClient`. |
| [Navbar/NavbarClient.tsx](../../src/app/lib/Navbar/NavbarClient.tsx) | Client navbar — menus, mobile drawer, user pill. |
| [Navbar/NavbarBG.tsx](../../src/app/lib/Navbar/NavbarBG.tsx) | Backdrop component. |
| [Navbar/vantatypes.ts](../../src/app/lib/Navbar/vantatypes.ts) | Vanta.js typings — probably belongs in `framermotion/` or a shared types folder. |
| [Footer/Footer.tsx](../../src/app/lib/Footer/Footer.tsx) | Footer; **hides itself on `/paiktes`** (full-screen layout there). |
| [consent/ConsentProvider.tsx](../../src/app/lib/consent/ConsentProvider.tsx) | Top-level provider. Stores consent state in localStorage; fires `CONSENT_EVENT` + `CONSENT_REOPEN_EVENT`. |
| [consent/ConsentContext.ts](../../src/app/lib/consent/ConsentContext.ts) | React context. |
| [consent/use-consent.ts](../../src/app/lib/consent/use-consent.ts) | Hook + storage helpers + events. |
| [consent/CookieBanner.tsx](../../src/app/lib/consent/CookieBanner.tsx) | The banner UI. |
| [consent/ConsentGatedAnalytics.tsx](../../src/app/lib/consent/ConsentGatedAnalytics.tsx) | Loads `@vercel/analytics` + `@vercel/speed-insights` only after consent is granted. SDKs unmount on revoke. |
| [VantaBg.tsx](../../src/app/lib/VantaBg.tsx) | Vanta.js background component (the homepage hero). |

---

## Misc

| File | Purpose |
|---|---|
| [searchUtils.ts](../../src/app/lib/searchUtils.ts) | Greek diacritic normalization + Greek↔Latin transliteration maps. `parseSearchQuery`, `normalizeForSearch`. Critical for `/paiktes` and `/OMADES` search. |
| [framermotion/useStagedHeader.ts](../../src/app/lib/framermotion/useStagedHeader.ts) | Three-stage scroll-aware header hook (visible → peek → hidden). |
| [framermotion/useStagedHeaderMotion.ts](../../src/app/lib/framermotion/useStagedHeaderMotion.ts) | Companion hook with Framer Motion variants. |

---

## `src/lib/` (root, shadcn convention)

This folder is the shadcn/ui home. Both files are small.

| File | Purpose |
|---|---|
| [src/lib/utils.ts](../../src/lib/utils.ts) | `cn(...)` — shadcn class-merging helper (`clsx` + `tailwind-merge`). |
| [src/lib/articleUtils.ts](../../src/lib/articleUtils.ts) | `calculateReadTime(content)`, `formatViewCount(count)`, `formatReadTime(minutes)`. Pure TipTap helpers. |

---

## Cross-cutting notes (cleanup surface)

1. **Five Supabase clients** in `lib/supabase/`. Concrete duplications:
   - `Server.ts` ≈ `supabaseServer.ts` — same two functions, near-identical. Used by exactly one file.
   - `client.ts` (legacy `auth-helpers-nextjs`) vs `supabaseBrowser.ts` (`@supabase/ssr`).
   - `supabaseClient.ts` (plain anon) — confirm whether it's still imported.
2. **Middleware filename** — `src/proxy.ts` should likely be `src/middleware.ts` per Next.js convention. Verify routing config.
3. **Hardcoded bucket name** `"GPSarchive's Project"` in `image-config.ts` — repeats the same constant in 7+ API routes. Env-var the default.
4. **Deprecated `player-images.ts`** — marked in code. Migrate consumers to `OptimizedImage` and delete.
5. **`signDbToken.ts`** — exports a function not found in the main grep. Possibly unused. Confirm before keeping.
6. **`utils/standings.ts` defines `Tiebreaker` types** but the grep didn't show those tiebreakers actually being applied in standings computation. Standings rendering may still be implicit `points` only.
7. **Two utility "homes"**: `src/app/lib/` (most things) and `src/lib/` (shadcn convention). Pick one for new code to avoid drift.
8. **`vantatypes.ts` lives under `Navbar/`** but is generic Vanta typing — better under a `types/` folder.
9. **`useStagedHeader.ts` + `useStagedHeaderMotion.ts`** — paired hooks. Confirm both are used (probably only the latter).
10. **The Vanta animation library** is heavy and used in many places (`VantaSection`, `VantaBg`, `/login`, `/epikoinonia`, `/kanonismos`). It's deliberate brand, but worth knowing — large bundle impact.

These plus prior findings flow into [cleanup-candidates.md](cleanup-candidates.md) when we write it.
