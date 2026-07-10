# Session 7b — ISR enablement: fixing finding E1 end-to-end

Branch: `review/07-public-read-surfaces` · Date: 2026-07-10

Follow-up to `07-public-read-surfaces.md` finding E1. Goal: make the public site actually serve
ISR-cached pages, safely — which requires removing the dynamic forcers **and** wiring
mutation-side revalidation so cached pages never go stale past an admin edit.

## A. The dynamic forcers (all fixed) — and the CSP trap underneath

**Correction to 07's E1**: the nonce was NOT dead. Session 7's audit searched for
`middleware.ts`, but Next 16 renamed middleware to **`src/proxy.ts`** — which exists, mints a
per-request nonce into the `x-nonce` request header, and sets an **enforced**
`Content-Security-Policy` with `script-src 'self' 'nonce-…'`. Next stamps that nonce into every
`<script>` tag it renders. That means the layout's `headers()` read (and the dynamic rendering it
forced) was *load-bearing*: with ISR, cached HTML freezes the render-time nonce while every
response carries a fresh CSP nonce — verified locally: three requests to a cached page returned
`HTML nonce=GdU24…` against three different header nonces. Under enforced CSP that blocks every
script on every cache hit — the site would ship dead, unhydrated HTML.

Fixes:

1. **`layout.tsx` `await headers()` removed.** The layout only used the nonce on an inline
   `<style>`, which was pointless anyway (`style-src` includes `'unsafe-inline'`); Next handles
   script-tag stamping itself from `x-nonce`.
2. **`proxy.ts` CSP split by route class** (the standard resolution — Next's own docs: nonces
   require dynamic rendering):
   - `/dashboard/*` (force-dynamic layout, privileged surface): unchanged strict
     `script-src 'self' 'nonce-…'`, fresh nonce per request.
   - **Public routes** (ISR-cached): no nonce minted; `script-src 'self' 'unsafe-inline'
     https://cdnjs.cloudflare.com`. `'unsafe-inline'` is required for Next's inline hydration
     scripts on cached pages; external script origins stay pinned. All other directives
     (img/connect/frame/object/etc.) unchanged.
3. **`Navbar` (server component in the root layout) called `auth.getUser()`** via the cookie-bound
   client — `cookies()` forces dynamic exactly like `headers()`. This isn't just a perf bug: an
   ISR-cached HTML document can never contain per-user UI. Fixed the only way ISR allows: the
   server passes `initialUser={null}` and `NavbarClient` resolves the user in the browser (it
   already called `supabase.auth.getUser()` on mount + subscribed to `onAuthStateChange`, so the
   plumbing existed). **Trade-off**: signed-in admins see the logged-out navbar for a moment until
   hydration; anonymous visitors (everyone else) see no difference. `fetchRecentNewsCount` stays
   server-side (supabaseAdmin, no cookies) and is baked into each page's ISR snapshot.

Shell check: `Footer`, `ConsentProvider`, `CookieBanner` are client components with no dynamic
APIs; only three public pages legitimately use cookies (`/matches/[id]`, `/article/[slug]`,
`/announcement/[id]`) and correctly stay request-rendered.

## B. `revalidate` coverage (every DB-backed public page now declares one)

| route | revalidate | note |
|---|---|---|
| `/` | 300 (existing) | |
| `/matches` | 60 (existing) | rows still client-fetched (E9) |
| `/matches/[id]` | 0 (existing) | admin surface + auth — stays dynamic |
| `/tournaments` | **60 (new)** | must stay ≪ the 5-min signed-logo TTL |
| `/tournaments/[id]`, `/v2`, `/v2-dark` | **60 (new)** | same TTL constraint; + empty `generateStaticParams()` |
| `/OMADA/[id]` | **60 (new)** | + empty `generateStaticParams()` |
| `/OMADES` | — | reads `searchParams` → inherently dynamic |
| `/geniki-katataxi`, `/paiktes` | 60 / 300 (existing) | |
| `/hometest` | **300 (new)** | scratch route, kept from freezing |
| `/articles`, `/login`, `/sign-up` | — | client pages, static shell fine |
| `/anakoinoseis` | — | pure redirect |

## C. Mutation-side revalidation (the part that makes ISR safe)

New helper `src/app/lib/revalidatePublicPages.ts`:
`revalidateMatchSurfaces({id, tournament_id, team_a_id, team_b_id, previous_team_ids?})` →
`/`, `/matches`, `/matches/[id]`, `/geniki-katataxi`, `/paiktes`, all three tournament routes,
both teams' `/OMADA/[id]`; plus `revalidateTournamentSurfaces`, `revalidateTeamSurfaces`,
`revalidatePlayerStatSurfaces`.

Wired into every content mutation path:

| mutation | file | now revalidates |
|---|---|---|
| Match PATCH (scores/status/teams) | `api/matches/[id]/route.ts` | match surfaces (incl. old+new teams), after progression |
| Match DELETE | same | match surfaces |
| Match POST (create) | `api/matches/route.ts` | match surfaces |
| Match postpone | `api/matches/[id]/postpone/route.ts` | match surfaces |
| Stats save (`saveAllStatsAction`) | `matches/[id]/actions.ts` | match surfaces synchronously; tournament + player-stat surfaces again inside `after()` once progression/stat-cache writes land |
| Video save | same | `/matches/[id]` + `/` (home Highlights) |
| Tournament update / delete | `TournamentCURD/actions.ts` | tournament surfaces + `/` (+ `/matches` on delete) |
| Planner save-all | `api/tournaments/[id]/save-all/route.ts` | tournament surfaces + `/` + `/matches` |
| KO reseed | `api/stages/[id]/reseed/route.ts` | tournament surfaces |
| refresh-stats / fix-stats | dashboard actions | `+ /` (home top players) |
| Teams PATCH / DELETE | `api/teams/[id]/route.ts` | `/OMADA/[id]`, `/OMADES`, `/`, `/geniki-katataxi` |
| Articles POST/PATCH/DELETE | `api/articles/*` | `/` |
| Announcements POST/PATCH/DELETE | `api/announcements/*` | `/` |

Already correct before: geniki-katataxi admin actions. Not wired (accepted staleness ≤ ISR
window): player CRUD (roster edits show within 60–300s), team-name propagation into tournament
page snapshots (≤60s).

## D. What this changes operationally

- Anonymous page loads now hit the ISR cache instead of re-running every Supabase query per
  request — the tournament loader's ~10 queries run at most once per 60s per tournament instead
  of once per visitor.
- Admin edits appear on the public site immediately (revalidatePath) rather than "whenever the
  window rolls" — and crucially, tournament/team pages no longer depend on accidental dynamic
  rendering for freshness.
- Navbar auth state is now client-resolved; the logged-in indicator appears post-hydration.

## E. Gotchas that cost a build cycle (write these down)

- **Dynamic-segment ISR needs `generateStaticParams`.** `/tournaments/[id]` and `/OMADA/[id]`
  stayed fully dynamic with `revalidate = 60` alone; an **empty** `generateStaticParams()`
  (no build-time prerender) is what opts a dynamic segment into on-demand ISR.
- `/geniki-katataxi` and `/paiktes` read `searchParams` → per-request dynamic despite their
  `revalidate` declarations. True before this session too; their freshness contract is
  unchanged. (A future win: `unstable_cache` around the points engine.)
- **Rate limiter is dead weight right now**: `proxy.ts` calls Vercel KV
  (`united-toucan-12980.upstash.io`) which no longer resolves (ENOTFOUND); `checkLimit` fails
  open, so every request logs errors and pays dead KV round-trips, and rate limiting is
  effectively OFF. Verify the KV store in the Vercel dashboard — recreate it (env vars refresh)
  or unset `KV_REST_API_URL` to short-circuit cleanly.

## F. Verification

- `tsc --noEmit` clean; `npm run build` clean.
- `next start` probes (second request per route):
  - `/` → `x-nextjs-cache: HIT`, `s-maxage=300`; `/tournaments`, `/matches`,
    `/tournaments/23`, `/OMADA/42` → `HIT`, `s-maxage=60`.
  - `/matches/2566` → `private, no-cache` (intended: admin surface, `revalidate = 0`).
  - Public CSP contains `'unsafe-inline'` and **no nonce**; HTML script tags carry no nonce
    attribute; pages hydrate.
- Live DB probes (read-only) for the deployment checklist: RLS reads still open (Session 4);
  `replace_stage_standings` + `can_edit_content` deployed; `alloc_stage_slot` **missing** →
  re-run `migrations/add-progression-integrity.sql` (idempotent).
