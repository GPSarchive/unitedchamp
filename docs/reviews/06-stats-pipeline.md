# Session 6 — Player stats pipeline: findings & fixes

Branch: `review/06-stats-pipeline` · Date: 2026-07-10

Scope: `match_player_stats` (source of truth) → `player_career_stats` / `player_tournament_stats`
(caches) → leaderboards, plus the legacy `player_statistics` table.

## Verification result (live data)

`scripts/audit-player-stats-drift.mjs` (read-only), before this session's rebuild:

- `player_statistics`: **0 / 777** drifted
- `player_career_stats`: **16 / 754** drifted — all `total_wins` ±1, plus one `total_goals` (player 193)
- `player_tournament_stats`: **16 / 1206** drifted — all `wins`, all in **tournament 34** (Summer League)

Root cause fits the known history: the KO repairs of 2026-07-07 (semis) and 2026-07-10 (match 2566
penalties) changed `matches.winner_team_id` without any cache refresh — exactly the stale-cache
paths listed under B below. Legacy showed zero drift only because it doesn't track wins.

After running the (rewritten, non-destructive) `refreshAllPlayerStats` via
`npx tsx scripts/refresh-player-stats.ts`: **0 drift in all three tables** (4 stale career rows for
stat-less players were also removed). `npm test`: 77 passing, incl. 14 new aggregation tests.

## A. Aggregation semantics (documented, not changed)

These are now written down in `src/app/lib/playerStatsAggregation.ts` and locked by unit tests:

- **A1 — Two-legged ties**: leg 1 stores `winner_team_id = null`, the leg-2 decider stores the tie
  winner. So a won tie = exactly **one** win (never double-counted), leg-1 on-the-night wins count
  nothing, and the decider credits the tie winner's players even if they lost leg 2 on the night.
  Artifact of the "leg 2 is the decider" model; consistent across incremental and full rebuild.
- **A2 — Forfeits (3-0 award)**: no `match_player_stats` rows are created, so nobody is credited an
  appearance or a win. `refreshStatsForMatch` early-returns. Product decision to revisit if forfeit
  wins should count.
- **A3 — Own goals** are not aggregated into any per-player total (they only affect team score).
- **A4 — No status filter**: a match's stats rows count regardless of `matches.status`. Harmless as
  long as reverts delete the rows (planner revert does) — see B2 for the path that doesn't.
- **A5 — Mid-season team changes**: stats accumulate across teams; wins follow the row's team;
  `primary_team_id` = team with most appearances, ties → team of the earliest stats row.
  Deterministic and identical in both refresh paths.

## B. Bugs found (fixed this session where in scope)

| # | Finding | Status |
|---|---|---|
| B1 | Career/tournament aggregation math was duplicated between `refreshCareerStatsForPlayers`/`refreshTournamentStatsForPlayers` and `refreshAllPlayerStats` — parity held today but nothing enforced it. | **Fixed**: extracted pure `playerStatsAggregation.ts`, both paths (and the legacy sync and fix-stats) now share it; unit-tested. |
| B2 | `refreshAllPlayerStats` did **delete-ALL-then-reinsert** on both cache tables: public readers saw empty caches mid-rebuild, and a crash mid-run left them gutted. | **Fixed**: upsert first, then delete only rows with no remaining source stats (career by player, tournament by composite key with stable two-column pagination). |
| B3 | Cache upsert errors were `console.error`'d and swallowed — `refreshAllPlayerStats` reported success counts even when batches failed; incremental refreshers reported nothing. | **Fixed**: all write failures now throw (every caller already wraps in try/catch). |
| B4 | `refreshTournamentStatsForPlayers` read the tournament's matches with a plain `.select()` — silently capped at ~1000 rows by PostgREST. | **Fixed**: paginated. |
| B5 | `applySyncFix` (fix-stats) **zeroed every `player_statistics` row, then re-upserted**: home top-scorers (which read this table live) briefly showed zeros, and a crash between the steps published zeros permanently. Upsert was also a single unbatched payload. | **Fixed**: single batched upsert pass; zero rows are written only for players whose source stats vanished. |

## C. Stale-cache paths (out of this session's fix scope — routes/actions)

None of these refresh any aggregate after changing win/stat-relevant data. They are the proven
source of the drift found above. Each needs a `refreshStatsForMatch(matchId)` (or
`refreshCareerStatsForPlayers` + `refreshTournamentStatsForPlayers` with player ids captured
**before** the mutation):

- **C1 — `PATCH /api/matches/[id]` revert to `scheduled`** (`route.ts:397-410`): clears
  winner/scores, keeps stats rows, and `progressAfterMatch` only runs when `finalStatus ===
  'finished'` (`route.ts:505`). Career/tournament `wins` stay stale. This is the likely mechanism of
  the tournament-34 drift (winner edits during KO repairs).
- **C2 — `DELETE /api/matches/[id]`** (`route.ts:635`): match + cascaded stats vanish, aggregates
  keep the contributions. Capture affected player ids before the delete, refresh after.
- **C3 — `deleteTournamentAction` and `updateTournamentAction`'s delete-and-reinsert of all matches**
  (`TournamentCURD/actions.ts:912, 1242`): whole tournaments disappear with no refresh; also leaves
  orphaned `player_tournament_stats` rows for the deleted tournament id. (The non-destructive
  rebuild now cleans those when run.)
- **C4 — planner `saveMatchStatsAction` winner stamping** (`preview/actions.ts:360-363`): pure
  `aGoals > bGoals`, no two-legged awareness — stamps a winner on leg 1 and the on-the-night winner
  on deciders, so win totals depend on which editor saved the match. Also rejects a drawn leg 1 as
  "KO tie". → **Session 1** (save-path), noted here because it corrupts win attribution.
- **C5 — `saveMatchStatsAction` cache refresh depends on progression not throwing**: when
  `status === 'finished'`, current players are refreshed only inside `progressAfterMatch` (caught
  non-fatally at `preview/actions.ts:404-411`); if it throws before its refresh step, only removed
  players get refreshed. → Session 1 notes.
- **C6 — concurrency**: two finalizes for overlapping players can interleave read-recompute-upsert
  so the later write is computed from a pre-write snapshot. Self-heals on the next refresh; if it
  ever matters, move the recompute into a Postgres function (single statement) or take a per-player
  advisory lock. Documented, not fixed.

## D. Tooling notes

- `/dashboard/fix-stats` compares **only the legacy table**; `/dashboard/audit-stats`
  (`auditPlayerStats.ts`) is the real drift detector — it covers all three tables, diagnoses causes,
  and is read-only and correct. `/dashboard/refresh-stats` fixes the caches, fix-stats fixes legacy.
  Consider linking audit-stats from both fix tools so the read path and the write path meet.
- `applySyncFix` intentionally overwrites admin-edited legacy totals (hand edits are possible via
  `PATCH /api/players/[id]`). The confirm dialog says so; the retirement plan removes the tension.
- New: `scripts/refresh-player-stats.ts` runs the real rebuild from the CLI;
  `scripts/audit-player-stats-drift.mjs` messages updated (all writers paginate now).

---

# `player_statistics` retirement plan

**Decision: canonical per-player aggregate = `player_career_stats`** (rebuilt from
`match_player_stats`, the source of truth). The legacy table's stat columns are a strict subset
(goals/assists/3 cards — no matches/wins/MVP/GK), and it is the **only** aggregate with two
uncoordinated writers (recompute-from-source *and* hand edits via the admin player APIs), which is
unreconcilable by design.

**The one thing legacy has that nothing else does: the `age` column** (written on player create and
admin edit). It is player master data, not a statistic — it must move to `player`.

### Current surface (full map, verified 2026-07-10)

- **Writers**: `syncPlayerStatisticsForPlayers` (match save + planner save), `applySyncFix`
  (fix-stats), `POST /api/players` + `POST /api/teams/[id]/players` (create zero row + age),
  `PATCH /api/players/[id]` (hand-edited totals + age), seed/delete scripts.
- **Readers that query it**: home `TopPlayersSection` + `EditorialTopPlayersSection` (top
  scorers/assisters!), `matches/[id]/queries.ts` embed, `OMADA/[id]/page.tsx` embed,
  `GET /api/players`, `GET/PATCH /api/players/[id]`, `GET /api/teams/[id]/players(+/[playerId])`,
  fix-stats page. Plus ~15 components consuming the embed as props (dashboard players/teams UIs,
  OMADA sections, `matches/[id]/TeamPlayers`).
- Notably **/paiktes does NOT read it** — it reads the caches. So today the home leaderboard and the
  players page read *different tables* and can disagree.

### Phase 0 — prerequisite (1 small migration)
Add `age` to `player` (or compute from a birthdate if one is ever added); backfill from
`player_statistics.age`; update the three player APIs to read/write `player.age`.

### Phase 1 — migrate readers (each independently shippable)
1. Home sections → `player_career_stats` (`total_goals`/`total_assists` exist; also removes the
   extra `match_player_stats` query these sections run for match counts — `total_matches` is in the
   cache). This unifies home with /paiktes.
2. The embed readers (`matches/[id]/queries.ts`, `OMADA/[id]/page.tsx`, player/team APIs): switch the
   embedded resource to `player_career_stats(...)` — it's keyed 1:1 by `player_id`, so the
   `.order/.limit(1)` latest-row dance disappears. Update `types.ts` normalizers once
   (`PlayerStatisticsRow` → career columns), and the ~15 prop consumers follow mechanically.
3. `PATCH /api/players/[id]`: drop the hand-edit of stat totals (stats are derived data; hand edits
   are already clobbered by every sync). Keep only `age` (now on `player`).

### Phase 2 — stop writes
Remove `syncPlayerStatisticsForPlayers` + its two call sites; remove the zero-row insert from the
player-create APIs; retire `/dashboard/fix-stats` (its diff view can point at
`/dashboard/audit-stats`, its apply button becomes redundant).

### Phase 3 — drop
One release later (after `audit-stats` shows nothing reads it — grep + logs), `DROP TABLE
player_statistics`. If any external consumer is feared, replace it for one release with a
compatibility VIEW over `player_career_stats` first:
`CREATE VIEW player_statistics AS SELECT player_id, total_goals, total_assists, total_yellow_cards AS yellow_cards, … FROM player_career_stats;`

**Effort estimate**: Phase 0+1.1 are small and high-value (one data source for both public
leaderboards); Phase 1.2 is wide but mechanical; Phases 2–3 are deletions.
