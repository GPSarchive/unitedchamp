# Session 7 — Public read surfaces: perf & data-access audit

Branch: `review/07-public-read-surfaces` · Date: 2026-07-10

Scope: read performance and data access of the public pages — tournament viewer, match
explorer/detail, home, standings, team page — plus caching correctness and the Supabase client
architecture behind them. Quantified against the live DB (`scripts/audit-read-surfaces.mjs`,
read-only). Not a UI pass.

## Live-data baseline (2026-07-10)

| table | rows | | table | rows |
|---|---|---|---|---|
| matches | 614 | | match_player_stats | 6 380 |
| tournaments | 8 | | match_participants | 6 392 |
| tournament_teams | 119 | | player | 777 |
| stage_standings | 130 | | teams | 62 |

Biggest tournaments by matches: **23** (150), 13 (137), 34 (109), 20 (105), 35 (50).

## A. Correctness bug found & fixed

**A1 — Tournament loader silently truncated player stats at 1000 rows.**
`loadTournamentIntoStore` fetched `match_player_stats` with a plain `.select()` — PostgREST caps
that at 1000 rows. Live impact: tournament 23 has **1158** stat rows (13 → **1680**, 34 → **1350**),
so `/tournaments/[id]` aggregated players/goals/assists from a truncated set — tournament 23
rendered 142 players instead of 143 and undercounted goals/assists. Same class of bug as B4 in
Session 6. **Fixed**: both per-match tables now page via `.range()` until a short page. Verified
against an independent full aggregation: t23 = 143 players / 961 goals / 580 assists — exact match
(t35 control also exact).

## B. Per-route audit tables

Verdicts: **ok** / **over-fetch** / **sequential** / **client-direct** (browser anon query). No N+1
was found anywhere — including `signTournamentLogos`, which batches one `createSignedUrls` call.

### `/tournaments/[id]` (also `/v2`, `/v2-dark` byte-identical clones) — was the worst offender

Before this session: **10 strictly sequential** round-trips, four `select('*')`, no caching,
315 KB total DB payload for tournament 23. After: **3 waves** (5-query `Promise.all` → 4-query
`Promise.all` → player details), ~660 ms total for the biggest tournament.

| query (loadTournamentIntoStore.tsx) | rows (t23) | payload | was | now |
|---|---|---|---|---|
| tournaments | 1 | 0.3 KB | `select('*')` (12 cols) | 8 mapped cols |
| tournament_stages | 3 | 0.8 KB | `select('*')` seq. | unchanged cols, wave 1 |
| matches | 150 | **119.7 → 76.1 KB** | `select('*')` (36 cols) | the 25 mapped cols |
| tournament_teams + teams join | 12 | 3.3 → 2.5 KB | `'*'` + `season_score` (unused) | join cols only |
| tournament_awards | 0 | — | `.single()` (errors on empty table) | `.maybeSingle()`, wave 1 |
| tournament_groups | 6 | 0.5 KB | sequential | wave 2 |
| stage_standings | 23 | 2.8 KB | 13 cols (already narrow) | wave 2 |
| match_player_stats | **1158** | 166 KB | **truncated at 1000** | paged, wave 2 |
| match_participants | 14 | 0.8 KB | plain select | paged, wave 2 |
| player | 142 | 21 KB | 6 cols (ok) | wave 3 |

Also fixed: the participants-missing fallback recomputed a `Set` per player by re-filtering all
stat rows — O(players × stats) ≈ 165k iterations for t23; now one pass. Note: the client's
`(m as any).field / .referee` reads (`TournamentClientV2Dark.tsx:770`) were **already dead** — the
loader never mapped those columns — so narrowing changes no output.

Still open (findings E2, E5): full `matches`/`players`/`standings` arrays ship as props into the
client, which renders ~12 of each per stage; and both the desktop and mobile branches always mount
(CSS-hidden), referencing the arrays twice.

### `/matches` + `/matches/[id]`

| route | query | where | verdict |
|---|---|---|---|
| /matches | tournaments `id,name` (dropdown) | server, `page.tsx:16` | ok (8 rows) |
| /matches | matches + teams×2 + tournament, `.range()` 12/page | **browser, anon key** (`MatchesExplorer.tsx:221`) | **client-direct**, paginated ok |
| /matches/[id] | fetchMatch (1 row, wide) | server | over-fetch → **fixed**: dropped `winner_team_id, stage_id, group_id` (never read) |
| /matches/[id] | fetchPlayersForTeam ×2 | server | **over-fetch → fixed**: dropped the nested `player_statistics` join (8 cols × every roster player × 2 teams, on a `revalidate = 0` page). Only consumer was `TeamPlayers.tsx`, which nothing imports. |
| /matches/[id] | fetchMatchStatsMap | server | ok — `position` looks unused in the public view but the admin `StatsEditor` reads it; kept |
| /matches/[id] | fetchParticipantsMap | server | ok; batch of 4 already `Promise.allSettled` |

`/matches` data flow: `revalidate = 60` caches only the dropdown; the match rows are fetched fresh
in the browser on every visit (plus a possible double-fire when changing filters while on page > 1
— `MatchesExplorer.tsx:211-215`). Browser-readable tables via this path: **matches, teams,
tournaments** — the full enumeration for the RLS decision below (D1).

### Home `/` (~11 queries per render, ISR 300s, all server-side)

| section | query | verdict |
|---|---|---|
| calendar/dashboard | matches −60d/+90d window, 15 cols + joins | ok-ish: date-bounded, no `.limit()`; `stage_id/group_id` unused |
| tournaments grid | 6 rows + `count` aggregates | ok |
| news bubble | 2 × `head:true` counts | ok |
| videos | 20 rows prefetch, client pages 2-at-a-time via cursor API | ok (well designed) |
| articles | 4 rows **including full `content` body** only to extract the first image | over-fetch (finding E3) |
| top players | 4 × limit-6 sorts, render 3 (JS `deleted_at` filter) | minor over-fetch |
| top players | **all** `match_player_stats` rows for ~12 players (393 today, unbounded) to count distinct matches, sequential after the batch | finding E4 — same 1000-cap class once it grows |

Surprise finding: `home/EditorialCalendar.tsx` **never fetches** — month navigation past the SSR
window shows empty cells, and `/api/matches/calendar` (no cache headers) is called only by
`home/Calendar.tsx`, which nothing imports. That route + component are dead on the live home (E6).
`preview/home-c` does not exist in the live tree (worktrees only) — no live duplication; but
`home/data.ts`'s calendar/video selects are duplicated verbatim in `api/matches/{calendar,videos}`
(E7).

### `/OMADA/[id]` (team page) — fixed this session

Was: 7 sequential queries, `teams select('*')`, an 8-col `player_statistics` snapshot of which only
`age` is rendered, and a matches query carrying 5 match cols + 3 tournament cols never rendered.
Now: **one 6-query `Promise.all` wave** + the dependent `match_player_stats` query (skipped
entirely when a team has no finished matches — was a sentinel `.in(match_id,[0])` round-trip).
Narrowed: teams → the 7 rendered cols; `player_statistics` → `(id, age)`; matches → rendered cols
only (`tournament(id,name)` instead of `(id,name,season,slug,logo)`). Scale check: worst team = 303
stat rows / 44 matches — no cap risk. The aggregation itself was already one query, not N+1.

### Standings

`src/app/standings/page.tsx` **does not exist** in the live tree (worktrees only). The live
standings page is `/geniki-katataxi`: ISR 60s, one `Promise.all` of 4 properly-paginated full-table
reads + adjustments, aggregation in JS. Verdict: **ok** — heavy by design (all-seasons engine),
amortized by ISR. It reads neither `teams.season_score` nor `stage_standings`; the three ranking
systems and their consumers are documented in E8.

## C. Fixes shipped this session

1. **loadTournamentIntoStore**: 1000-row truncation fixed (paged reads), 10 sequential awaits → 3
   parallel waves, `select('*')` → column lists (matches −36% payload), unused `season_score`
   dropped, `.single()` → `.maybeSingle()` on the empty awards table, O(players×stats) fallback →
   one pass. Verified live: aggregates now exactly match independent computation; ~660 ms for the
   150-match tournament.
2. **matches/[id]**: dead `player_statistics` join removed from `fetchPlayersForTeam`;
   `winner_team_id/stage_id/group_id` dropped from `fetchMatch`.
3. **OMADA/[id]**: 7 sequential queries → 1 wave + 1 dependent; teams/matches/player_statistics
   selects narrowed to rendered fields; no-finished-matches sentinel query eliminated.
4. **Client-module dedup**: `lib/supabase/Server.ts` (duplicate of `supabaseServer.ts`, one
   importer) deleted; `matches/[id]/page.tsx` now imports `supabaseServer`.
5. `scripts/audit-read-surfaces.mjs` added (read-only quantification, rerunnable).

No page's visual output changes: every dropped column was verified unread by any consumer
(including the admin surfaces), and the loader/team-page aggregation outputs were verified
identical (or corrected, in the truncation case) against live data.

## D. Security-relevant findings

- **D1 — Browser-direct Supabase reads** (`MatchesExplorer.tsx`): the anon key queries `matches`,
  `teams`, `tournaments` from the client. That trio is exactly what the UI needs — the query shape
  is fine. The exposure is that **RLS is still not deployed** (Session 4 finding): the shipped anon
  key can read the entire public schema regardless of what this component queries. Decision: keep
  the client-direct pattern (it's paginated and narrow) — the fix is deploying the Session 4 RLS
  policies, not moving this behind an API route.
- **D2 — Service-role reads on every public route**: `/`, `/matches` (dropdown), `/matches/[id]`,
  `/tournaments*`, `/OMADA/[id]`, `/paiktes`, both `/api/matches/*` routes all read via
  `supabaseAdmin` (RLS bypass), while `api/stages/[id]/standings` deliberately uses the anon
  RLS-bound client. Works today *because* there's no RLS; once RLS lands, either pattern is
  defensible but pick one. Ties into Session 4.

## E. Findings deferred (documented, not fixed here)

- **E1 — Root layout voids ISR site-wide** (verified; known from `project_layout_dynamic`):
  `layout.tsx:71` `await headers()` reads `x-nonce` — but **no middleware exists to set it**, so
  the nonce is always `undefined` and the read buys nothing while forcing every route dynamic
  (voiding `revalidate` 300/60/60/300 on `/`, `/matches`, `/geniki-katataxi`, `/paiktes`).
  **Do not fix in isolation**: no mutation path revalidates `/tournaments/[id]` or `/OMADA/[id]`
  (they declare no `revalidate` at all), and `PATCH /api/matches/[id]` — the score editor —
  triggers **zero** `revalidatePath`. Removing the `headers()` call without adding
  mutation-side revalidation would freeze tournament/team pages indefinitely. Needs its own
  session: remove nonce read → add `revalidate` to tournament/team pages → add `revalidatePath`
  (or tags) to match PATCH, stats save, video save, tournament update/delete (which currently
  revalidates `/tournaments` but not `/tournaments/[id]`; create even targets legacy `/tournoua`).
- **E2 — Loader ships full arrays to the client**: `/tournaments/[id]` serializes all matches/
  players/standings into props; the client paints ≤12 of each per stage, and both desktop+mobile
  branches mount (CSS-hidden). ~200 KB of RSC payload for t23 that windowing would mostly remove.
- **E3 — HomeArticles fetches full article bodies** (4 × TipTap JSON) only to extract the first
  image. Right fix is a cover-image column at write time; skipped here (schema change).
- **E4 — Home top-players distinct-match count**: unbounded `match_player_stats` fetch (393 rows
  today) that will one day cross the 1000 cap and silently undercount; `player_career_stats.
  total_matches` already holds this number — switch reads to it after confirming parity.
- **E5 — `/tournaments/[id]` clones**: `[id]`, `[id]/v2`, `[id]/v2-dark` are three identical
  routes each paying the full loader; retire two after checking inbound links.
- **E6 — Dead calendar fetch path**: `home/Calendar.tsx` + `/api/matches/calendar` (uncached) are
  unused by the live home; `EditorialCalendar` can't navigate past the −60/+90d SSR window (shows
  empty months). Product call: either wire fetch-on-navigate or delete the route + component.
- **E7 — Verbatim query duplication**: `home/data.ts` calendar/video selects ↔
  `api/matches/{calendar,videos}`; `OMADA` match-list join ↔ `matches/[id]` `fetchMatch` shape.
  Extract when next touched; no behavior risk today.
- **E8 — Three ranking systems** (documented per scope, not unified): `teams.season_score` scalar
  (consumers: OMADA chip, OMADES, api/teams, dashboard editor; the only page ranking by it — old
  `/standings` — is not in the live tree); `stage_standings` per-stage tables (progression writes;
  tournament pages + `api/stages/[id]/standings` read); computed Γενική Κατάταξη
  (`geniki-katataxi/points.ts`, reads raw tables only). The OMADA "Σκορ Σεζόν" chip (system 1) can
  disagree with the live Γενική Κατάταξη page (system 3).
- **E9 — `/matches` rows aren't cached at all**: SSR could seed page 1 of the default tab within
  the existing `revalidate = 60` and hand it to `MatchesExplorer` as initial state — one fewer
  round-trip and a real first paint. UI-adjacent; deferred.

## Verification

- `npx tsc --noEmit` clean; `npm run build` clean.
- Loader verified against live DB (independent aggregation, 2 tournaments — exact match).
- Local page loads of `/`, `/matches`, `/matches/[id]`, `/tournaments/23`, `/OMADA/[id]`,
  `/geniki-katataxi`: see session notes (build + smoke pass).
