-- ============================================================
-- Migration: fix-tournament-teams-multi-stage
-- Description: Add a unique constraint on (tournament_id, team_id, stage_id)
--              to tournament_teams so that a team can have one row per group
--              stage (supporting multiple group stages in the same tournament).
-- Date: 2026-02-08
-- ============================================================

-- The table currently has NO unique constraint beyond the PK (id).
-- Add one for data integrity: a team should appear at most once per stage.
-- NULLS NOT DISTINCT ensures (tournament_id=1, team_id=5, stage_id=NULL)
-- cannot be duplicated (the fallback row for teams with no group assignment).
ALTER TABLE tournament_teams
  DROP CONSTRAINT IF EXISTS tournament_teams_tournament_team_stage_key;

ALTER TABLE tournament_teams
  ADD CONSTRAINT tournament_teams_tournament_team_stage_key
  UNIQUE NULLS NOT DISTINCT (tournament_id, team_id, stage_id);

-- Verify
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'tournament_teams'::regclass
  AND contype = 'u';
