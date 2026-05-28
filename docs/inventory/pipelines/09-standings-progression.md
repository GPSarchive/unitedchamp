# Pipeline 09 — Standings & progression

**One-line summary:** Standings live in `stage_standings`, recomputed on match finish (via `progressAfterMatch`) or via the explicit `/api/stages/[id]/reseed`. Global season standings use a simpler `teams.season_score` column.

---

## Routes

### Public
- `/standings` ([page.tsx](../../../src/app/standings/page.tsx)) — global season standings (uses `teams.season_score`, not stage standings)
- `/tournaments/[id]` — embeds stage standings inside the bracket viewer
- `/matches/[id]` — embeds standings for the match's stage

### Admin
- `/dashboard/matches` triggers progression via finish/postpone
- `/dashboard/tournaments/...` (the wizard) sets up stages + groups; standings come from `stage_standings`

## API endpoints

- `GET /api/stages/[id]/standings` — read standings rows (`group_id, team_id, rank`)
- `POST /api/stages/[id]/reseed` — recompute standings + rebuild KO bracket pairings

## Server actions

- [`dashboard/tournaments/TournamentCURD/stages/actions.ts`](../../../src/app/dashboard/tournaments/TournamentCURD/stages/actions.ts) — handles `disciplinary_actions` writes (point adjustments) which then influence standings
- [`dashboard/tournaments/TournamentCURD/progression.ts`](../../../src/app/dashboard/tournaments/TournamentCURD/progression.ts) — the core progression engine (called by `/api/matches/[id]`)

## DB tables / RPCs

| Table | Role |
|---|---|
| `stage_standings` | Per-group standings: `(stage_id, group_id, team_id, rank, points)` |
| `disciplinary_actions` | Point adjustments (deductions/additions) feeding into recompute |
| `intake_mappings` | Map stage outputs → next-stage slot inputs |
| `stage_slots` | Slot grid that progression fills |
| `matches` | Source of points (winners, scores) |
| `teams.season_score` | Cross-tournament season score for `/standings` |

**RPCs:** `alloc_stage_slot`

## Components

- [`tournaments/StageStandingsMiniPublic.tsx`](../../../src/app/tournaments/StageStandingsMiniPublic.tsx)
- [`dashboard/tournaments/TournamentCURD/stages/StageStandingsMini.tsx`](../../../src/app/dashboard/tournaments/TournamentCURD/stages/StageStandingsMini.tsx)
- [`matches/[id]/TournamentStandings.tsx`](../../../src/app/matches/[id]/TournamentStandings.tsx)
- `/standings/page.tsx` renders inline (no separate component file)

## Lib / utilities

- [`lib/utils/standings.ts`](../../../src/app/lib/utils/standings.ts) — types: `StandingRow`, `Tiebreaker` (points / goal_diff / goals_for / h2h_points / h2h_goal_diff / fair_play)
- [`lib/utils/bracket.ts`](../../../src/app/lib/utils/bracket.ts) — `groupMatchesByRound`

## Known issues

1. **Two standings concepts coexist** — `stage_standings` (per-stage, tournament-bound) vs `teams.season_score` (cross-tournament). They don't share computation. Document the boundary.
2. **`Tiebreaker` types are defined but the grep doesn't show them actively used** in the standings computation. Standings may be implicit-points-only despite the type allowing more.
3. **Prize table is hardcoded in `/standings/page.tsx`** — places 1–3 only.
4. **`disciplinary_actions.team_id` references `tournament_teams.id`** — naming is misleading (it's a participation id, not a team id).
5. **Progression engine in a dashboard folder** is imported by API — see [cleanup-candidates.md](../cleanup-candidates.md) layering inversion.
6. **No idempotency guard documented on `progressAfterMatch`** — confirm what happens if a match is finished, reverted, finished again.
