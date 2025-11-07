-- ============================================================
-- SQL Script to Fix Tournament Matches Duplicate Issues
-- ============================================================
--
-- This script adds unique constraints to prevent duplicate matches
-- Run this in your Supabase SQL Editor
--
-- IMPORTANT: This will fail if you have existing duplicates!
-- First, run the cleanup queries below to remove duplicates,
-- then run the constraint creation queries.
--
-- ============================================================

-- ============================================================
-- STEP 1: Find and remove duplicate KO matches
-- ============================================================

-- Preview duplicates (KO matches)
SELECT
  stage_id,
  round,
  bracket_pos,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as match_ids
FROM matches
WHERE round IS NOT NULL
  AND bracket_pos IS NOT NULL
GROUP BY stage_id, round, bracket_pos
HAVING COUNT(*) > 1;

-- Delete duplicate KO matches (keeps the newest one based on created_at)
-- UNCOMMENT AND RUN THIS AFTER REVIEWING THE PREVIEW ABOVE:
/*
DELETE FROM matches
WHERE id IN (
  SELECT unnest(match_ids[2:])  -- Keep first (newest), delete rest
  FROM (
    SELECT ARRAY_AGG(id ORDER BY created_at DESC) as match_ids
    FROM matches
    WHERE round IS NOT NULL
      AND bracket_pos IS NOT NULL
    GROUP BY stage_id, round, bracket_pos
    HAVING COUNT(*) > 1
  ) duplicates
);
*/

-- ============================================================
-- STEP 2: Find and remove duplicate league/group matches
-- ============================================================

-- Preview duplicates (league/group matches)
SELECT
  stage_id,
  COALESCE(group_id, -1) as group_id,
  COALESCE(matchday, -1) as matchday,
  COALESCE(bracket_pos, -1) as bracket_pos,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as match_ids
FROM matches
WHERE round IS NULL
  OR bracket_pos IS NULL
GROUP BY stage_id, COALESCE(group_id, -1), COALESCE(matchday, -1), COALESCE(bracket_pos, -1)
HAVING COUNT(*) > 1;

-- Delete duplicate league/group matches (keeps the newest one)
-- UNCOMMENT AND RUN THIS AFTER REVIEWING THE PREVIEW ABOVE:
/*
DELETE FROM matches
WHERE id IN (
  SELECT unnest(match_ids[2:])
  FROM (
    SELECT ARRAY_AGG(id ORDER BY created_at DESC) as match_ids
    FROM matches
    WHERE round IS NULL
      OR bracket_pos IS NULL
    GROUP BY stage_id, COALESCE(group_id, -1), COALESCE(matchday, -1), COALESCE(bracket_pos, -1)
    HAVING COUNT(*) > 1
  ) duplicates
);
*/

-- ============================================================
-- STEP 3: Add unique constraints to prevent future duplicates
-- ============================================================

-- Add unique constraint for KO matches (stage_id + round + bracket_pos)
-- This prevents duplicate knockout matches
ALTER TABLE matches
DROP CONSTRAINT IF EXISTS unique_ko_match;

ALTER TABLE matches
ADD CONSTRAINT unique_ko_match
UNIQUE NULLS NOT DISTINCT (stage_id, round, bracket_pos);

-- Add unique constraint for league/group matches (stage_id + group_id + matchday + bracket_pos)
-- This prevents duplicate league/group matches
ALTER TABLE matches
DROP CONSTRAINT IF EXISTS unique_league_match;

ALTER TABLE matches
ADD CONSTRAINT unique_league_match
UNIQUE NULLS NOT DISTINCT (stage_id, group_id, matchday, bracket_pos);

-- Note: NULLS NOT DISTINCT ensures that NULL values are treated as equal
-- This is important because some fields may be NULL for certain match types

-- ============================================================
-- STEP 4: Verify constraints were added
-- ============================================================

SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'matches'::regclass
  AND conname IN ('unique_ko_match', 'unique_league_match');

-- ============================================================
-- Expected output:
-- ============================================================
-- constraint_name    | constraint_type | constraint_definition
-- -------------------|-----------------|--------------------------------------------------
-- unique_ko_match    | u               | UNIQUE NULLS NOT DISTINCT (stage_id, round, bracket_pos)
-- unique_league_match| u               | UNIQUE NULLS NOT DISTINCT (stage_id, group_id, matchday, bracket_pos)
-- ============================================================
