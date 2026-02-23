-- Add denormalized team/match count columns to the tournaments table.
-- These are maintained by application code (refreshTournamentCounts) so
-- the homepage no longer needs N+1 COUNT queries.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS teams_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matches_count integer NOT NULL DEFAULT 0;

-- Backfill existing tournaments in a single pass.
UPDATE public.tournaments t
SET
  teams_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT tournament_id, COUNT(DISTINCT team_id) AS cnt
  FROM public.tournament_teams
  GROUP BY tournament_id
) sub
WHERE t.id = sub.tournament_id;

UPDATE public.tournaments t
SET
  matches_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT tournament_id, COUNT(*) AS cnt
  FROM public.matches
  GROUP BY tournament_id
) sub
WHERE t.id = sub.tournament_id;
