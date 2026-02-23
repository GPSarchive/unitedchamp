# Player Stats Cache Optimization — Follow-up Tasks

This codebase already has a working pre-computed stats system. The following
optimizations were identified but NOT yet implemented. Pick ONE section at a
time, uncomment it, and paste the whole prompt into a new Claude Code chat.

The codebase is at /home/user/unitedchamp (Next.js + Supabase).

Key files already implemented (for context):
- migrations/add-player-stats-cache.sql — tables: player_career_stats, player_tournament_stats
- src/app/lib/refreshPlayerStats.ts — refreshCareerStatsForPlayers(), refreshTournamentStatsForPlayers(), refreshStatsForMatch(), refreshAllPlayerStats()
- src/app/dashboard/tournaments/TournamentCURD/progression.ts — progressAfterMatch() calls refreshStatsForMatch() at step 7
- src/app/dashboard/tournaments/TournamentCURD/preview/actions.ts — revertMatchToScheduledAction() calls refresh after revert
- src/app/dashboard/refresh-stats/ — backfill trigger page
- src/app/paiktes/page.tsx — already reads from cache tables

---

## OPTIMIZATION 1: Denormalize tournament team/match counts on the tournaments table

### Problem
The homepage (src/app/page.tsx or wherever tournaments are listed) runs 12+ extra
queries per page load: for each tournament it fetches COUNT of teams from
tournament_teams and COUNT of matches from matches.

### What to do
1. Add two columns to the tournaments table: teams_count INT DEFAULT 0, matches_count INT DEFAULT 0
2. Write a SQL migration file at migrations/add-tournament-counts.sql
3. In progressAfterMatch() in progression.ts, after step 7 (refreshStatsForMatch),
   add step 8: run two COUNT queries for the match's tournament_id and UPDATE
   tournaments SET teams_count = X, matches_count = Y WHERE id = tournament_id.
   Do this in a new exported function refreshTournamentCounts(tournamentId) in
   src/app/lib/refreshPlayerStats.ts (or a new file).
4. Also call refreshTournamentCounts when teams are added/removed from tournaments.
   Search for inserts/deletes on tournament_teams table and hook in there.
5. Add a backfill function refreshAllTournamentCounts() that loops all tournaments
   and updates their counts. Add a button for it on the /dashboard/refresh-stats page.
6. Update homepage queries to read tournaments.teams_count and tournaments.matches_count
   instead of running separate COUNT queries.
7. Commit and push to the working branch.

---

## OPTIMIZATION 2: Pre-compute season standings rank

### Problem
The standings page (search for season_score usage) fetches all teams with their
season_score, then sorts and computes dense rankings in JavaScript on every page
load (revalidate=60 means 1440 invocations/day).

### What to do
1. Add a column season_rank INT to the teams table.
   Write migration: migrations/add-season-rank.sql
2. Create a function recomputeSeasonRanks() in src/app/lib/ that:
   - Fetches all teams ordered by season_score DESC
   - Computes dense rank (teams with same score get same rank)
   - Updates each team's season_rank
3. Call recomputeSeasonRanks() at the end of progressAfterMatch() (season_score
   presumably changes when standings change). Search the codebase for where
   season_score is updated to find the right hook point.
4. Add backfill button on /dashboard/refresh-stats page.
5. Update the standings page to read season_rank directly instead of computing it.
6. Commit and push.

---

## OPTIMIZATION 3: Top scorers cache for the homepage

### Problem
The homepage runs ~5 queries + Map/Set aggregation to build a "top 3 scorers"
widget. This involves joining player_statistics, match_player_stats, player,
teams, and resolving photo URLs.

### What to do
1. Search the codebase for where the homepage top scorers are computed. Look in
   src/app/page.tsx or components used by it. Read the full logic.
2. Create a new table top_scorers_cache (or reuse player_career_stats with a
   simple query) that can serve this data in a single SELECT.
3. The homepage should be able to do:
   SELECT pcs.*, p.first_name, p.last_name, p.photo, t.name as team_name, t.logo as team_logo
   FROM player_career_stats pcs
   JOIN player p ON p.id = pcs.player_id
   JOIN teams t ON t.id = pcs.primary_team_id
   ORDER BY pcs.total_goals DESC LIMIT 3
   This might already work with the existing player_career_stats table!
4. Update the homepage to use this query instead of the current multi-query approach.
5. Commit and push.

---

## OPTIMIZATION 4: Materialize tournament standings views

### Problem
v_tournament_standings and v_tournament_player_stats are Supabase views (not
materialized). Every query re-executes the full aggregation SQL. They're queried
from src/app/api/tournaments/standings/route.ts and
src/app/api/tournaments/slug/players/route.ts with revalidate=0.

### What to do
1. First, find the actual view definitions in Supabase (you may need to check
   the SQL editor or look for CREATE VIEW statements in the codebase/migrations).
2. Convert them to MATERIALIZED VIEWs with a REFRESH call.
3. Add a refreshMaterializedViews(tournamentId?) function that runs
   REFRESH MATERIALIZED VIEW CONCURRENTLY for the relevant views.
4. Call this from progressAfterMatch() after standings recompute.
5. Add ISR caching (revalidate = 300) to the standings API routes instead of
   revalidate = 0.
6. Write migration SQL and commit/push.

NOTE: This may require checking what Supabase supports for materialized views.
If not supported, an alternative is to add revalidate=300 to the API routes
and rely on ISR caching instead.

---

## OPTIMIZATION 5: Simplify match stats merge (played column)

### Problem
The match stats API at src/app/api/matches/[id]/stats/route.ts fetches
match_player_stats and match_participants separately, then merges them by
player_id in JavaScript to determine which players "played" vs were just listed.

### What to do
1. Read src/app/api/matches/[id]/stats/route.ts to understand the current merge.
2. Read the match_participants table schema — it has a "played" boolean.
3. The merge is needed because match_player_stats doesn't have a "played" field.
   Option A: Add a "played" boolean column to match_player_stats and populate it
   from match_participants during saveAllStatsAction. Then the stats route can
   skip the second query entirely.
   Option B: Use a Supabase JOIN in the stats query to get both in one call.
4. Implement whichever option is simpler, update the stats route, and ensure
   saveAllStatsAction/saveMatchStatsAction keep the data in sync.
5. Write migration if adding a column. Commit and push.

---

## OPTIMIZATION 6: Enable ISR caching on standings endpoints

### Problem
src/app/api/stages/[id]/standings/route.ts and similar routes have revalidate=0,
meaning every request recomputes standings from scratch.

### What to do
1. Search for all route files with revalidate = 0.
2. For standings-related routes, change to revalidate = 300 (5 minutes).
3. In progressAfterMatch(), after recomputeStandingsIfNeeded(), add
   revalidatePath calls for the affected API routes so they refresh immediately
   when data changes but cache between changes.
4. This is a low-risk change — just updating cache settings.
5. Commit and push.
