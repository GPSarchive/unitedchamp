# Seasonal system — DATA CHANGES CONTRACT (for approval)

Status: **APPROVED 2026-09-04 (D1=A, D2=yes, D3=retire, D4=`'2025-2026'`, D5=stamp all 62 teams). Phase 0 APPLIED IN PROD 2026-09-04: add-seasons.sql, add-season-aggregates.sql and seasonal-phase0-merge.sql ran in the Supabase SQL editor; all 7 verify checks true; `scripts/audit-rls.mjs` clean (pre-flight grid in `migrations/records/`).**
Pre-flight against prod ran read-only on 2026-09-04 — results are inlined in §3.0 so they are on record.
Companion: [seasonal-system-plan-v3.md](seasonal-system-plan-v3.md) (code/phases). This file is only about
**what happens to the data**. Once approved, migrations are written from this file and nothing else.

Approved by the owner in conversation on 2026-09-04. Any later change to the data model must be made here first, then in the migrations.

---

## 1. Decisions you need to make

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | How teams get a season | **A** — a new team row every season (`teams.season_label`). **B** — teams are permanent; a `team_seasons` membership table says who played which season; rosters (`player_teams`) get a `season_label`. | **DECIDED: A.** (B was recommended for identity/lineage; owner chose A. `copied_from_team_id` lineage column is kept as the cheap mitigation.) |
| **D2** | The one-time merge | Stamp **every** existing tournament, adjustment and team `'2025-2026'`. | **DECIDED: yes.** Pre-flight shows this is a no-op for tournaments and adjustments (all already `'2025-2026'`) and the match dates (2025-10-14 → 2026-07-20) fall inside one Sep-30 season, so the archive is a genuine single season, not an artificial lump. |
| **D3** | All-time (career) player numbers | **Retire** (`player_career_stats` + legacy `player_statistics` dropped; `/paiktes` and home show active season only) **or keep** career as a read-only extra tab. | **DECIDED: retire.** Can be re-added later by summing `player_season_stats`. |
| **D4** | Season label format | Storage key `'2025-2026'` + separate `display_label` `'2025/26'`. | **DECIDED: `'2025-2026'`** as the key; `display_label` column kept for the UI. |
| **D5** | Soft-deleted teams in the merge | Pre-flight found **15 of the 17 `deleted_at` teams played real matches this season** (225 matches, 159 roster rows, 24 tournament_teams rows, 4 adjustments). `deleted_at` is being used as "left the league / archived", not "mistake". | **DECIDED: stamp ALL 62 teams `'2025-2026'`, deleted ones included.** Otherwise their matches, rosters and standings lines belong to no season and the archive is incomplete. Live pages keep filtering `deleted_at is null` exactly as today; the archive pages show them (optionally with a "αποχώρησε" badge). |

---

## 2. Table-by-table ledger

Legend: ➕ new · ✏️ altered · ⏸ untouched (inherits season) · 🗑 retired (archive → readers → writers → drop, in that order)

### 2.1 New tables ➕

| Table | Purpose | Key |
|---|---|---|
| `seasons` | The list of seasons and **the pointer** (exactly one `status='active'`, enforced by a partial unique index). Admin-controlled; the calendar never flips it. | `label` PK (`'2025-2026'`), `display_label`, `status active\|archived`, `started_on`, `ended_on`, `archived_at`, `archived_by`, `created_at` |
| `player_season_stats` | Per-player, per-season aggregate. Written by the stats engine when a match finishes (active season only) and by close / re-snapshot. Columns verified 2026-09-04 against `TournamentBucket` in `src/app/lib/playerStatsAggregation.ts` + `primary_team_id` from `CareerBucket`: `matches, goals, assists, yellow_cards, red_cards, blue_cards, mvp_count, best_gk_count, wins, primary_team_id, updated_at`. This is a superset of what `/paiktes`, home top-players and the players APIs read from `player_career_stats` today (only the `total_` prefix differs). **Note:** a dead, empty table with this exact name already exists in prod (verified 0 rows) — it is dropped and recreated. | PK (`player_id`, `season_label`); indexes `(season_label, goals desc)` etc. mirroring `idx_pcs_*` |
| `season_team_standings` | The stored Γενική Κατάταξη, every season including the active one. Replaces compute-on-visit. Columns verified against `TeamSeasonLine` in `src/app/geniki-katataxi/points.ts` — **`adjustment_count` was missing from plan v3 and is added** (the ledger renders it). Per-team points log stored as `events jsonb` (array of `PointsEvent` incl. the per-match `MatchDetail` breakdown the expandable log uses). Deleted teams get rows too (D5); the live page filters them as it does today. | PK (`season_label`, `team_id`), `rank`, `points`, `wins, draws, losses`, `participations, qualifications, titles, runner_ups`, `adjustment_points, adjustment_count`, **`matches_played, goals_for, goals_against, clean_sheets, longest_win_streak`** (owner-required extras, computed at the same refresh from the season's finished matches), `events jsonb`, `refreshed_at`; index `(season_label, rank)` |
| `season_recaps` (new, recommended) | The exact payload `src/app/home/seasonRecap.ts` already builds (totals, podium, honours chronology, four awards, records) — computed **once at season close / re-snapshot** and stored as `jsonb`, instead of recomputed by the modal. This is what makes the archive pages rich for free: see §6. | `season_label` PK, `payload jsonb`, `generated_at` |
| `team_season_score_archive` | One-time dump of `teams.season_score` before that column is dropped. Read by nothing; exists so nothing is lost. 6 rows expected (incl. deleted team `test`=22). | `team_id` PK, `score`, `archived_at` |
| ~~`team_seasons`~~ | Not created (D1=A). | |

RLS: `seasons` is **public-read** (labels are not sensitive; the archive hub lists them). The four result tables are `staff_read` via `public.can_edit_content()`. **No write policies anywhere** (service role only), matching `migrations/enable-public-read-rls.sql`. Public pages read through `supabaseAdmin` as they already do for the stat caches.

### 2.2 Altered tables ✏️

| Table | Change | Notes |
|---|---|---|
| `tournaments` | `season` text column **kept**, gets `FOREIGN KEY (season) REFERENCES seasons(label)` **after** the merge. The wizard's auto-derive/lock is replaced by a dropdown defaulting to the active season. | No new column. |
| `teams` | ➕ `season_label text NOT NULL REFERENCES seasons(label)` + index (NOT NULL applied after the merge). ➕ `copied_from_team_id bigint REFERENCES teams(id)` (lineage, filled by "create from old team"; optional but cheap). | New season = new rows; live pages filter `season_label = active`. |
| `player_teams` | ⏸ untouched. A roster row points at a team row that belongs to one season. | |
| `season_team_adjustments` | `season` values **remapped** to `'2025-2026'` in the merge (today they may be `'2024/25'`-style), then FK to `seasons(label)`. | Going forward: active season from the existing admin UI; archived seasons only from `/dashboard/seasons/[label]` + re-snapshot. |
| `player` | ➕ `age int` copied once from legacy `player_statistics.age` (prerequisite for D3). | Player rows are permanent and global; never season-stamped. |

### 2.3 Untouched — season inherited through a parent ⏸

`tournament_stages`, `tournament_groups`, `tournament_teams`, `stage_slots`, `stage_standings`, `intake_mappings`, `tournament_awards`, `matches`, `match_player_stats`, `match_participants`, `disciplinary_actions` → all reach a season via `tournament_id`.
`player_tournament_stats` → via `tournament_id` (**stays**, powers the `?tournament_id=` filter on `/paiktes`).
`articles`, `announcements` → season-agnostic, flow by publish date.
`users`, `posts`, `audit_logs` → dead (audit), ignored here; drop them in the cleanup migration if you want.

**Rows in these tables are never updated or deleted by the seasonal work.**

### 2.4 Retired 🗑 (order is fixed: archive → switch readers → remove writers → drop)

| Object | Why | Drop happens in |
|---|---|---|
| `teams.season_score` | Hand-typed, season-less, stale (5 teams non-zero since 2026-01-04). Team pages show stored Γενική points instead. | Phase 7, after values are in `team_season_score_archive` |
| `player_career_stats` (D3) | Career concept dissolves into `player_season_stats`. | Phase 7 |
| `player_statistics` legacy (D3) | Superseded; only unique data is `age` (moved to `player`). | Phase 7 |
| old empty `player_season_stats` | Dead table, name reused. | Phase 0 (drop + recreate) |

---

## 3. The one-time merge (Phase 0) — exact SQL, run once in the Supabase SQL editor

### 3.0 Pre-flight (read-only; **keep the output** — it is the only record of what gets overwritten)
```sql
select season, count(*) from tournaments group by 1 order by 1;
select season, count(*) from season_team_adjustments group by 1 order by 1;
select count(*) filter (where deleted_at is null) as live_teams, count(*) as all_teams from teams;
select count(*) from player_teams;
select data_type from information_schema.columns where table_name='teams' and column_name='id';  -- int vs bigint for FKs
select count(*) from player_season_stats;  -- expect 0 (dead table)
```
Take a Supabase backup (dashboard → Database → Backups) before 3.2.

**Result on 2026-09-04 (service-role, read-only):**

| Check | Value |
|---|---|
| `tournaments.season` | 8 tournaments, **all `'2025-2026'`** (ids 13, 20, 23, 31, 32, 33, 34, 35). `start_date`/`end_date` null on all. |
| match dates | earliest 2025-10-14, latest 2026-07-20 → one Sep-30 season |
| `season_team_adjustments.season` | 51 rows, **all `'2025-2026'`** |
| teams | 62 total: 45 live, 17 soft-deleted (15 of which played matches — see D5) |
| `teams.season_score` non-zero | KALIMOXTA 4, BOCA SENIORS 18, PINK PANTHERS 28, FLAMINGOS 1, BRODIOS 20, test 22 (deleted) |
| `player_teams` | 808 rows (159 on deleted teams) |
| `matches` | 623 |
| `player` / `player_statistics` / `player_career_stats` | 779 / 779 / 756 (career has no row for players with 0 matches) |
| dead `player_season_stats` | 0 rows |

**What the merge actually overwrites, given the above: nothing.** The two `update ... set season` statements rewrite values that are already `'2025-2026'`. The only new data written is the season stamp on teams and the `seasons` row.

### 3.1 Schema (additive, safe to run before anything reads it) — files written 2026-09-04
`migrations/add-seasons.sql` — `seasons` table + one-active index + `teams.season_label` + `teams.copied_from_team_id`.
`migrations/add-season-aggregates.sql` — `drop table if exists player_season_stats;` then `player_season_stats`, `season_team_standings`, `season_recaps`, `team_season_score_archive`, RLS.
`migrations/seasonal-phase0-merge.sql` — §3.0 pre-flight (commented, run first), §3.2 merge, §3.3 verify, all in one file.

### 3.2 The merge (this is the irreversible-in-spirit step; rows are updated, none deleted)
```sql
insert into seasons (label, display_label, status)
values ('2025-2026', '2025/26', 'active');

update tournaments             set season = '2025-2026';                       -- ALL rows (D2)
update season_team_adjustments set season = '2025-2026';                       -- ALL rows (D2)

update teams set season_label = '2025-2026';                                  -- ALL 62 rows, deleted included (D5)

alter table tournaments
  add constraint tournaments_season_fkey foreign key (season) references seasons(label);
alter table season_team_adjustments
  add constraint season_team_adjustments_season_fkey foreign key (season) references seasons(label);
alter table teams alter column season_label set not null;                    -- from now on every team has a season
```
`deleted_at` keeps its current meaning for live pages (hidden). In the archive a deleted team is simply a team of that season that left.

### 3.3 Verify
```sql
select count(*) from tournaments where season <> '2025-2026';              -- 0
select count(*) from season_team_adjustments where season <> '2025-2026';  -- 0
select count(*) from teams where season_label is null;                     -- 0
select count(*) from seasons where status = 'active';                      -- 1
```

### 3.5 What we lose in the merge (honest list)
- **Nothing in tournaments or adjustments** — the values are already `'2025-2026'` (§3.0).
- **`teams.season_score`** — 6 hand-typed numbers, copied to `team_season_score_archive` before the column drops. They stop being displayed.
- **The "Χωρίς σεζόν" / per-year split** in Γενική Κατάταξη's season tabs — already gone in the data; nothing to lose.
- **Ability to later split 2025-2026 into two seasons** — theoretically possible by editing `tournaments.season` per tournament (the FK allows any existing label), so not truly lost, but standings/stats would need a re-snapshot per season.
- **Career totals as a stored table** — dropped in Phase 7, but for this single season `player_season_stats('2025-2026')` is identical by construction (the acceptance test), and any future all-time view is `sum(...) group by player_id`.
- **The 23 players with 0 matches** have a `player_statistics` row but no career row; they get no `player_season_stats` row either. Pages already render zeros for missing rows.
Then `node scripts/audit-rls.mjs` (extended with the new tables) → anon reads 0 rows from every new table.

### 3.4 Backfills (Phase 1–2, scripts, re-runnable)
- `player_season_stats` for `'2025-2026'` ← recompute from `match_player_stats`. **Must equal `player_career_stats` row-for-row** (everything is one season). Diff script is the acceptance test. **DONE 2026-09-04**: `npx tsx scripts/refresh-player-stats.ts --season=2025-2026` → 623 matches, 6639 rows, 752 season rows; `scripts/audit-player-stats-drift.mjs` → 0 drift, equivalence 0 of 756 (the 4 career-only rows are 0-match rows the season table deliberately omits).
- `season_team_standings` for `'2025-2026'` ← run the existing Γενική engine once, scoped. **Must match the live `/geniki-katataxi` page** before the page is switched to read the table. **DONE 2026-09-04**: `npx tsx scripts/refresh-standings.ts --season=2025-2026` → 60 rows (45 live + 15 that left); `scripts/audit-season-standings.ts` → 0 drift, GF = GA = 4578, matches_played Σ = W+D+L Σ = 1114. `/geniki-katataxi` now reads the stored rows (static ISR, no season tabs); every points-affecting mutation site calls `refreshActiveSeasonStandings()` before revalidating.
- `team_season_score_archive` ← `insert ... select id, season_score from teams where season_score is not null` (5 rows expected).

---

## 3.6 Phase 3 (admin) — written 2026-09-04
`/dashboard/seasons` (list + action sheet), `/dashboard/seasons/[label]` (stored vs live standings with a drift banner, tournaments → editor links, teams, adjustments panel with the season fixed), server actions `preflightCloseSeason` / `closeSeason` / `resnapshotSeason` / `refreshActiveSeason` / `setActiveSeason` (admin-only). `lib/seasonSnapshot.ts` = stats → standings → recap (`season_recaps` written by `lib/refreshSeasonRecap.ts` from `computeSeasonRecapFor(label)`); CLI `scripts/snapshot-season.ts --season=`. Wizard: season is a dropdown from `GET /api/seasons` defaulting to the active season; the server validates the label exists (`resolveSeasonLabel`), `deriveSeason` deleted. `season_recaps('2025-2026')` written 2026-09-04.

## 3.7 Phase 4 (public pages) — written 2026-09-04
Live pages read the ACTIVE season only via `lib/seasonScope.ts`: `/OMADES` (`teams.season_label`), `/paiktes` (players rostered on active-season teams; numbers from `player_season_stats`; tournament dropdown active-only), home (matches window + tournaments scoped; top players from `player_season_stats`), `/matches` (explorer never leaves the active season's tournament ids), `/tournaments` (scoped), `/tournaments/[id]` and `/OMADA/[id]` redirect archived-season rows to `/seasons/[label]/…`. Team page: `season_score` chip replaced by the stored Γενική rank/points; data loading shared in `OMADA/[id]/loadTeamPage.ts`. Archive: `/seasons` (list), `/seasons/[season]` (hub from `season_recaps` + stored standings + `player_season_stats` leaderboards + season teams/tournaments), `/seasons/[season]/katataxi` (full table, same view as live), `/seasons/[season]/tournaments/[id]`, `/seasons/[season]/teams/[id]` (membership-guarded; active season redirects to the live routes). Nav: "ΑΡΧΕΙΟ ΣΕΖΟΝ"; live standings masthead links to `/seasons`. `home/TopPlayersSection.tsx` (unused legacy reader) deleted. Because every row is stamped `'2025-2026'` = active, nothing visible changes today.

## 4. What "closing a season" does to the data

1. Final refresh of `player_season_stats` and `season_team_standings` for the closing season.
2. `update seasons set status='archived', archived_at=now() where label=<current>`; `insert into seasons (...) values (<next>, ..., 'active')`. Sequenced; the one-active index makes a concurrent double-close a clean error.
3. **That is all.** No rows in any other table are touched. Tournaments, matches, stats, rosters and teams freeze in place because refresh triggers only serve the active season and live pages only read the active label.
4. New season starts with: zero tournaments, zero teams, zero `player_season_stats` rows. Every public page shows an empty state until admins create/register.
5. Archived numbers change only via an explicit admin "re-snapshot" of that season.

`tournaments.status` is **not** auto-flipped to archived (preflight warns about still-`running` tournaments instead).

---

## 5. Rollback / safety

- Everything through Phase 6 is **additive**: new tables, new columns, new rows. The old tables keep being written until Phase 6 removes the writers. Rolling back = stop reading the new tables.
- The only destructive statements are in **Phase 7** (`drop column season_score`, `drop table player_career_stats`, `drop table player_statistics`) and they run only after greps for those names in `src/` are clean and the site has been live on the new tables.
- The merge in §3.2 overwrites `tournaments.season` / `season_team_adjustments.season` text. The pre-flight output in §3.0 is the record of the previous values.
- The audit's cleanup items (`tournament_awards` read → compute in loader **before** any drop; 2 dummy `stage_slots` rows; `posts`/`audit_logs`/`users`) ride along in Phase 7, not earlier.

---

## 6. Archive pages — what an old season can show from stored data only

Everything below is a plain SELECT on a snapshot; no engine runs when someone opens `/seasons/2025-2026`.

From `season_recaps` (the recap modal payload, computed once at close):
- **Podium** (top 3 of Γενική) and **honours timeline** (every tournament, its dates, winner + logo).
- **Season totals**: matches, goals, assists, MVP awards, teams, players, tournaments.
- **Four awards**: top scorer, top assister, most MVPs, best goalkeeper (with the editorial tie-break already encoded).
- **Records**: highest-scoring match, best single-match haul, most team wins, most appearances.

From `season_team_standings`:
- **Full final Γενική table** with rank, points, Συμ./Προκ./titles/finals/W-D-L/adjustments, plus the **expandable points log per team** (`events`), exactly as the live page renders today.
- Teams that left mid-season (D5) shown with a badge.

From `player_season_stats`:
- **Player leaderboards** for the season: goals, assists, cards, MVP, best GK, wins, appearances — sortable, same component as `/paiktes`.
- **Per-team rosters with season stats** on the archived team page (roster = `player_teams` of that team row; numbers from `player_season_stats` + `primary_team_id`).

From existing tables, already season-scoped through `tournament_id`:
- **Tournament list** of the season, each opening the full archived tournament (bracket, groups, standings, every match) via the existing tournament renderer.
- **Head-to-head / match archive**: every match of the season is still in `matches` — the explorer component can run scoped to the season's tournament ids.
- **Disciplinary summary** per team (`disciplinary_actions` via tournament).

Required extras (owner decision 2026-09-04: "if we display them we compute them"):
- Team **matches played, goals for / against, clean sheets, longest win streak** per season → real columns on `season_team_standings`, filled by the same refresh that writes points (source: the season's finished matches; two-legged legs count as individual matches).
- **Forward link** from an archived team to the same club's next-season row → no new column; it is the reverse lookup `select id from teams where copied_from_team_id = :archived_id` (index on `copied_from_team_id`). Shown as "Συνεχίζει ως … στη σεζόν …".
- **Monthly activity** (matches per month) → `months jsonb` key inside the `season_recaps` payload.

## 7. Explicitly NOT changing

- No match, stage, group, standing, stat row or disciplinary action is edited or deleted.
- No player row is season-stamped or removed.
- `player_tournament_stats` stays and keeps being written.
- `rules.ts` (Sep-30 cutoff) stays, but only to *suggest* the next season label to the admin.
- Articles and announcements are untouched.
