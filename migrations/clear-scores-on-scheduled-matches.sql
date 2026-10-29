-- One-off data repair (run in the Supabase SQL editor, after deploying the
-- planner fix in PR #216).
--
-- Why: saveMatchStatsAction used to write the computed score (0-0 when nobody
-- was marked as played) even when the match stayed "scheduled". The planner
-- renders any non-null score, so those rows looked like finished 0-0 draws
-- and the revert button (finished-only) never appeared for them.
--
-- The fixed code no longer writes a score for scheduled matches, and the
-- panel now shows the revert button for rows that still carry a stray score,
-- so each one can also be cleaned from the UI. This script does the same in
-- bulk for the matches themselves (scores / winner / pens only).
--
-- NOTE: it does NOT delete match_player_stats / match_participants. Rows with
-- stats but status "scheduled" are listed by the second preview; clear those
-- individually with the revert button (which also recomputes standings).

-- 1) Preview: scheduled matches that carry a score.
select m.id, m.tournament_id, m.stage_id, m.status,
       m.team_a_score, m.team_b_score, m.winner_team_id,
       m.penalty_a, m.penalty_b, m.match_date, m.updated_at
from public.matches m
where m.status = 'scheduled'
  and (m.team_a_score is not null or m.team_b_score is not null)
order by m.updated_at desc;

-- 2) Preview: of those, which also have player stats / participants attached.
select m.id, m.tournament_id,
       (select count(*) from public.match_player_stats s where s.match_id = m.id) as stat_rows,
       (select count(*) from public.match_participants p where p.match_id = m.id) as participant_rows
from public.matches m
where m.status = 'scheduled'
  and (m.team_a_score is not null or m.team_b_score is not null)
  and (exists (select 1 from public.match_player_stats s where s.match_id = m.id)
    or exists (select 1 from public.match_participants p where p.match_id = m.id));

-- 3) Repair: clear the stray score on scheduled matches.
begin;
update public.matches
set team_a_score = null,
    team_b_score = null,
    winner_team_id = null,
    penalty_a = null,
    penalty_b = null
where status = 'scheduled'
  and (team_a_score is not null or team_b_score is not null);
commit;
