-- ============================================================
-- Migration: fix-tournament-teams-multi-stage
-- Description: Allow teams to participate in multiple group stages
--              by changing the unique constraint from (tournament_id, team_id)
--              to (tournament_id, team_id, stage_id).
-- Date: 2026-02-08
-- ============================================================

-- Step 1: Drop the old unique constraint.
-- The constraint name may vary; try common patterns.
-- (Supabase auto-generates names like tournament_teams_tournament_id_team_id_key)
DO $$
BEGIN
  -- Try dropping by the most common auto-generated name
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'tournament_teams'::regclass
      AND conname = 'tournament_teams_tournament_id_team_id_key'
  ) THEN
    ALTER TABLE tournament_teams
      DROP CONSTRAINT tournament_teams_tournament_id_team_id_key;
    RAISE NOTICE 'Dropped constraint tournament_teams_tournament_id_team_id_key';
  END IF;

  -- Also try the short name variant
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'tournament_teams'::regclass
      AND conname = 'unique_tournament_team'
  ) THEN
    ALTER TABLE tournament_teams
      DROP CONSTRAINT unique_tournament_team;
    RAISE NOTICE 'Dropped constraint unique_tournament_team';
  END IF;

  -- Fallback: drop ANY unique constraint on (tournament_id, team_id) regardless of name
  DECLARE
    _cname text;
  BEGIN
    FOR _cname IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute a1 ON a1.attrelid = con.conrelid AND a1.attnum = ANY(con.conkey) AND a1.attname = 'tournament_id'
      JOIN pg_attribute a2 ON a2.attrelid = con.conrelid AND a2.attnum = ANY(con.conkey) AND a2.attname = 'team_id'
      WHERE con.conrelid = 'tournament_teams'::regclass
        AND con.contype = 'u'
        AND array_length(con.conkey, 1) = 2
    LOOP
      EXECUTE format('ALTER TABLE tournament_teams DROP CONSTRAINT %I', _cname);
      RAISE NOTICE 'Dropped 2-col unique constraint: %', _cname;
    END LOOP;
  END;
END
$$;

-- Step 2: Add the new unique constraint that includes stage_id.
-- NULLS NOT DISTINCT ensures that (tournament_id=1, team_id=5, stage_id=NULL)
-- is treated as a duplicate of another row with the same values.
ALTER TABLE tournament_teams
  DROP CONSTRAINT IF EXISTS tournament_teams_tournament_team_stage_key;

ALTER TABLE tournament_teams
  ADD CONSTRAINT tournament_teams_tournament_team_stage_key
  UNIQUE NULLS NOT DISTINCT (tournament_id, team_id, stage_id);

-- Step 3: Verify
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'tournament_teams'::regclass
  AND contype = 'u';
