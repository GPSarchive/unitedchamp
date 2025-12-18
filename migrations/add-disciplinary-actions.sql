-- =====================================================
-- Migration: Add Disciplinary Actions Table
-- Description: Adds table for tracking point deductions/adjustments
--              with audit trail for tournament organizers
-- Date: 2025-12-18
-- =====================================================

-- Step 1: Create disciplinary_actions table
CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES tournament_stages(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  group_id INTEGER DEFAULT NULL,
  points_adjustment INTEGER NOT NULL,
  reason TEXT NOT NULL,
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  match_id INTEGER DEFAULT NULL REFERENCES matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_disciplinary_actions_tournament
  ON disciplinary_actions(tournament_id);

CREATE INDEX IF NOT EXISTS idx_disciplinary_actions_stage
  ON disciplinary_actions(stage_id);

CREATE INDEX IF NOT EXISTS idx_disciplinary_actions_team
  ON disciplinary_actions(team_id);

CREATE INDEX IF NOT EXISTS idx_disciplinary_actions_applied_at
  ON disciplinary_actions(applied_at DESC);

-- Step 3: Add comments for documentation
COMMENT ON TABLE disciplinary_actions IS 'Audit trail for point adjustments (deductions/additions) applied to teams';
COMMENT ON COLUMN disciplinary_actions.points_adjustment IS 'Points changed (negative = deduction, positive = addition)';
COMMENT ON COLUMN disciplinary_actions.reason IS 'Explanation for the point adjustment';
COMMENT ON COLUMN disciplinary_actions.applied_by IS 'Admin user who applied the adjustment';
COMMENT ON COLUMN disciplinary_actions.match_id IS 'Optional reference to specific match if adjustment is match-related';
COMMENT ON COLUMN disciplinary_actions.group_id IS 'Group ID if adjustment is for a groups stage (NULL for league stages)';

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify migration)
-- =====================================================

-- Check if table was created successfully
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'disciplinary_actions';

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'disciplinary_actions'
ORDER BY ordinal_position;

-- Check foreign key constraints
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
  AND tc.constraint_type = 'FOREIGN KEY';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'disciplinary_actions';
