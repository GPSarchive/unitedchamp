# The Seasonal System — UltraChamp (v3, final)

## Context

The site (Next.js App Router on Vercel + Supabase) has no season dimension: pages show all-time data, Γενική Κατάταξη recomputes per cache miss, `teams.season_score` is hand-typed, and `tournaments.season` is date-derived text the owner doesn't trust. A new season is starting. The owner wants a **whole seasonal system**: every kind of stored data gets an explicit seasonal treatment, everything existing merges into one season that then archives, new seasons start empty, and **nothing is ever deleted**.

## Governing principles (owner-directed)

1. **Aggregate at write time, store season-keyed rows, read stored rows.** Engines (standings, player stats) run only when data changes and write into tables; every page — active season included — is a plain indexed SELECT under ISR. No per-visit computation.
2. **Season membership is assigned, not date-derived.** `tournaments.season` becomes an FK-validated assignment (active season by default, admin can override). The Sep-30 logic in [rules.ts](src/app/geniki-katataxi/rules.ts) survives only as a label *suggestion* when creating the next season row.
3. **Closing a season is a pointer flip.** Active rows freeze because refresh triggers only serve the active season. New season starts with zero teams/rosters/stats.
4. **Nothing gets deleted.** Old data is reachable only through archive surfaces (`/seasons/...` publicly, `/dashboard/seasons` for admin).

## Data-by-data ledger (every table, its decided treatment)

| Data | Treatment |
|---|---|
| `seasons` (NEW) | Lifecycle table; label PK; exactly one `active` row (partial unique index); admin-controlled pointer. |
| `tournaments` | `season` column REMAPPED: **all existing rows → `'2025-2026'`** regardless of current text; then FK to `seasons.label`. New tournaments: wizard dropdown, **defaults to active season, admin can override**. `/tournaments` lists active-season only; archived ones served at `/seasons/[season]/tournaments/[id]` (redirect from old URLs). |
| `tournament_stages/groups/tournament_teams/stage_slots/stage_standings/intake_mappings/tournament_awards` | Engine internals — inherit season via their tournament; untouched structurally; archived with it. |
| `matches` (+`match_player_stats`, `match_participants`) | Inherit season via `tournament_id`. `/matches` explorer + home show **active-season matches only**; old matches reachable through archived tournament pages. Rows never deleted. |
| `teams` | Become **per-season entities**: new `season_label` column; all existing rows backfilled to `'2025-2026'`. After a close, live pages show zero teams until remade (new rows stamped with the new active season; "create from old team" copies name/logo/colour). Old team rows shown on archive pages only. `deleted_at` keeps meaning "mistake/removed". |
| `teams.season_score` | **Retired**: values archived once to `team_season_score_archive`, UI/API references removed, column dropped last. Team pages show stored Γενική points instead. |
| `player` | **Permanent, global.** Never wiped. Gains the `age` column from legacy `player_statistics` (retirement prerequisite). |
| `player_teams` (rosters) | **Season-keyed through the team** (each team row belongs to one season → its roster rows do too). New season = new teams = fresh roster rows; old roster rows stay attached to old team rows forever. |
| `player_season_stats` (NEW) | **THE per-player aggregate.** PK (player_id, season_label); written by the stats engine on match finish (active season) and by close/re-snapshot. Backfill for `'2025-2026'` = today's career numbers (everything existing is that season). |
| `player_tournament_stats` | **Stays** — powers the `?tournament_id=` filter on `/paiktes`. |
| `player_career_stats` + legacy `player_statistics` | **Career concept dissolves — both retire.** Readers cut over to `player_season_stats` (home sections, `/paiktes`, players/teams APIs), writers removed from the refresh pipeline, tables dropped in final cleanup. Non-destructive order: readers → writers → drop. |
| `season_team_standings` (NEW) | Γενική Κατάταξη for ALL seasons incl. active; write-time maintained; per-team `events` jsonb feeds `PointsLog`. The merged `'2025-2026'` table sums everything played so far (confirmed intent). |
| `season_team_adjustments` | Existing rows **remapped to `'2025-2026'`**. Going forward: granted for the active season from the existing admin UI; for archived seasons only from `/dashboard/seasons/[label]` + explicit re-snapshot. |
| `disciplinary_actions` | Inherits season via tournament; untouched. |
| `articles`, `announcements` | **Season-agnostic** — untouched, flow by publish date. |
| `users` (legacy table) | Dead — ignored. |

## Verified ground truth (what we build on)

- [rules.ts](src/app/geniki-katataxi/rules.ts): `seasonStartYearFromDate`/`seasonFromDate`/`seasonLabelFromDate`/`formatSeason` (Sep-30 cutoff) — stays as suggestion-only; the wizard's auto-derive/lock (`deriveSeason()` in [TournamentCURD/actions.ts](src/app/dashboard/tournaments/TournamentCURD/actions.ts), `TournamentBasicsForm.tsx`) is removed in favor of the dropdown.
- Γενική engine [points.ts](src/app/geniki-katataxi/points.ts): `computeGeneralStandings()` (scans tournaments/stages/tournament_teams/matches/adjustments; `SeasonMode` toggle; unstable_cache 60s tag `"geniki-katataxi"`); dense-rank inlined in `StandingsViewGrand.tsx`; `PointsLog.tsx` renders `PointsEvent[]`.
- Player-stats pipeline (already write-time materialized — we extend it): `match_player_stats` → pure [playerStatsAggregation.ts](src/app/lib/playerStatsAggregation.ts) (vitest) → [refreshPlayerStats.ts](src/app/lib/refreshPlayerStats.ts) (non-destructive upserts; incremental `refreshStatsForMatch()` on match finish in progression.ts; full rebuild at `/dashboard/refresh-stats`; CLI `scripts/refresh-player-stats.ts`).
- **RLS** (verified, [enable-public-read-rls.sql](migrations/enable-public-read-rls.sql)): stat caches/adjustments/player are `staff_read` (`public.can_edit_content()`); public pages read via `supabaseAdmin`. All new tables: staff_read + default-deny writes.
- Invalidation hub [revalidatePublicPages.ts](src/app/lib/revalidatePublicPages.ts) (tags `"geniki-katataxi"`/`"season-recap"`, Next 16 `revalidateTag(tag,"max")`) — its 11 caller files are exactly the points-affecting mutation sites where the standings engine must also fire.
- Mobile-first admin prototypes to reuse: `src/app/dashboard/preview/teams-v2/` (top bar, cards, bottom sheets). Tournament loader to reuse for nested routes: [loadTournamentIntoStore.tsx](src/app/tournaments/loadTournamentIntoStore.tsx) (fully tournament-scoped, paginated).
- Migrations run manually in the Supabase SQL editor from `migrations/*.sql`.

---

## Schema (Phase 0 migrations)

### `migrations/add-seasons.sql`
```sql
create table public.seasons (
  label          text primary key,                -- '2025-2026' convention (free text allowed)
  display_label  text not null,                   -- '2025/26'
  status         text not null default 'active' check (status in ('active','archived')),
  started_on date, ended_on date,
  archived_at timestamptz, archived_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index idx_seasons_one_active on public.seasons ((true)) where status='active';

alter table public.teams add column season_label text references public.seasons(label);
create index idx_teams_season on public.teams (season_label);
-- tournaments.season gets its FK AFTER the remap (see backfill), via:
--   alter table public.tournaments add constraint tournaments_season_fkey
--     foreign key (season) references public.seasons(label);
```

### `migrations/add-season-aggregates.sql`
`season_team_standings` (season_label+team_id PK; rank, points, wins/draws/losses, participations, qualifications, titles, runner_ups, adjustment_points, `events jsonb`, refreshed_at; index (season_label, rank)) and `player_season_stats` (player_id+season_label PK; matches/goals/assists/cards/mvp_count/best_gk_count/wins, primary_team_id, updated_at; per-stat DESC indexes on (season_label, X)) and `team_season_score_archive` (team_id PK, score, archived_at) — exactly as v2. All: RLS enabled, `staff_read` SELECT policy, no write policies (service-role only). FK column types copied from `migrations/add-player-stats-cache.sql`.

### Central module — new `src/app/lib/seasons.ts` (server-only; rules.ts stays client-safe)
`listSeasons()` (unstable_cache `["seasons-list"]`, 300s, tag `"seasons"`), `getActiveSeason()` (**the `status='active'` row — the calendar never changes it**), `getSeasonByLabel()`, `listArchivedSeasons()`, `SeasonRow`, `SEASONS_CACHE_TAG`.

---

## Phases

### Phase 0 — Schema + THE MERGE (SQL editor, zero app risk)
1. Run both migrations.
2. Create the merged season and remap everything:
   ```sql
   insert into seasons (label, display_label, status, started_on)
   values ('2025-2026', '2025/26', 'active', null);
   update tournaments set season = '2025-2026';                  -- ALL rows, regardless of prior text
   update season_team_adjustments set season = '2025-2026';      -- ALL rows
   update teams set season_label = '2025-2026' where deleted_at is null;
   alter table tournaments add constraint tournaments_season_fkey
     foreign key (season) references seasons(label);
   ```
   (First check `select distinct season from tournaments;` / `...from season_team_adjustments;` just to know what's being overwritten; keep the output.)
3. Extend `scripts/audit-rls.mjs` with the 4 new tables; run it. Nothing reads the new tables yet.

### Phase 1 — Player-stats engine (career → seasonal)
- [playerStatsAggregation.ts](src/app/lib/playerStatsAggregation.ts): add `aggregateSeasonBuckets(rows, winnerByMatch, seedPlayerIds?)` — same math as `aggregateTournamentBuckets` + `primary_team_id` (extract the most-appearances/first-seen tiebreak from `aggregateCareerBuckets` into a shared helper).
- New `src/app/lib/refreshSeasonStats.ts` (server-only, mirrors refreshPlayerStats contract): `refreshSeasonStatsForPlayers(playerIds, seasonLabel)` and `refreshAllSeasonStats(seasonLabel)` (tournaments where season=label → matches → stats rows → non-destructive upsert/delete on `player_season_stats`).
- [refreshPlayerStats.ts](src/app/lib/refreshPlayerStats.ts): `refreshStatsForMatch()` also refreshes season stats **when the match's tournament's season == active**. (Career/legacy writers stay for now — removed in Phase 6.)
- `scripts/refresh-player-stats.ts`: add `--season=YYYY-YYYY`. Run it for `2025-2026` → `player_season_stats` populated (should equal today's career numbers — that's the verification).
- Tests: extend `src/app/lib/__tests__/playerStatsAggregation.test.ts` (sums parity, primary_team tiebreak, seeded zero-bucket).

### Phase 2 — Standings become stored
- [points.ts](src/app/geniki-katataxi/points.ts): add `seasonScope?: {onlyLabel}` to `ComputeOptions` (filters the tournaments array up front; default = all, recap unaffected); extract `rankLines(lines)` from `StandingsViewGrand.tsx`.
- New `src/app/lib/refreshStandings.ts`: `refreshSeasonStandings(label)` — raw scoped compute → `rankLines` → upsert `season_team_standings` (per-team `events` jsonb), delete vanished teams. Reader `getSeasonStandings(label)` — plain SELECT ordered by rank (used by live page, team pages, archive).
- **Triggers**: call `refreshSeasonStandings(activeLabel)` (awaited, non-fatal `.catch`, like `refreshStatsForMatch` in progression.ts) at the points-affecting mutation sites = the existing revalidate-helper callers: `TournamentCURD/progression.ts`, `api/matches/route.ts` + `[id]/route.ts` + `[id]/postpone/route.ts`, `api/tournaments/[id]/save-all/route.ts`, `api/stages/[id]/reseed/route.ts`, `matches/[id]/actions.ts`, `TournamentCURD/actions.ts` + `preview/actions.ts` + `preview/updateMatchAction.ts`, `dashboard/geniki-katataxi/actions.ts`. Guard: refresh only the active season (archived changes require explicit re-snapshot).
- [geniki-katataxi/page.tsx](src/app/geniki-katataxi/page.tsx): drop `?season=` tabs/searchParams → pure ISR page reading `getSeasonStandings(active)`. Extract podium/ledger/log rendering from `StandingsViewGrand.tsx` into presentational components (shared with archive pages). Add "Παλαιότερες σεζόν →" link.
- Backfill: run `refreshSeasonStandings('2025-2026')` once (script or temporary admin button) — the merged all-history table, per confirmed intent.

### Phase 3 — Admin: seasons area + wizard season control
- New `src/app/dashboard/seasons/`: `page.tsx` + `SeasonsView.tsx` (mobile-first cards + bottom sheets modeled on `dashboard/preview/teams-v2/MobileTeamsView.tsx`), `CloseSeasonSheet.tsx`, `[label]/page.tsx` (per-season detail: stored standings view, that season's tournaments/teams lists linking to existing by-id editors when something old must be fixed, an adjustments panel with the season FIXED — reusing `AdjustmentsClient` — plus "Επανασύγχρονισμός"), `actions.ts` (`"use server"`, admin guard copied from `dashboard/geniki-katataxi/actions.ts`):
  - `preflightCloseSeason(label)` → blockers (past-dated scheduled matches in-season; season strings not in `seasons`), warnings (tournaments still `running`).
  - `closeSeason(currentLabel, nextLabel, nextDisplayLabel)`: auth → preflight → final `refreshSeasonStandings` + `refreshAllSeasonStats` → flip (`archive current; upsert next as active` — sequenced, idempotent; the one-active index makes concurrent double-close a clean error) → archive `season_score` values if the column still exists → revalidate (tags `seasons`/`geniki-katataxi`/`season-archive`/`season-recap`; paths `/`, `/geniki-katataxi`, `/paiktes`, `/OMADES`, `/matches`, `/tournaments`, `/seasons`, `/seasons/[label]`). The wipe itself is **nothing**: team rows already carry the closing label; tournaments/matches/rosters/stats freeze in place. `tournaments.status` is NOT auto-flipped (preflight warns instead). Next-season label defaults from `seasonLabelFromDate(today)` (suggestion only, editable).
  - `resnapshotSeason(label)` — rerun both refreshes for an archived season + revalidate archive surfaces (the only way archived numbers change).
  - `refreshActiveSeason()` — manual safety-net button.
- **Wizard season control**: `TournamentBasicsForm.tsx` — replace the auto-derived/locked season field with a dropdown of `seasons` rows defaulting to the active one; `TournamentCURD/actions.ts` — replace `deriveSeason()` with validation that the submitted label exists in `seasons` (same for `api/tournoua/actions.ts` if still wired).
- Nav: add `{href:"/dashboard/seasons", label:"Σεζόν"}` to `NAV` in `dashboard/ui/ClientShell.tsx`.
- [revalidatePublicPages.ts](src/app/lib/revalidatePublicPages.ts): add `revalidateSeasonArchiveSurfaces(label)` (paths `/seasons`, `/seasons/[label]`; tags `season-archive`, `seasons`).

### Phase 4 — Public pages: current-season everywhere + `/seasons` archive
- **`/OMADES`**: filter `season_label = active` (+ `deleted_at is null`); empty state "Οι ομάδες της νέας σεζόν έρχονται σύντομα".
- **`/paiktes`**: list **only players rostered on active-season teams** (`player_teams` → teams where `season_label=active`); stats from `player_season_stats`; `?tournament_id=` overlay untouched (its dropdown lists active-season tournaments); zero-stat rows render zeros.
- **Home**: `loadHomeData()` matches query gains a `tournament_id in (active season's tournaments)` filter (window stays); top-players sections read `player_season_stats` (active) — first career/legacy reader cutover.
- **`/OMADA/[id]`**: active teams render as today but with roster stats from `player_season_stats`, match list/memberships filtered to the team's season, and the `season_score` tile replaced by "Πόντοι Γενικής" (points+rank from `getSeasonStandings`, passed as prop). **Archived teams redirect** to `/seasons/[label]/teams/[id]` (below).
- **`/matches`**: explorer scoped to active-season tournaments (its tournament filter lists active-season only).
- **`/tournaments`**: server-side filter to active season; status pills stay. **`/tournaments/[id]`**: if the tournament's season is archived → `redirect()` to `/seasons/[label]/tournaments/[id]`.
- **New `src/app/seasons/` routes** (all `revalidate=3600`, dynamic segments with `generateStaticParams(){return []}`):
  - `page.tsx` — "Αρχείο Σεζόν": archived-season cards.
  - `[season]/page.tsx` — hub: final standings via `getSeasonStandings` (shared presentational components), player leaderboards from `player_season_stats`, participating teams (the standings rows), tournaments (`tournaments.eq("season", label)`) linking to the nested pages.
  - `[season]/tournaments/[id]/page.tsx` — archived tournament detail: reuses [loadTournamentIntoStore.tsx](src/app/tournaments/loadTournamentIntoStore.tsx) + the existing v2-dark renderer; guards that the tournament actually belongs to `[season]` (else notFound/redirect); active-season tournaments redirect back to `/tournaments/[id]`.
  - `[season]/teams/[id]/page.tsx` — archived team page: reuses the OMADA components with an "Αρχείο — Σεζόν {display}" badge; guards `team.season_label === season`.
- Public nav/footer: "Αρχείο Σεζόν" → `/seasons`.

### Phase 5 — Admin goes strictly current-season
- `/dashboard/teams`: only `season_label = active`; creation stamps the active label (`api/teams/route.ts` POST); "Δημιουργία από παλιά ομάδα" copies name/logo/colour from an archived team into a new row (picker reads archived teams).
- `/dashboard/matches` (`MatchesDashboard.tsx`) and `/dashboard/tournaments`: filtered to active-season tournaments — no season switch; old data lives in `/dashboard/seasons/[label]` (which links to by-id editors when an old fix is needed).
- `/dashboard/geniki-katataxi`: active season only (archived adjustments happen in the seasons area, Phase 3).
- `/dashboard/refresh-stats`: label copy updated (rebuilds tournament+season tables after Phase 6).

### Phase 6 — Retirements (career stats, legacy table, season_score)
1. **`age` → `player`**: migration `alter table player add column age int;` + one-time copy from `player_statistics`; players APIs read it from `player`.
2. **Reader cutover**: `api/players/route.ts`, `api/players/[id]/route.ts`, `api/teams/[id]/players/route.ts` switch embeds from `player_statistics`/`player_career_stats` to `player_season_stats` (active season) — home already cut over in Phase 4.
3. **Writer removal**: in [refreshPlayerStats.ts](src/app/lib/refreshPlayerStats.ts) remove `syncPlayerStatisticsForPlayers` and the `player_career_stats` upserts; `refreshAllPlayerStats` rebuilds tournament+season tables only. Remove `dashboard/fix-stats` (legacy-only tool) or mark deprecated.
4. **`season_score` removal**: archive SQL (`insert into team_season_score_archive ... select id, season_score from teams where season_score is not null`), then strip from `dashboard/teams/TeamRowEditor.tsx`, `dashboard/preview/teams-v2/*`, `api/teams/route.ts` + `[id]/route.ts`, `OMADA/[id]/page.tsx` + `TeamSidebar.tsx` + `TeamClient.tsx`, `OMADES/page.tsx`; `@deprecated` on the type fields.
5. Verify: grep `season_score|player_statistics|player_career_stats` in `src/` → only deprecated types/archive code.

### Phase 7 — Final cleanup migration
`migrations/drop-retired-columns.sql`: `alter table teams drop column if exists season_score;` + `drop table if exists player_statistics;` + `drop table if exists player_career_stats;` — only after Phase 6 has been live and greps are clean. Remove the deprecated type fields. (Optional follow-up: recap modal reads stored tables / `getActiveSeason()`.)

---

## Read/write matrix

| Data | Written by (when) | Read by |
|---|---|---|
| `seasons` | closeSeason (flip) | `getActiveSeason()` everywhere |
| `season_team_standings` | `refreshSeasonStandings` at the 11 mutation sites (active) · re-snapshot (archived) | `/geniki-katataxi`, OMADA points tile, `/seasons/[season]` |
| `player_season_stats` | `refreshStatsForMatch` (active) · close/re-snapshot/CLI | `/paiktes`, home, OMADA rosters, players/teams APIs, `/seasons/[season]` |
| `teams.season_label` | creation (stamped active) · Phase-0 merge | `/OMADES`, admin teams, OMADA/nested routing |
| `tournaments.season` | wizard dropdown (default active) · Phase-0 merge | every season filter; nested-route guards |
| Freshness | existing `revalidatePublicPages` helpers at the same sites (+ archive helper) | route ISR (60–3600s) + tags |

## Verification

- **Vitest** (`npm test`, 114 tests): `aggregateSeasonBuckets` (sums parity, primary-team tiebreak, seeded zero bucket, season == career identity); `geniki-katataxi/__tests__/points.test.ts` over the pure engine (`engine.ts`): seasonScope yields only that season, W/D/L/participation/qualification/title/runner-up points, cancel-tag pairing, forfeit/leg rules; `standingsShape` (dense rank, extras, `rankVisible`); `seasonChecks` (team↔season mismatches, season-move labels).
- **Engine equivalence on prod data**: `npx tsx scripts/audit-season-standings.ts` (read-only) recomputes with the scoped loader + pure engine and diffs against the stored rows — 0 drift after the split (2026-09-04).
- **Drift audits**: `scripts/audit-player-stats-drift.mjs` covers `player_season_stats`; `scripts/audit-season-standings.ts` covers `season_team_standings`. `scripts/audit-rls.mjs` covers the new tables AND proves the anon key cannot execute `flip_active_season` / `set_active_season`.
- **Close flow**: `migrations/add-season-flip-fn.sql` carries a `BEGIN … ROLLBACK` block that exercises both functions against the real rows without committing (one active row at every step, `ended_on` set/cleared). The actions refuse to run on the preview deployment.
- **Manual smokes**: finish a test match → standings + season stats rows update without a page visit; old URLs redirect (`/tournaments/[old]` and both `/v2*` variants → `/seasons/2025-2026/tournaments/[old]`, `/OMADA/[old]` → nested); a team's "#" on `/OMADA/[id]` equals its row on `/geniki-katataxi`; `/paiktes?tournament_id=<archived>` shows the unfiltered directory; re-snapshot after an old-season adjustment updates the hub AND its nested pages.

## Risks / edge cases

- **Missed refresh triggers** (same class as the known C1/C2 cache gaps): mitigated by wiring at the existing revalidate call sites, the manual refresh button, and the drift audits.
- **Merged-season display**: `'2025-2026'` archive sums 1.5+ years of play into one table — confirmed intent; display_label "2025/26" should probably be a friendlier text (owner can set it in the seasons row).
- **Empty new season**: every main page needs a graceful empty state post-close, pre-remake.
- **Redirect loops/guards**: nested pages guard season membership; active content redirects out, archived redirects in — cover both directions in tests.
- **Adjustments to archived seasons**: stored rows stay stale until re-snapshot — stated in the admin UI copy.
- **Concurrent close**: one-active partial index → clean, catchable error.
- **Recap modal**: unaffected (own compute over the unscoped engine, which remains).
- **`/matches/[id]`** (revalidate 0): works for any match, any season — no change.

## Critical files

New: `migrations/{add-seasons.sql,add-season-aggregates.sql,drop-retired-columns.sql}` (+ the `age` migration), `src/app/lib/{seasons.ts,refreshSeasonStats.ts,refreshStandings.ts}`, `src/app/dashboard/seasons/{page.tsx,SeasonsView.tsx,CloseSeasonSheet.tsx,[label]/page.tsx,actions.ts}`, `src/app/seasons/{page.tsx,[season]/page.tsx,[season]/tournaments/[id]/page.tsx,[season]/teams/[id]/page.tsx}`.

Modified: `src/app/geniki-katataxi/{points.ts,page.tsx,StandingsViewGrand.tsx}`, `src/app/lib/{playerStatsAggregation.ts,refreshPlayerStats.ts,revalidatePublicPages.ts,types.ts}`, the 11 mutation files (one call each), `src/app/paiktes/page.tsx`, `src/app/home/{data.ts,EditorialTopPlayersSection.tsx,TopPlayersSection.tsx}`, `src/app/OMADA/[id]/*`, `src/app/OMADES/page.tsx`, `src/app/matches/page.tsx`, `src/app/tournaments/{page.tsx,[id]/page.tsx}`, `src/app/api/teams/*`, `src/app/api/players/*`, `src/app/api/teams/[id]/players/route.ts`, `src/app/dashboard/tournaments/TournamentCURD/{actions.ts,basics/TournamentBasicsForm.tsx}`, `src/app/dashboard/{teams,matches,tournaments,geniki-katataxi,refresh-stats}/*` (filters/labels), `src/app/dashboard/ui/ClientShell.tsx`, `scripts/{audit-rls.mjs,audit-player-stats-drift.mjs,refresh-player-stats.ts}`, tests.
