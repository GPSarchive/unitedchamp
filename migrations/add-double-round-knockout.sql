-- =====================================================
-- Migration: Double-Round Knockout (two legs + penalties)
-- Description: Adds two-legged knockout support. Each KO pairing can be
--              played as two legs; the tie is decided on aggregate, then
--              by a penalty shootout if level. Existing single-leg KO rows
--              are untouched (leg stays NULL).
-- Date: 2026-06-17
-- =====================================================

-- Step 1: Add new columns to matches table
--   leg               : 1 or 2 for two-legged ties; NULL = single-leg (all existing rows)
--   tie_leg1_match_id : on the leg-2 (decider) row, points back to leg 1
--   penalty_a/b       : penalty shootout score, recorded on the leg-2 / decider row
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS leg SMALLINT,
  ADD COLUMN IF NOT EXISTS tie_leg1_match_id INTEGER,
  ADD COLUMN IF NOT EXISTS penalty_a SMALLINT,
  ADD COLUMN IF NOT EXISTS penalty_b SMALLINT;

-- Soft self-reference: if leg 1 is deleted, leg 2 falls back to single-match
-- semantics (its tie link becomes NULL) instead of breaking.
ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_tie_leg1_match_id_fkey;

ALTER TABLE matches
  ADD CONSTRAINT matches_tie_leg1_match_id_fkey
    FOREIGN KEY (tie_leg1_match_id)
    REFERENCES matches(id)
    ON DELETE SET NULL; -- ✅ Safe: deleting leg 1 leaves leg 2 as a single match

-- Step 2: Keep leg within range when present
ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_leg_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_leg_check
    CHECK (leg IS NULL OR leg IN (1, 2));

-- Step 3: Extend the KO uniqueness constraint to include leg, so the two legs
-- of a tie can share the same (stage_id, round, bracket_pos) bracket slot.
-- (Previous form: UNIQUE NULLS NOT DISTINCT (stage_id, round, bracket_pos)
--  in fix-duplicates-constraints.sql.)
ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS unique_ko_match;

ALTER TABLE matches
  ADD CONSTRAINT unique_ko_match
    UNIQUE NULLS NOT DISTINCT (stage_id, round, bracket_pos, leg);

-- Step 4: Index for looking up the leg-2 decider that points at a given leg 1
CREATE INDEX IF NOT EXISTS idx_matches_tie_leg1_match_id
  ON matches(tie_leg1_match_id)
  WHERE tie_leg1_match_id IS NOT NULL;

-- Step 5: Documentation
COMMENT ON COLUMN matches.leg IS 'Two-legged KO leg number (1 or 2); NULL = single-leg match';
COMMENT ON COLUMN matches.tie_leg1_match_id IS 'On the leg-2 decider row, references leg 1 of the same tie (ON DELETE SET NULL)';
COMMENT ON COLUMN matches.penalty_a IS 'Penalty shootout score for team A (leg-2 decider row), used only when aggregate is level';
COMMENT ON COLUMN matches.penalty_b IS 'Penalty shootout score for team B (leg-2 decider row), used only when aggregate is level';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Columns added?
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'matches'
  AND column_name IN ('leg', 'tie_leg1_match_id', 'penalty_a', 'penalty_b');

-- Soft FK present with SET NULL?
SELECT tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'matches'
  AND tc.constraint_name = 'matches_tie_leg1_match_id_fkey';
-- Should show: delete_rule = 'SET NULL'

-- KO uniqueness now includes leg?
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'unique_ko_match';
-- Should show: UNIQUE NULLS NOT DISTINCT (stage_id, round, bracket_pos, leg)
