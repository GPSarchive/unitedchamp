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

-- Step 3: Extend the KO uniqueness rule to include leg, so the two legs of a
-- tie can share the same (stage_id, round, bracket_pos) bracket slot.
--
-- IMPORTANT: this must be a PARTIAL unique INDEX scoped to real KO rows, NOT a
-- table constraint. A plain UNIQUE (... NULLS NOT DISTINCT) treats the all-NULL
-- key of every league/group match — (stage_id, NULL, NULL, NULL) — as equal,
-- so it collides across non-KO fixtures in the same stage ("could not create
-- unique index ... is duplicated"). The WHERE clause excludes those rows.
DROP INDEX IF EXISTS unique_ko_match;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS unique_ko_match; -- drop old table-constraint form if present

CREATE UNIQUE INDEX IF NOT EXISTS unique_ko_match
  ON matches (stage_id, round, bracket_pos, leg)
  WHERE round IS NOT NULL AND bracket_pos IS NOT NULL;

-- Step 3b: Drop ALL legacy KO-slot uniqueness objects that predate two-legged
-- support. They enforced (stage_id, round, bracket_pos) WITHOUT leg, so they
-- block the two legs of a tie from sharing a bracket slot. unique_ko_match
-- (above) now covers KO-slot uniqueness in a leg-aware way, INCLUDING old
-- single-leg matches (leg = NULL), so these are pure duplicates — dropping them
-- removes no data and leaves existing single-leg KO brackets fully protected.
-- (Different DBs accumulated these under different names; drop all known forms.)
-- NOTE: do NOT touch unique_league_match_idx — it guards league matches
-- (WHERE round IS NULL) and is unrelated.
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_stage_round_pos_uniq;
DROP INDEX IF EXISTS matches_stage_round_pos_uniq;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS unique_ko_match_idx;
DROP INDEX IF EXISTS unique_ko_match_idx;

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

-- KO uniqueness now includes leg (as a partial index)?
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname = 'unique_ko_match';
-- Should show a UNIQUE INDEX on (stage_id, round, bracket_pos, leg)
-- WHERE round IS NOT NULL AND bracket_pos IS NOT NULL
