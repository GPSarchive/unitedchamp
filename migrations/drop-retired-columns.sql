-- ============================================================================
-- drop-retired-columns.sql  (Seasonal system, Phase 7 — the only destructive
-- migration of the whole seasonal work)
-- Run ONCE in the Supabase SQL editor, AFTER the Phase 6 code is deployed and
-- `grep -rn "season_score\|player_career_stats" src scripts` is clean.
-- Source of truth: plans/seasonal-data-contract.md §2.4 / §5.
--
-- Drops:
--   1) teams.season_score    — hand-typed, season-less; values archived in
--                              public.team_season_score_archive (Phase 0, 6 rows)
--   2) player_career_stats   — the all-time cache; replaced by player_season_stats
--                              (identical row-for-row for '2025-2026', verified
--                              2026-09-04). Any future all-time view is
--                              sum(player_season_stats) group by player_id.
--
-- NOT dropped here (deferred to a follow-up — see contract §2.4):
--   player_statistics        — the legacy table still feeds ~20 admin player
--                              screens and carries the hand-typed `age`. It is
--                              retired only after those readers move (and `age`
--                              moves to public.player).
-- ============================================================================

-- Pre-flight (read-only) — both must be 0 before running the drops:
--   select count(*) from public.player_career_stats;      -- informational
--   select count(*) from public.team_season_score_archive; -- expect 6 (the archived values)

BEGIN;

ALTER TABLE public.teams DROP COLUMN IF EXISTS season_score;

DROP TABLE IF EXISTS public.player_career_stats;

COMMIT;

-- Verify:
--   select column_name from information_schema.columns
--     where table_name = 'teams' and column_name = 'season_score';       -- 0 rows
--   select to_regclass('public.player_career_stats');                    -- null
-- Then: node scripts/audit-rls.mjs · node scripts/audit-player-stats-drift.mjs
