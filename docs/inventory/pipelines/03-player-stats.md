# Pipeline 03 — Player stats

**One-line summary:** Per-match stats (`match_player_stats`) are the source of truth; two cache tables (`player_career_stats`, `player_tournament_stats`) feed the public players page. A legacy `player_statistics` table is still written but partially redundant.

---

## Routes

### Public
- `/paiktes` ([page.tsx](../../../src/app/paiktes/page.tsx)) — players list, reads from cache tables
- `/OMADA/[id]` — team detail includes per-player aggregates (from `match_player_stats` directly)
- `/matches/[id]` — match-level stats editor (admin)
- `/` — home top-players section reads from cache

### Admin
- `/dashboard/fix-stats` — diff tool: `player_statistics` vs recomputed `match_player_stats`
- `/dashboard/refresh-stats` — backfill button for the cache tables

## API endpoints

- `GET /api/matches/[id]/stats` — read `match_player_stats` for one match
- `POST /api/matches/[id]` (PATCH) — writing stats updates `match_player_stats`, then cascades to caches via `progressAfterMatch`

## Server actions

- [`matches/[id]/actions.ts`](../../../src/app/matches/[id]/actions.ts) — `saveAllStatsAction`
- [`dashboard/fix-stats/actions.ts`](../../../src/app/dashboard/fix-stats/actions.ts) — applies the recompute
- [`dashboard/refresh-stats/actions.ts`](../../../src/app/dashboard/refresh-stats/actions.ts) — full backfill

## DB tables / RPCs

| Table | Role |
|---|---|
| `match_player_stats` | Source of truth (per-match line). Has `goals`, `assists`, `own_goals`, `yellow_cards`, `red_cards`, `blue_cards`, `mvp`, `best_goalkeeper`, `player_number` |
| `match_participants` | Lineup for a match |
| `player_statistics` | Legacy per-player aggregate. Still written. **Cleanup candidate.** |
| `player_career_stats` | All-time aggregate cache (added [add-player-stats-cache.sql](../../../migrations/add-player-stats-cache.sql)) |
| `player_tournament_stats` | Per-tournament aggregate cache (same migration) |

**RPC:** `update_match_awards` (sets MVP + best GK)

## Components

### Public players page (`src/app/paiktes/`)
- `PlayersClient.tsx`, `PlayersList.tsx`, `PlayersFilterHeader.tsx`, `PlayerProfileCard.tsx` / `ProfileCard.tsx`, `Sportybackground.tsx`, `GlossOverlay.tsx`, `Head.tsx`, `SignedImg.tsx`

### Home top players
- `home/EditorialTopPlayersSection.tsx` (live) / `home/TopPlayersSection.tsx` (classic — used by preview)
- `home/EditorialTopPlayers.tsx`, `home/cards/EditorialPlayerCard.tsx`, `home/TopScorers.tsx`
- Stat cards: `components/cards/{ScorerCard, AssisterCard, MvpCard, BestGkCard}.tsx`

### Dashboard
- `dashboard/fix-stats/{StatsTable, ApplyFixButton}.tsx`
- `dashboard/refresh-stats/RefreshButton.tsx`

## Lib / utilities

- [`lib/refreshPlayerStats.ts`](../../../src/app/lib/refreshPlayerStats.ts) — the cache rebuilder. Batched (300/chunk).

## Known issues

1. **Two writes per match finish** — `player_statistics` AND `player_career_stats`. Drift exists (that's why `/dashboard/fix-stats` exists). Pick canonical.
2. **`increment_article_view_count` RPC** is from a different feature (articles), but similarly: defined and not called. Pattern of "added DB-side without wiring readers."
3. **Top-players section has classic + Editorial pair** — see [dead-ends.md](../dead-ends.md). Same data, two renders.
4. **Player photos**: legacy `player-images.ts` (deprecated) vs `OptimizedImage`. Migrate.
5. **Greek search** (in `searchUtils.ts`) is excellent — keep this if you ever migrate search infra.
