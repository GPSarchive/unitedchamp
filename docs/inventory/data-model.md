# Data model catalog

Reconstructed from `migrations/*.sql` and every `.from("table")` / `.rpc("fn")` call across `src/`. Where the migrations don't document a column but code reads it, the column is marked **inferred**.

See [00-overview.md](00-overview.md) for vocabulary.

## Conventions

- **Confidence**: ✅ defined in a migration in this repo · 🟡 inferred from code · 🟫 derived/cache table refreshed by app code
- Foreign keys are written `→ table.column`.
- "Used by" lists the most load-bearing call sites; the full grep is in `tool-results/` if you need every reference.

---

## Tables — by domain

### Tournament core

#### `tournaments` ✅
The top-level entity. Format + status + winner.
- **Columns** (from queries): `id`, `name`, `slug`, `format` ('league'|'groups'|'knockout'|'mixed'), `season`, `logo`, `status` ('scheduled'|'running'|'completed'|'archived'), `start_date`, `end_date`, `winner_team_id` → `teams.id`, `created_at`, `updated_at`
- **Used by**: `/`, `/tournaments`, `/tournaments/[id]`, `/api/tournaments`, snapshot/save-all, `loadTournamentIntoStore`, sitemap, repos/tournaments

#### `tournament_stages` ✅
A stage inside a tournament (league round / groups / knockout bracket).
- **Columns**: `id`, `tournament_id` → `tournaments.id`, `name`, `kind` ('league'|'groups'|'knockout'), `ordering`, `config` (JSON)
- **Used by**: editor save-all, snapshot, progression, reseed, `/api/matches/[id]`, `loadTournamentIntoStore`

#### `tournament_groups` ✅
Groups inside a `groups` stage.
- **Columns**: `id`, `stage_id` → `tournament_stages.id`, `name`, `ordering`
- **Used by**: snapshot, save-all, progression, `loadTournamentIntoStore`, match detail queries

#### `tournament_teams` ✅
A team's participation in a tournament (per stage; same team can appear in multiple stages/groups).
- **Columns**: `id`, `tournament_id`, `team_id` → `teams.id`, `stage_id`, `group_id`, `seed`
- **Constraint**: unique `(tournament_id, team_id, stage_id)` per [fix-tournament-teams-multi-group-stage.sql](../../migrations/fix-tournament-teams-multi-group-stage.sql)
- **Used by**: snapshot, save-all, progression, team detail page (`/OMADA/[id]`)
- **Backfill**: [backfill-tournament-teams-from-matches.sql](../../migrations/backfill-tournament-teams-from-matches.sql) restores rows for group stages that have matches but no participation records.

#### `stage_slots` 🟡
Slot grid for a stage — a `(stage_id, group_id, slot_id)` → optional `team_id`. Slots may be manually filled or fed by `intake_mappings`.
- **Columns** (from save-all/progression): `stage_id`, `group_id` (index-based), `slot_id` (1-based), `team_id?`, `source` ('manual'|'intake'), `updated_at` (optimistic lock)
- **Used by**: save-all, progression, snapshot

#### `stage_standings` 🟡
Per-group standings cache for a stage.
- **Columns** (from queries): `stage_id`, `group_id`, `team_id`, `rank`, `points` (inferred)
- **Used by**: `/api/stages/[id]/standings`, `/api/stages/[id]/reseed`, progression, match detail queries, `loadTournamentIntoStore`
- **Refresh paths**: progression after a match finishes; explicit `reseed` endpoint

#### `intake_mappings` 🟡
Maps the output of one stage (winner/runner-up of a group, or bracket result) into a slot of a later stage.
- **Columns**: `id`, `target_stage_id`, `group_idx`, `slot_idx`, plus source pointers (see code for exact shape)
- **Used by**: save-all, progression, snapshot

#### `tournament_awards` 🟡
Per-match award assignments (MVP, best GK) at the tournament level.
- **Used by**: `loadTournamentIntoStore`, `update_match_awards` RPC

### Matches & participants

#### `matches` ✅ (extended by migrations)
The central match row.
- **Columns** (from queries + migrations):
  - Identity: `id`, `tournament_id`, `stage_id`, `group_id`
  - Schedule: `match_date`, `matchday`, `round`, `bracket_pos`, `field` (added later)
  - Teams: `team_a_id`, `team_b_id`, `winner_team_id`
  - Score: `team_a_score`, `team_b_score`
  - Status: `status` ('scheduled'|'finished'|'postponed') — `'postponed'` added by [add-match-postponement-safe.sql](../../migrations/add-match-postponement-safe.sql)
  - Postponement: `postponement_reason`, `original_match_date`, `postponed_at`, `postponed_by` → `auth.users.id` (ON DELETE SET NULL)
  - Bracket sources: `home_source_round`, `home_source_bracket_pos`, `away_source_round`, `away_source_bracket_pos`, `home_source_match_id`, `away_source_match_id`, `home_source_outcome`, `away_source_outcome`
  - Media: `video_url`
  - Audit: `updated_at`
- **Status invariants**: `/api/matches[/id]` allow-lists only non-structural fields for PATCH; structural fields (`round`, `bracket_pos`, source IDs) are immutable — use reseed.
- **Used by**: nearly every page (home, calendar, tournaments, match detail, OMADA detail, sitemap). Mutation hotspot: `/api/tournaments/[id]/save-all` (~30 `.from("matches")` calls).

#### `match_player_stats` ✅ (extended)
Per-player stats line per match.
- **Columns**: `id`, `match_id`, `player_id`, `team_id`, `goals`, `assists`, `own_goals`, `yellow_cards`, `red_cards`, `blue_cards`, `mvp` (bool), `best_goalkeeper` (bool), `player_number` (added by [add-player-number-column.sql](../../add-player-number-column.sql))
- **Used by**: match detail editor, refresh-stats cache rebuild, fix-stats diff tool, top-players section

#### `match_participants` 🟡
Lineup membership for a match (who's on each team for this specific match).
- **Used by**: match detail queries, preview actions, save-all flows
- **Notes**: distinct from `player_teams` (which is roster-level, not match-level)

### Teams & players

#### `teams` ✅ (extended)
- **Columns**: `id`, `name`, `am`, `logo`, `colour` (added by [add-colour-column.sql](../../add-colour-column.sql); CHECK `^#[0-9A-Fa-f]{6}$`), `season_score`, `deleted_at` (soft delete), `created_at`
- **Used by**: nearly all team-facing pages; `/api/teams[...]`, `/OMADES`, `/OMADA/[id]`, `/standings`, sitemap

#### `player` ✅ (extended; **singular table name**)
- **Columns**: `id`, `first_name`, `last_name`, `photo`, `height_cm`, `position`, `birth_date`, `deleted_at`, `player_number` (added by [add-player-number-to-player-table.sql](../../migrations/add-player-number-to-player-table.sql) — permanent jersey #, separate from per-match number)
- **Naming gotcha**: table is `player` (singular), but JOIN aliases are usually `players`. Consistent inside the codebase — just unusual.

#### `player_teams` 🟡
M:N join — player ↔ team rosters.
- **Columns** (from queries): `id`, `player_id`, `team_id`
- **Used by**: team detail page, players endpoints, match detail (to resolve rosters)

#### `player_statistics` 🟡
The "older" per-player aggregate. Code still reads and writes this; the cache tables below were added to replace expensive aggregation but `player_statistics` is still updated by `match_player_stats` writers.
- **Columns**: `player_id`, `total_goals`, `total_assists`, `yellow_cards`, `red_cards`, `blue_cards`, `age`, `created_at`, `updated_at`
- **Drift detector**: `/dashboard/fix-stats` compares `player_statistics` against re-aggregated `match_player_stats`.
- **Cleanup candidate**: with `player_career_stats` now in place, `player_statistics` may be redundant. Confirm before removing.

#### `player_career_stats` 🟫 ✅
Pre-computed all-time aggregates — added by [add-player-stats-cache.sql](../../migrations/add-player-stats-cache.sql) to keep `/paiktes` fast.
- **Columns**: `player_id` (PK), `total_matches`, `total_goals`, `total_assists`, `total_yellow_cards`, `total_red_cards`, `total_blue_cards`, `total_mvp`, `total_best_gk`, `total_wins`, `primary_team_id` → `teams.id`, `updated_at`
- **Indexes**: per-stat DESC for sorting
- **Refresh path**: `src/app/lib/refreshPlayerStats.ts`, surfaced via `/dashboard/refresh-stats`. Also incrementally maintained on match finish.

#### `player_tournament_stats` 🟫 ✅
Per-tournament version of the same.
- **Columns**: PK `(player_id, tournament_id)`, plus all stats + `wins` + `updated_at`
- **Used by**: `/paiktes` when filtering by tournament; refresh-stats backfill

### Content

#### `articles` ✅ (extended)
- **Columns**: `id`, `title`, `slug` (unique), `content` (TipTap JSONB), `excerpt`, `featured_image`, `status` ('draft'|'published'|'archived'), `author_id` → `auth.users.id`, `published_at`, `view_count` (added by [add-view-count-to-articles.sql](../../migrations/add-view-count-to-articles.sql), CHECK `>= 0`), `created_at`, `updated_at` (auto-trigger)
- **RPC**: `increment_article_view_count(article_slug TEXT)` — atomic increment, SECURITY DEFINER
- **Used by**: `/article/[slug]`, `/articles`, `/api/articles[...]`, `/api/articles-public`, home page article previews, sitemap
- **Drift defense**: `/api/articles-public` has a fallback path for missing `view_count`/`featured_image` — flag for removal once schema confirmed.

#### `announcements` 🟡
- **Columns** (from queries): `id`, `title`, `body`, `format` ('md'|'html'|'plain'), `start_at`, `end_at`, `pinned`, `priority`, `status` ('published'|...), `created_at`
- **Used by**: `/announcement/[id]`, `/api/announcements[...]`, home page, sitemap, **also written by `/api/matches/[id]/postpone`** (creates an announcement row when a match is postponed)

### Discipline & auth

#### `disciplinary_actions` ✅
- **Columns**: `id`, `tournament_id`, `stage_id`, `team_id` → `tournament_teams.id`, `group_id`, `points_adjustment` (signed), `reason`, `applied_by` → `auth.users.id`, `applied_at`, `match_id`, `created_at`
- **FK note**: [fix-disciplinary-actions-fkey.sql](../../migrations/fix-disciplinary-actions-fkey.sql) corrects the `team_id` reference.
- **Used by**: progression (applies adjustments to standings), stage actions

#### `auth.users` (Supabase managed)
- **Roles**: `app_metadata.roles` — admin role assigned via `/api/admin/users/[id]/roles`. Most route guards check `roles.includes('admin')`.

#### `users` (deprecated?)
- **Only call**: `src/app/hometest/page.tsx` reads `from('users').select('id, name')` — looks like legacy demo data, since auth users live in `auth.users`. Confirm before removing.

### Views

#### `v_tournament_standings` 🟡
- **Used by**: `src/app/lib/repos/tournaments.ts` only.
- A computed view; structure inferred from code reading `rank`, `points`, `team_id`, etc.

---

## RPCs (Postgres functions)

| Name | Caller | Purpose |
|---|---|---|
| `search_teams_fuzzy(search_term, page_limit, page_offset)` | `/OMADES` | Fuzzy team search with total count. Returns `id, name, logo, colour, total_count`. |
| `test_admin_role` | `src/app/dashboard/matches/MatchesDashboard.tsx` | Probably an admin-check smoke test — **flag for review**. |
| `create_tournament(v_json)` | `src/app/api/tournoua/actions.ts`, `src/app/lib/repos/tournaments.ts` | Server-side tournament creation. Called from two places. |
| `update_match_awards` | `src/app/dashboard/.../preview/actions.ts`, `src/app/matches/[id]/actions.ts` | Sets MVP / best GK for a match. |
| `alloc_stage_slot` | `src/app/dashboard/.../progression.ts` | Assigns a team to a stage slot during progression. |
| `increment_article_view_count(article_slug)` | not yet wired in code grep — defined in migration only | Atomic view-count increment. **Possible dead RPC** — verify call site. |

---

## Storage buckets

| Bucket | Purpose | Notes |
|---|---|---|
| `GPSarchive's Project` | Multi-purpose default — team logos, tournament logos, articles, signed-upload destination | **Literal space + apostrophe in name.** Hardcoded across 7+ routes. |
| `team-logos` | Used by `/dashboard/teams/page.tsx` for signing in admin grid | Possibly redundant with the bucket above. |
| `players` (env: `NEXT_PUBLIC_PLAYER_PHOTO_BUCKET`) | Player photos | Read via `/api/storage/player-img` proxy |
| `assets` (env: `NEXT_PUBLIC_MASK_BUCKET`) | SVG/PNG masks, constrained to `masks/` prefix | Read via `/api/storage/mask` |

---

## Cross-cutting notes (cleanup surface)

1. **`player_statistics` may be obsolete** — `player_career_stats` was introduced to replace it. Both still get written. Decide canonical and remove the other.
2. **`users` table reference** in `/hometest/page.tsx` looks legacy — auth lives in `auth.users`.
3. **Bucket name with a literal apostrophe + space** (`GPSarchive's Project`) hardcoded in many places — env-var the default.
4. **Two bucket names for team logos** (`GPSarchive's Project` and `team-logos`). Confirm intent.
5. **`increment_article_view_count` RPC** is defined but no current call site shows up in grep — likely an unwired feature.
6. **`test_admin_role` RPC** — name suggests test-only, but called in production code (`MatchesDashboard.tsx`). Verify.
7. **Bracket source columns on `matches`** — both `home_source_round` + `home_source_bracket_pos` AND `home_source_match_id` exist. Two ways to express the same relationship; one is probably redundant after bracket reseeding refactors.
8. **`tournament_teams.id` referenced by `disciplinary_actions.team_id`** — name is misleading (it's a participation id, not a team id). Worth a rename note.
9. **Articles use TipTap JSONB; the first-image extractor in `/articles` walks `content.content` recursively** — flag if you ever migrate off TipTap.
10. **No migrations for**: `tournaments`, `tournament_stages`, `tournament_groups`, `tournament_teams`, `stage_slots`, `stage_standings`, `intake_mappings`, `matches` (base), `teams` (base), `player` (base), `player_teams`, `player_statistics`, `match_player_stats` (base), `match_participants`, `announcements`, `tournament_awards`, `v_tournament_standings`. These exist in production but their initial DDL is not in this repo — they were likely created via the Supabase dashboard or a migration system not committed here. **Flag as a documentation gap** — consider exporting the live schema and committing it as a `0000-baseline.sql`.
