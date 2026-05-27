# Cleanup candidates

Refactor / consistency improvements surfaced during the inventory. These aren't "dead" — they're live code that could be simpler, safer, or more consistent. See [dead-ends.md](dead-ends.md) for outright orphans.

Grouped by theme.

---

## 1. Naming inconsistencies

| Item | Fix |
|---|---|
| Folder `dashboard/tournaments/TournamentCURD/` | Rename to `TournamentCRUD` (typo). |
| Subfolder `TournamentCURD/stages/leauge/` | Rename to `league/` (typo). |
| Folder split `/api/tournaments/...` vs `/api/tournoua/[id]/matches/` (Greek transliteration) | Pick one. Currently `tournoua` is a one-endpoint orphan. |
| Table `player` (singular) — every other table is plural | Cosmetic, but inconsistent. Document or rename behind a view. |
| `disciplinary_actions.team_id` → `tournament_teams.id` (participation id, not team id) | Rename column to `tournament_team_id`. |
| `signTournamentLogos` lives under `app/tournaments/` not `app/lib/` | Move to `lib/`. |
| `vantatypes.ts` lives under `lib/Navbar/` | Move to a `lib/types/` folder. |

## 2. Duplicate / near-duplicate code

| Item | Fix |
|---|---|
| `/` and `/preview/home-c` share ~200 lines of fetchers + date helpers | Extract to `app/home/dataFetchers.ts` and `app/lib/dateHelpers.ts`. |
| `/api/storage` and `/api/storage/sign` are byte-identical | Delete one. |
| `src/app/lib/supabase/Server.ts` vs `supabaseServer.ts` | Delete `Server.ts`; migrate the one consumer (`matches/[id]/page.tsx`). |
| `src/app/lib/supabase/client.ts` (legacy) vs `supabaseBrowser.ts` (modern) | Migrate consumers, delete legacy. |
| Five upload routes inline their own `getServerSupabase` + `requireAdmin` instead of importing from `lib/supabase/apiAuth.ts` | Consolidate. Routes: `signed-upload`, `article-img`, `delete-object`, `tournaments/image-upload`, `tournament-img-loader`. |
| Three "team logo" components: `dashboard/teams/Logo.tsx`, `OMADA/[id]/AvatarImage.tsx`, `matches/[id]/TeamBadge.tsx` | Consolidate into `components/TeamLogo.tsx`. |
| Multiple player-card components: `paiktes/ProfileCard.tsx`, `PlayerProfileCard.tsx`, `home/cards/EditorialPlayerCard.tsx`, `dashboard/players/PlayerCard.tsx` | Reconcile — likely 2 canonical variants are enough. |
| `tournaments/page.tsx` imports `TournamentsClients` (plural) while file is `TournamentsClient.tsx` | Tiny — but worth normalizing names. |

## 3. Hardcoded values that should be env

| Item | Fix |
|---|---|
| Bucket name `"GPSarchive's Project"` repeated in 7+ files (with literal apostrophe + space) | Single env var `NEXT_PUBLIC_SUPABASE_BUCKET` with default. Affects: `image-config.ts`, `/api/public/team-logo`, `/api/storage`, `/api/storage/sign`, `/api/storage/signed-upload`, `/api/storage/article-img`, `/api/storage/tournaments/image-upload`, `/api/storage/tournament-img-loader`, `/api/teams/logo-upload`, `/api/teams/[id]/trim-logo`. |
| `BASE_URL = 'https://unitedchamp.vercel.app'` in `/api/auth/oauth/route.ts` | Read from `NEXT_PUBLIC_SITE_URL` / `VERCEL_URL` like `getBaseUrl.ts` does. |
| Unsplash background URLs hardcoded in `/login/page.tsx` (six URLs for the bg switcher) | Move to a constant file or a small JSON. Cosmetic. |
| Prize table in `/standings/page.tsx` (1st/2nd/3rd) | Either move to DB (`tournaments.prizes` JSONB) or to a config file. |
| 49 rules in `/kanonismos/page.tsx` as inline JSX | Move to MDX or a JSON config — easier for non-devs to edit. |
| Two testimonials lists with identical structure in `/` and `/preview/home-c` | Move to a single config. |

## 4. Layering inversions

| Item | Fix |
|---|---|
| `/api/matches/[id]/route.ts` imports `progressAfterMatch` from `dashboard/tournaments/TournamentCURD/progression` | Move progression logic to `lib/tournament-progression/` so dashboard + API both consume it from there. |
| `/api/tournaments/[id]/snapshot/route.ts` imports `FullTournamentSnapshot` type from `dashboard/.../tournamentStore` | Move the type to `lib/types.ts`. |
| Dashboard `progression.ts` is the source of truth for stage advancement but lives under a route folder | Same as above — promote to `lib/`. |

## 5. Schema-defensive code that can go once schema is stable

| Item | Fix |
|---|---|
| `/api/articles-public/route.ts` has a fallback path for missing `view_count`/`featured_image` columns | After confirming the columns exist in all envs, delete the fallback. |
| `/api/articles-public` adds `view_count: 0` to articles if missing | Same. |

## 6. Two-stats-tables redundancy

| Item | Fix |
|---|---|
| `player_statistics` (older) and `player_career_stats` (newer cache) both written on match finish | Pick canonical. Migrate readers, drop the other. `/dashboard/fix-stats` exists specifically to detect drift between them — that's a signal the dual write is fragile. |

## 7. Soft-delete inconsistency

| Item | Fix |
|---|---|
| `/OMADES/page.tsx` filters `deleted_at IS NULL` | Decide canonical: should the dashboard see archived teams or not? |
| `/dashboard/teams/page.tsx` does NOT filter `deleted_at IS NULL` | If admin should see archived teams, document; otherwise add filter. |

## 8. Two-redesign drift

Pairs where a "classic" component lives next to an "Editorial" rewrite. Only `/preview/home-c` uses the classics now.

| Classic | Editorial replacement |
|---|---|
| `home/Calendar.tsx` | `home/EditorialCalendar.tsx` |
| `home/TeamDashboard.tsx` | `home/EditorialTeamDashboard.tsx` |
| `home/TopPlayersSection.tsx` | `home/EditorialTopPlayersSection.tsx` |
| `home/TournamentsGrid.tsx` | `home/EditorialTournamentsGrid.tsx` |

Plan: once `/preview/home-c` is retired or shipped, drop the classics in one PR.

## 9. Bracket source-of-truth duality on `matches`

| Item | Fix |
|---|---|
| `matches` has both `(home_source_round, home_source_bracket_pos)` AND `home_source_match_id` to express bracket dependencies | Pick one canonical; null out the redundant set during the next reseed pass. |

## 10. Filename / convention issues

| Item | Fix |
|---|---|
| `src/proxy.ts` should likely be `src/middleware.ts` (Next.js convention) | Confirm wiring; rename. |
| Hooks scattered (`home/useLockBodyScroll.ts`, `tournaments/useStages.tsx`, etc.) | Centralize under `lib/hooks/`. |
| Two utility "homes": `src/app/lib/` and `src/lib/` (shadcn convention) | Document which is canonical for what type of helper. |

## 11. Articles / TipTap

| Item | Fix |
|---|---|
| `/articles/page.tsx` extracts the first image from TipTap JSON inline | Move `extractFirstImage` to `lib/articleUtils.ts` (the natural home) so other consumers can use it. |

## 12. `/hometest` is verbose-by-design

`hometest/page.tsx` uses `withConsoleTiming` and prints query results to console. Looks like a debug page that escaped. Move to a debug-only route guarded by env, or delete (see [dead-ends.md](dead-ends.md)).

---

## How to use this list

These are non-urgent, but they compound. A useful weekly rhythm:

1. Pick one item per week.
2. Open a small PR (one item per PR).
3. Don't bundle theme-mixed cleanups — keeps reviews fast.

Order I'd recommend:
1. **#3 hardcoded bucket name** — biggest blast radius, smallest behavior change.
2. **#1 folder renames** (`TournamentCURD`, `leauge`) — also blast-radius-friendly.
3. **#4 layering inversions** — unlock further refactors.
4. **#2 duplicate Supabase clients** — one PR each.
5. **#6 stats tables** — needs a careful migration plan.
