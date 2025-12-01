-- =====================================================
-- Migration: Add Match Postponement Support (SAFE VERSION)
-- Description: Adds fields and status for postponing matches
--              with ON DELETE SET NULL for safety
-- Date: 2025-12-01
-- =====================================================

-- Step 1: Add new columns to matches table
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS postponement_reason TEXT,
  ADD COLUMN IF NOT EXISTS original_match_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS postponed_at TIMESTAMPTZ;

-- Add postponed_by separately with ON DELETE SET NULL
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS postponed_by UUID;

-- Add foreign key constraint with safe deletion behavior
ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_postponed_by_fkey;

ALTER TABLE matches
  ADD CONSTRAINT matches_postponed_by_fkey
    FOREIGN KEY (postponed_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL; -- ✅ Safe: If admin deleted, just set to NULL

-- Step 2: Update status constraint to include 'postponed'
-- First, drop the existing constraint if it exists
ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_status_check;

-- Add the new constraint with 'postponed' status
ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
    CHECK (status IN ('scheduled', 'finished', 'postponed'));

-- Step 3: Create index for querying postponed matches efficiently
CREATE INDEX IF NOT EXISTS idx_matches_status_postponed
  ON matches(status)
  WHERE status = 'postponed';

-- Step 4: Create index for postponement queries
CREATE INDEX IF NOT EXISTS idx_matches_postponed_at
  ON matches(postponed_at)
  WHERE postponed_at IS NOT NULL;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN matches.postponement_reason IS 'Reason why the match was postponed';
COMMENT ON COLUMN matches.original_match_date IS 'Original date before postponement';
COMMENT ON COLUMN matches.postponed_at IS 'Timestamp when the match was postponed';
COMMENT ON COLUMN matches.postponed_by IS 'User ID of admin who postponed the match (NULL if admin was deleted)';

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify migration)
-- =====================================================

-- Check if columns were added successfully
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'matches'
  AND column_name IN ('postponement_reason', 'original_match_date', 'postponed_at', 'postponed_by');

-- Check if constraint was updated
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'matches_status_check';

-- Check if foreign key has ON DELETE SET NULL
SELECT
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'matches'
  AND tc.constraint_name = 'matches_postponed_by_fkey';
-- Should show: delete_rule = 'SET NULL'

-- Check if indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'matches'
  AND indexname LIKE 'idx_matches_%postponed%';
