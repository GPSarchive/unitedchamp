-- =====================================================
-- Data fix: Backfill missing tournament_teams rows for
-- group stages that have matches but no participation records.
--
-- PREREQUISITE: Run fix-tournament-teams-multi-group-stage.sql first
-- to change the unique constraint to (tournament_id, team_id, stage_id).
--
-- HOW IT WORKS:
--   1. Looks at every match that has a stage_id + group_id (group-stage matches)
--   2. Extracts unique (tournament_id, team_id, stage_id, group_id) combinations
--      from both team_a_id and team_b_id
--   3. Inserts any missing tournament_teams rows
--   4. Existing rows are left untouched (ON CONFLICT DO NOTHING)
--
-- SAFE TO RE-RUN: idempotent via ON CONFLICT DO NOTHING.
-- =====================================================

-- Backfill from team_a_id
INSERT INTO tournament_teams (tournament_id, team_id, stage_id, group_id, seed)
SELECT DISTINCT
  m.tournament_id,
  m.team_a_id,
  m.stage_id,
  m.group_id,
  NULL
FROM matches m
JOIN tournament_stages ts ON ts.id = m.stage_id AND ts.kind = 'groups'
WHERE m.team_a_id IS NOT NULL
  AND m.stage_id  IS NOT NULL
  AND m.group_id  IS NOT NULL
ON CONFLICT (tournament_id, team_id, stage_id) DO NOTHING;

-- Backfill from team_b_id
INSERT INTO tournament_teams (tournament_id, team_id, stage_id, group_id, seed)
SELECT DISTINCT
  m.tournament_id,
  m.team_b_id,
  m.stage_id,
  m.group_id,
  NULL
FROM matches m
JOIN tournament_stages ts ON ts.id = m.stage_id AND ts.kind = 'groups'
WHERE m.team_b_id IS NOT NULL
  AND m.stage_id  IS NOT NULL
  AND m.group_id  IS NOT NULL
ON CONFLICT (tournament_id, team_id, stage_id) DO NOTHING;

-- Verify: show what was backfilled (groups stages with tournament_teams rows)
SELECT
  t.name AS tournament,
  ts.name AS stage,
  tg.name AS group_name,
  COUNT(DISTINCT tt.team_id) AS teams_in_group
FROM tournament_teams tt
JOIN tournaments t ON t.id = tt.tournament_id
JOIN tournament_stages ts ON ts.id = tt.stage_id
JOIN tournament_groups tg ON tg.id = tt.group_id
WHERE ts.kind = 'groups'
GROUP BY t.name, ts.name, tg.name
ORDER BY t.name, ts.name, tg.name;
