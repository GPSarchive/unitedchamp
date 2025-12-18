-- =====================================================
-- Migration: Fix Disciplinary Actions Foreign Key
-- Description: Fixes team_id to reference teams table instead of tournament_teams
-- Date: 2025-12-18
-- =====================================================

-- Step 1: Drop the incorrect constraint
ALTER TABLE disciplinary_actions
  DROP CONSTRAINT IF EXISTS disciplinary_actions_team_id_fkey;

-- Step 2: Add correct constraint referencing teams table
ALTER TABLE disciplinary_actions
  ADD CONSTRAINT disciplinary_actions_team_id_fkey
    FOREIGN KEY (team_id)
    REFERENCES teams(id)
    ON DELETE CASCADE;

-- Verification
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'disciplinary_actions'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'team_id';
-- Should show: foreign_table_name = 'teams'
