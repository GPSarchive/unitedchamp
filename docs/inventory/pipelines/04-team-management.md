# Pipeline 04 — Team management

**One-line summary:** Teams are created/edited by admins, soft-deleted, and assigned to tournaments. Logos go through an upload → trim → proxy pipeline; brand color is extracted client-side from the logo.

---

## Routes

### Public
- `/OMADES` ([page.tsx](../../../src/app/OMADES/page.tsx)) — paginated team grid with fuzzy search
- `/OMADA/[id]` ([page.tsx](../../../src/app/OMADA/[id]/page.tsx)) — team detail (players, matches, championships)

### Admin
- `/dashboard/teams` ([page.tsx](../../../src/app/dashboard/teams/page.tsx)) — CRUD grid

## API endpoints

- `GET, POST /api/teams` — list / create
- `GET, PATCH, DELETE /api/teams/[id]` — single team CRUD; DELETE = soft delete
- `POST /api/teams/[id]/restore` — undo soft delete
- `GET, POST /api/teams/[id]/players` — list / add player to team
- `DELETE /api/teams/[id]/players/[playerId]` — remove from team
- `POST /api/teams/logo-upload` — multipart upload, 3MB max
- `POST /api/teams/[id]/trim-logo` — re-uploads logo with `sharp` trim
- `GET /api/public/team-logo/[...path]` — public proxy for team logos
- `RPC search_teams_fuzzy(search_term, page_limit, page_offset)` — fuzzy team search

## Server actions

None dedicated — flows through API.

## DB tables

- `teams` — columns include `colour` (added [add-colour-column.sql](../../../add-colour-column.sql)), `season_score`, `deleted_at`, `am`
- `tournament_teams` — participation links
- `player_teams` — roster membership

## Components

### Public team grid (`src/app/OMADES/`)
- `TeamCard`, `SearchBar`, `Pagination`, `TeamsGrid` (unused?), `DotGrid`, `ColorBends`

### Public team detail (`src/app/OMADA/[id]/`)
- Orchestrator: `TeamClient.tsx`
- Pieces: `TeamHeader`, `TeamMeta`, `TeamSidebar`, `TeamRosterShowcase`, `PlayersGrid`, `PlayersSection`, `MatchesSection`, `TeamMatchesTimeline`, `AvatarImage`, `react-bits/LightRays.tsx`

### Admin (`src/app/dashboard/teams/`)
- `AdminTeamsCRUD`, `AdminTeamsGridClient`, `TeamRowItem`, `TeamRowEditor`, `TeamDetailsPanel`, `PlayersPanel`, `AddPlayerToTeamModal`, `ConfirmLogoModal`, `Logo`, `TrimLogoButton`, `teamHelpers.ts`

## Lib / utilities

- [`lib/colorExtraction.ts`](../../../src/app/lib/colorExtraction.ts) — Canvas-based dominant color extraction (feeds `teams.colour`)
- [`lib/image-config.ts`](../../../src/app/lib/image-config.ts) — URL resolver for `ImageType.TEAM`
- [`lib/searchUtils.ts`](../../../src/app/lib/searchUtils.ts) — Greek-aware fuzzy search (for the RPC's input prep)

## Known issues

1. **Soft-delete inconsistency**: `/OMADES` filters `deleted_at IS NULL`; `/dashboard/teams` doesn't. Decide canonical for admin view.
2. **Three "team logo" components** (`dashboard/teams/Logo.tsx`, `OMADA/[id]/AvatarImage.tsx`, `matches/[id]/TeamBadge.tsx`) — consolidate.
3. **`TeamsGrid.tsx` in `/OMADES/`** has no obvious consumer — page imports `TeamCard` directly.
4. **Two team-logo upload paths**: `/api/teams/logo-upload` (direct upload, 3MB) vs the generic `/api/storage/signed-upload`. Pick canonical.
5. **`sharp` is a heavy native dependency** — only used for `/api/teams/[id]/trim-logo`. Consider whether the trim feature justifies it (alternative: client-side trim).
