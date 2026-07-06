-- ============================================================================
-- Progression-engine integrity helpers
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- 1) replace_stage_standings — atomic replace of one group's standings rows.
--    The TS cascade (progression.ts → replaceStandings) previously did
--    delete-then-insert over PostgREST with no transaction: a failure between
--    the two writes silently wiped a group's standings. The code now calls
--    this function first and only falls back to delete+insert if it is
--    missing, so applying this migration closes that window.
--
-- 2) alloc_stage_slot — race-safe "next free slot" allocation for KO→Groups
--    intake. progression.ts already tries this RPC and falls back to a racy
--    read-max-plus-one scan when absent.
--
-- 3) Unique index on intake_mappings — the auto-mapping creation is
--    check-then-insert; two matches finishing at the same moment could both
--    pass the check and create duplicate mappings. The code treats a unique
--    violation as success, so the index makes the race harmless.
-- ============================================================================

-- 1) Atomic standings replace ------------------------------------------------

create or replace function public.replace_stage_standings(
  p_stage_id bigint,
  p_group_id bigint,
  p_rows    jsonb
) returns void
language plpgsql
as $$
begin
  delete from public.stage_standings
   where stage_id = p_stage_id
     and group_id = p_group_id;

  insert into public.stage_standings
    (stage_id, group_id, team_id, played, won, drawn, lost, gf, ga, gd, points, "rank")
  select
    p_stage_id,
    p_group_id,
    (r->>'team_id')::bigint,
    coalesce((r->>'played')::int, 0),
    coalesce((r->>'won')::int, 0),
    coalesce((r->>'drawn')::int, 0),
    coalesce((r->>'lost')::int, 0),
    coalesce((r->>'gf')::int, 0),
    coalesce((r->>'ga')::int, 0),
    coalesce((r->>'gd')::int, 0),
    coalesce((r->>'points')::int, 0),
    coalesce((r->>'rank')::int, 0)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r;
end;
$$;

-- Only the service role (server-side cascade) may call it.
revoke execute on function public.replace_stage_standings(bigint, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_stage_standings(bigint, bigint, jsonb)
  to service_role;

-- 2) Race-safe slot allocation -------------------------------------------------

create or replace function public.alloc_stage_slot(
  p_stage_id  bigint,
  p_group_idx int
) returns int
language plpgsql
as $$
declare
  v_next int;
begin
  -- Serialize per (stage, group) for the rest of this transaction so two
  -- matches finishing concurrently cannot be handed the same slot.
  perform pg_advisory_xact_lock(
    hashtextextended('stage_slots:' || p_stage_id || ':' || p_group_idx, 0)
  );

  select coalesce(max(slot_id), 0) + 1
    into v_next
    from public.stage_slots
   where stage_id = p_stage_id
     and group_id = p_group_idx;

  return v_next;
end;
$$;

revoke execute on function public.alloc_stage_slot(bigint, int)
  from public, anon, authenticated;
grant execute on function public.alloc_stage_slot(bigint, int)
  to service_role;

-- 3) Intake-mapping uniqueness ---------------------------------------------

-- Remove any duplicates created by the old check-then-insert race first.
delete from public.intake_mappings a
 using public.intake_mappings b
 where a.id > b.id
   and a.from_stage_id   = b.from_stage_id
   and a.round           = b.round
   and a.bracket_pos     = b.bracket_pos
   and a.outcome         = b.outcome
   and a.target_stage_id = b.target_stage_id;

create unique index if not exists intake_mappings_from_edge_uniq
  on public.intake_mappings (from_stage_id, round, bracket_pos, outcome, target_stage_id);
