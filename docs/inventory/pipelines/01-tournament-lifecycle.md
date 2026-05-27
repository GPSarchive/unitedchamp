# Pipeline 01 — Tournament lifecycle

**One-line summary:** Admins compose a tournament through a multi-step wizard; the saved tournament is read by the public site for browsing, standings, and brackets.

This is the most complex feature in the codebase. Touches the largest single endpoint (`/api/tournaments/[id]/save-all` ≈700 lines) and the largest single component subtree (`dashboard/tournaments/TournamentCURD/`).

---

## Routes — UI entry points

### Admin
- `/dashboard/tournaments` ([page.tsx](../../../src/app/dashboard/tournaments/page.tsx)) — list + inline editor when `?tid=` set
- `/dashboard/tournaments/TournamentCURD/edit/[id]` ([page.tsx](../../../src/app/dashboard/tournaments/TournamentCURD/edit/[id]/page.tsx)) — standalone edit page

### Public
- `/tournaments` ([page.tsx](../../../src/app/tournaments/page.tsx)) — all tournaments grid
- `/tournaments/[id]` ([page.tsx](../../../src/app/tournaments/[id]/page.tsx)) — dark theme tournament viewer (canonical)
- `/tournaments/[id]/v2` — light theme variant
- `/tournaments/[id]/v2-dark` — same as `/tournaments/[id]` (duplicate route, see [routes.md](../routes.md))

## API endpoints

- `GET /api/tournaments` — list with `?status=&limit=`
- `GET /api/tournaments/[id]/snapshot` — admin-only full editor snapshot (joins ~8 tables)
- `POST /api/tournaments/[id]/save-all` — admin-only mass save (the single biggest mutation endpoint)
- `GET /api/tournoua/[id]/matches` — tree-friendly match list (Greek-named folder — see cleanup notes)

## Server actions

- [`dashboard/tournaments/TournamentCURD/actions.ts`](../../../src/app/dashboard/tournaments/TournamentCURD/actions.ts) — `getTournamentForEditAction`, plus mutation actions
- [`dashboard/tournaments/TournamentCURD/preview/actions.ts`](../../../src/app/dashboard/tournaments/TournamentCURD/preview/actions.ts) — match-level preview actions (including `update_match_awards` RPC)
- [`dashboard/tournaments/TournamentCURD/stages/actions.ts`](../../../src/app/dashboard/tournaments/TournamentCURD/stages/actions.ts) — stage CRUD + disciplinary actions
- [`dashboard/tournaments/TournamentCURD/preview/updateMatchAction.ts`](../../../src/app/dashboard/tournaments/TournamentCURD/preview/updateMatchAction.ts) — per-match update
- [`tournaments/actions.ts`](../../../src/app/tournaments/actions.ts) — public-side tournament actions
- [`api/tournoua/actions.ts`](../../../src/app/api/tournoua/actions.ts) — `create_tournament` RPC call

## DB tables / RPCs touched

**Tables:** `tournaments`, `tournament_stages`, `tournament_groups`, `tournament_teams`, `stage_slots`, `stage_standings`, `intake_mappings`, `matches`, `tournament_awards`, `disciplinary_actions`, `teams` (read), `players` / `player_teams` (for rosters)

**RPCs:** `create_tournament(v_json)`, `alloc_stage_slot`, `update_match_awards`

**Views:** `v_tournament_standings` (read by `lib/repos/tournaments.ts`)

## Components

### The wizard
Top-level orchestrator: [`TournamentWizard.tsx`](../../../src/app/dashboard/tournaments/TournamentCURD/TournamentWizard.tsx).

Steps:

| Step | Components |
|---|---|
| Basics | `basics/TournamentBasicsForm.tsx` |
| Teams | `teams/TeamPicker.tsx` |
| Stages | `stages/StageList.tsx`, `stages/StageCard.tsx`, `stages/ConfirmDialog.tsx`, `stages/StageStandingsMini.tsx`, `stages/groups/{GroupsBoard, GroupIntakeBoard, GroupsConfigKOIntake}.tsx`, `stages/leauge/KnockoutConfigFromLeague.tsx`, `stages/KnockoutTree/...` (hooks + bracket editor) |
| Preview | `preview/{InlineMatchPlanner, ExpandedRowEditor, MatchControlPanel, KnockoutBuilder}.tsx`, `preview/ModernKnockoutViewesr.tsx` (typo), `preview/MatchPlannerZ/...` |
| Submit | `submit/ReviewAndSubmit.tsx`, `submit/tournamentStore.ts`, `submit/loadSnapshotClient.ts` |
| Shared | `shared/ValidationSummary.tsx`, `util/Generators.ts`, `util/groupsSignature.ts`, `util/functions/{common, groupsIntake, knockoutAnyN, knockoutPowerOfTwo, roundRobin}.ts` |

### Public viewer
- `tournaments/[id]/v2-dark/TournamentClientV2Dark.tsx` / `[id]/v2/TournamentClientV2.tsx` / `[id]/v2-dark/MobileShell.tsx`
- Brackets: `[id]/v2/KOBracketV2.tsx`, `[id]/v2-dark/KOBracketV2Dark.tsx`
- Stage views (canonical): `stages/{GroupsStage, LeagueStage, KnockoutStage}.tsx`, `stages/MatchCard.tsx`, `stages/MatchCarousel.tsx`, `stages/koStage/{KOStageDisplay, KOStageViewer, BracketBackground, BracketLineStyles}.tsx`
- Tournament list: `TournamentsClient.tsx`
- Header/header bits: `TournamentHeader.tsx`, `TeamCard.tsx`, `StageMatchesTabs.tsx`, `StageStandingsMiniPublic.tsx`
- Player stats: `PlayerStats.tsx`, `components/PlayerStatistics.tsx`

## Lib / utilities

- [`tournaments/loadTournamentIntoStore.tsx`](../../../src/app/tournaments/loadTournamentIntoStore.tsx) — the public-side read (joins many tables)
- [`tournaments/signTournamentLogos.ts`](../../../src/app/tournaments/signTournamentLogos.ts) — signed-URL signing for logos
- [`tournaments/useTournamentData.tsx`](../../../src/app/tournaments/useTournamentData.tsx) + `useStages.tsx` — client hooks
- [`lib/repos/tournaments.ts`](../../../src/app/lib/repos/tournaments.ts) — list/get helpers
- [`lib/utils/bracket.ts`](../../../src/app/lib/utils/bracket.ts) — KO bracket math
- [`lib/utils/standings.ts`](../../../src/app/lib/utils/standings.ts) — standing row types + tiebreakers
- [`dashboard/tournaments/TournamentCURD/progression.ts`](../../../src/app/dashboard/tournaments/TournamentCURD/progression.ts) — **also imported by `/api/matches/[id]`** (layering inversion — see cleanup-candidates.md)

## Known issues

1. **Folder typo `TournamentCURD`** should be `TournamentCRUD`.
2. **Folder typo `stages/leauge/`** should be `league/`.
3. **`tournoua` (Greek) folder** at `/api/tournoua/...` is a single-endpoint orphan; merge into `/api/tournaments/...`.
4. **`save-all` is huge (~700 lines).** All wizard writes funnel through it. Hard to test, hard to evolve. Decompose into per-resource endpoints once stable.
5. **`progression.ts` lives under dashboard but is imported by API** — layering inversion.
6. **Two ways to express bracket source** on `matches`: `(home_source_round, home_source_bracket_pos)` vs `home_source_match_id`. Pick one.
7. **Multiple dead viewer variants** in `tournaments/stages/koStage/` (`copy.tsx`, `Test.tsx`).
8. **`tournaments/[id]/page.tsx` and `[id]/v2-dark/page.tsx` are identical** — collapse one.
