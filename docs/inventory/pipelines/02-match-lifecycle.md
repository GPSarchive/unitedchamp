# Pipeline 02 — Match lifecycle

**One-line summary:** Matches are scheduled by the tournament editor, played, then admin-edited (stats, score, video, postponement). Finishing a match triggers tournament progression.

---

## Routes — UI entry points

### Public
- `/matches` ([page.tsx](../../../src/app/matches/page.tsx)) — filterable explorer
- `/matches/[id]` ([page.tsx](../../../src/app/matches/[id]/page.tsx)) — detail page (admin sees extra controls)
- `/` and `/preview/home-c` — embed upcoming matches in the dashboard/calendar widgets

### Admin
- `/dashboard/matches` ([page.tsx](../../../src/app/dashboard/matches/page.tsx)) — admin grid + postpone dialog

## API endpoints

- `POST /api/matches` — create (admin, same-origin)
- `PATCH /api/matches/[id]` — update non-structural fields (admin, same-origin) — calls `progressAfterMatch` when status becomes `finished`
- `GET /api/matches/[id]/stats` — `match_player_stats` for a match
- `POST /api/matches/[id]/postpone` — postpone + create announcement (admin, same-origin)
- `GET /api/matches/calendar` — date-window query for calendar widgets
- `GET /api/matches/videos` — cursor-paginated highlight reel
- `GET /api/tournoua/[id]/matches` — tree-friendly per-tournament

## Server actions

- [`matches/[id]/actions.ts`](../../../src/app/matches/[id]/actions.ts) — `saveAllStatsAction`, calls `update_match_awards` RPC, writes to `match_player_stats`, `match_participants`, `player_statistics`, `matches`

## DB tables / RPCs touched

**Tables:** `matches`, `match_player_stats`, `match_participants`, `tournament_stages` (for progression), `stage_standings` (recompute), `player_statistics` + `player_career_stats` + `player_tournament_stats` (cache refresh), `announcements` (postpone writes)

**RPCs:** `update_match_awards`

## Components

### Public match detail (`src/app/matches/[id]/`)
- Orchestrator: [page.tsx](../../../src/app/matches/[id]/page.tsx)
- Layout: `WelcomeMessage`, `StadiumBg`, `ShinyText`, `LaurelWreath`
- Header: `TournamentHeader`, `TeamVersusScore`, `TeamBadge`
- Stats: `StatsEditor` (admin), `MatchStats`, `StatIcons`
- Events: `MatchEventsTimeline`, `MatchParticipantsShowcase`
- Rosters: `TeamRostersDisplay`, `TeamPlayers`
- Standings (embedded): `TournamentStandings`
- Admin actions: `MatchAdminActions`, `MatchVideoAdminForm`, `AddPlayerToTeamLauncher`, `AddPlayerToTeamModal`, `FormDraftAutosave`

### Public explorer (`src/app/matches/`)
- `MatchesExplorer.tsx`, `MatchesExplorerMobile.tsx`

### Admin (`src/app/dashboard/matches/`)
- `MatchesDashboard.tsx`, `RowEditor.tsx`, `PostponeDialog.tsx`

## Lib / utilities

- [`matches/[id]/queries.ts`](../../../src/app/matches/[id]/queries.ts) — `fetchMatch`, `fetchPlayersForTeam`, `fetchMatchStatsMap`, `fetchParticipantsMap`, `fetchStandingsByStage`
- [`matches/[id]/utils.ts`](../../../src/app/matches/[id]/utils.ts) — `parseId`, `extractYouTubeId`, `formatStatus`
- [`dashboard/tournaments/TournamentCURD/progression.ts`](../../../src/app/dashboard/tournaments/TournamentCURD/progression.ts) — invoked by API on match-finish

## Known issues

1. **Layering inversion**: `/api/matches/[id]` imports progression logic from a dashboard folder.
2. **`matches/[id]/page.tsx` imports from `lib/supabase/Server.ts`** — the duplicate of `supabaseServer.ts`.
3. **Many separate writes on finish** (`player_statistics`, `player_career_stats`, `player_tournament_stats`, `stage_standings`, possibly `matches` for cascading bracket sources) — partial-failure risk. Consider wrapping in a Postgres function.
4. **`status = 'postponed'`** was added later (see [add-match-postponement-safe.sql](../../../migrations/add-match-postponement-safe.sql)); confirm all readers handle it (not just `scheduled`/`finished`).
5. **Same-origin guard** is consistent across mutation endpoints — good. But based on an env var (`ALLOWED_ORIGINS`); document the values.
