-- =====================================================
-- Migration: Allow teams in multiple group stages
-- Description: Changes tournament_teams unique constraint from
--   (tournament_id, team_id) to (tournament_id, team_id, stage_id)
--   so a team can belong to different groups in different group stages.
-- Date: 2026-02-07
-- =====================================================

-- 1) Drop the old unique constraint (name may vary; try common patterns)
DO $$
BEGIN
  -- Try dropping by the most common auto-generated constraint name
  ALTER TABLE tournament_teams
    DROP CONSTRAINT IF EXISTS tournament_teams_tournament_id_team_id_key;

  -- Also try the short name variant
  ALTER TABLE tournament_teams
    DROP CONSTRAINT IF EXISTS tournament_teams_tournament_id_team_id_unique;

  -- Also drop any unique index that might enforce the same
  DROP INDEX IF EXISTS tournament_teams_tournament_id_team_id_key;
  DROP INDEX IF EXISTS tournament_teams_tournament_id_team_id_idx;
END $$;

-- 2) Add the new unique constraint that includes stage_id
--    NULLS NOT DISTINCT ensures (tournament_id=1, team_id=5, stage_id=NULL)
--    can only appear once (PostgreSQL 15+).
ALTER TABLE tournament_teams
  ADD CONSTRAINT tournament_teams_tournament_id_team_id_stage_id_key
  UNIQUE NULLS NOT DISTINCT (tournament_id, team_id, stage_id);
