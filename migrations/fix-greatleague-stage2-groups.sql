-- =====================================================
-- Data fix: GREAT LEAGUE Stage 2 (stage_id = 44)
-- Create groups and assign matches + teams to them.
--
-- The matches were created flat (no group_id). This script:
--   1. Creates 2 tournament_groups for stage 44
--   2. Sets group_id on all 30 matches based on team pairings
--   3. Creates tournament_teams rows linking teams to their groups
--
-- Group A: teams 55, 57, 58, 62, 63, 64
-- Group B: teams 54, 59, 60, 65, 66, 67
-- (Derived from round-robin match pairings)
--
-- SAFE: Does not delete or modify scores/stats.
-- IDEMPOTENT: Can be re-run (uses ON CONFLICT / WHERE guards).
-- =====================================================

-- 1) Create the two groups for stage 44 (skip if they already exist)
INSERT INTO tournament_groups (stage_id, name, ordering)
VALUES
  (44, 'Όμιλος Α', 0),
  (44, 'Όμιλος Β', 1)
ON CONFLICT DO NOTHING;

-- 2) Capture the group IDs we just created (or that already existed)
DO $$
DECLARE
  gid_a bigint;
  gid_b bigint;
BEGIN
  SELECT id INTO gid_a FROM tournament_groups
    WHERE stage_id = 44 AND ordering = 0 LIMIT 1;
  SELECT id INTO gid_b FROM tournament_groups
    WHERE stage_id = 44 AND ordering = 1 LIMIT 1;

  IF gid_a IS NULL OR gid_b IS NULL THEN
    RAISE EXCEPTION 'Could not find/create groups for stage 44';
  END IF;

  -- 3) Assign group_id on matches where BOTH teams are in Group A
  UPDATE matches
  SET group_id = gid_a
  WHERE stage_id = 44
    AND group_id IS NULL
    AND team_a_id IN (55, 57, 58, 62, 63, 64)
    AND team_b_id IN (55, 57, 58, 62, 63, 64);

  -- 4) Assign group_id on matches where BOTH teams are in Group B
  UPDATE matches
  SET group_id = gid_b
  WHERE stage_id = 44
    AND group_id IS NULL
    AND team_a_id IN (54, 59, 60, 65, 66, 67)
    AND team_b_id IN (54, 59, 60, 65, 66, 67);

  -- 5) Create tournament_teams rows for Group A
  INSERT INTO tournament_teams (tournament_id, team_id, stage_id, group_id, seed)
  VALUES
    (13, 55, 44, gid_a, NULL),
    (13, 57, 44, gid_a, NULL),
    (13, 58, 44, gid_a, NULL),
    (13, 62, 44, gid_a, NULL),
    (13, 63, 44, gid_a, NULL),
    (13, 64, 44, gid_a, NULL)
  ON CONFLICT (tournament_id, team_id, stage_id) DO UPDATE
    SET group_id = EXCLUDED.group_id;

  -- 6) Create tournament_teams rows for Group B
  INSERT INTO tournament_teams (tournament_id, team_id, stage_id, group_id, seed)
  VALUES
    (13, 54, 44, gid_b, NULL),
    (13, 59, 44, gid_b, NULL),
    (13, 60, 44, gid_b, NULL),
    (13, 65, 44, gid_b, NULL),
    (13, 66, 44, gid_b, NULL),
    (13, 67, 44, gid_b, NULL)
  ON CONFLICT (tournament_id, team_id, stage_id) DO UPDATE
    SET group_id = EXCLUDED.group_id;

  RAISE NOTICE 'Done. Group A id=%, Group B id=%', gid_a, gid_b;
END $$;

-- 7) Verify: check no matches are left without a group
SELECT
  m.id AS match_id,
  m.group_id,
  m.team_a_id,
  m.team_b_id,
  m.status,
  tg.name AS group_name
FROM matches m
LEFT JOIN tournament_groups tg ON tg.id = m.group_id
WHERE m.stage_id = 44
ORDER BY m.group_id, m.matchday, m.id;
