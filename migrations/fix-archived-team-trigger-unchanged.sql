-- migrations/fix-archived-team-trigger-unchanged.sql
--
-- ensure_match_teams_active(): only check when a team is actually ASSIGNED.
--
-- The rule stays: an archived (soft-deleted) team cannot be put into a match —
-- not on INSERT, not by changing team_a_id / team_b_id. What changes: an
-- UPDATE that leaves both teams as they were is no longer rejected.
--
-- Why: the trigger is declared `BEFORE INSERT OR UPDATE OF team_a_id, team_b_id`,
-- and Postgres fires `UPDATE OF col` whenever the column appears in the SET
-- list, even with the same value. The tournament editor (save-all) always
-- sends both team columns for every row of a stage, so any stage where an
-- archived team has already played could never be saved again. Incident
-- 2026-10-22: tournament #61 failed on match #2591 (RED PULSE, archived the
-- day before, untouched by the admin). On that date 8 tournaments (#13, #20,
-- #23, #32, #33, #34, #35, #61) had matches with archived teams.
--
-- The trigger and its function existed only in prod (created in the Supabase
-- dashboard); this file brings both into the repo. Re-runnable.
--
-- Run in Supabase → SQL Editor. Verify (each block must end in the message
-- shown, and rolls back):
--
--   -- 1) untouched row with an archived team: now allowed
--   do $$ begin
--     update public.matches set team_a_id = team_a_id, team_b_id = team_b_id where id = 2591;
--     raise exception 'OK 1: unchanged archived-team row saves (rolled back)';
--   end $$;
--
--   -- 2) assigning an archived team: still refused
--   do $$ begin
--     update public.matches set team_b_id = 184 where id = 2603;   -- 184 = RED PULSE (archived)
--     raise exception 'BUG: archived team was assigned';
--   exception when others then
--     if sqlerrm like 'Cannot use archived%' then raise exception 'OK 2: still refused: %', sqlerrm; end if;
--     raise;
--   end $$;

CREATE OR REPLACE FUNCTION public.ensure_match_teams_active()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  a_deleted timestamptz;
  b_deleted timestamptz;
BEGIN
  -- Re-writing a row without changing its teams is not an assignment.
  IF TG_OP = 'UPDATE'
     AND NEW.team_a_id IS NOT DISTINCT FROM OLD.team_a_id
     AND NEW.team_b_id IS NOT DISTINCT FROM OLD.team_b_id THEN
    RETURN NEW;
  END IF;

  -- Only the side that changed is checked: swapping the opponent of an
  -- archived team's past match is not "using" the archived team anew.
  IF TG_OP = 'INSERT' OR NEW.team_a_id IS DISTINCT FROM OLD.team_a_id THEN
    SELECT deleted_at INTO a_deleted FROM public.teams WHERE id = NEW.team_a_id;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.team_b_id IS DISTINCT FROM OLD.team_b_id THEN
    SELECT deleted_at INTO b_deleted FROM public.teams WHERE id = NEW.team_b_id;
  END IF;

  IF a_deleted IS NOT NULL OR b_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot use archived (soft-deleted) team in matches';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_matches_no_archived_teams ON public.matches;
CREATE TRIGGER trg_matches_no_archived_teams
  BEFORE INSERT OR UPDATE OF team_a_id, team_b_id ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.ensure_match_teams_active();
