-- ============================================================================
-- add-season-flip-fn.sql  (Seasonal system, hardening B — atomic pointer flip)
-- Run once in the Supabase SQL editor BEFORE deploying the code that calls
-- these functions (src/app/dashboard/seasons/actions.ts). Idempotent.
--
-- Why: the app used to flip the active-season pointer in two round-trips
-- (archive the current row, then activate the next). Between them there was
-- no active season — an ISR regeneration in that instant baked an EMPTY page
-- into the cache — and the rollback was best-effort. Here both updates commit
-- together: readers see the old pointer until commit and the new one after,
-- never neither, and idx_seasons_one_active still rejects a concurrent close.
--
-- Same access pattern as migrations/add-progression-integrity.sql: callable
-- by the service role only.
-- ============================================================================

BEGIN;

-- 1) Close a season -----------------------------------------------------------
--    Archives p_current (which MUST be the active row), creates p_next as
--    needed, activates it. Returns {previous, next}.
CREATE OR REPLACE FUNCTION public.flip_active_season(
  p_current         text,
  p_next            text,
  p_next_display    text,
  p_next_started_on date,
  p_actor           uuid
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_current IS NULL OR p_next IS NULL OR btrim(p_current) = '' OR btrim(p_next) = '' THEN
    RAISE EXCEPTION 'flip_active_season: both season labels are required';
  END IF;
  IF p_current = p_next THEN
    RAISE EXCEPTION 'flip_active_season: the next season must differ from the current one';
  END IF;

  -- Lock the closing row; it must be the active one.
  SELECT status INTO v_status FROM public.seasons WHERE label = p_current FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'flip_active_season: season % does not exist', p_current;
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'flip_active_season: season % is not the active season', p_current;
  END IF;

  -- The next row: create it ARCHIVED when missing (never a second active row).
  INSERT INTO public.seasons (label, display_label, status, started_on)
  VALUES (
    p_next,
    COALESCE(NULLIF(btrim(p_next_display), ''), p_next),
    'archived',
    COALESCE(p_next_started_on, current_date)
  )
  ON CONFLICT (label) DO NOTHING;

  UPDATE public.seasons
     SET status = 'archived',
         archived_at = now(),
         archived_by = p_actor,
         ended_on = current_date
   WHERE label = p_current;

  UPDATE public.seasons
     SET status = 'active',
         archived_at = NULL,
         archived_by = NULL,
         ended_on = NULL,
         started_on = COALESCE(started_on, p_next_started_on, current_date)
   WHERE label = p_next;

  RETURN jsonb_build_object('previous', p_current, 'next', p_next);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.flip_active_season(text, text, text, date, uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flip_active_season(text, text, text, date, uuid)
  TO service_role;

-- 2) Reopen / recovery -----------------------------------------------------
--    Makes p_label the active season, archiving whichever row is active now
--    (if any). Runs no snapshot — the caller decides that. Returns
--    {previous, next}; previous is null when nothing was active.
CREATE OR REPLACE FUNCTION public.set_active_season(p_label text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE label = p_label) THEN
    RAISE EXCEPTION 'set_active_season: season % does not exist', p_label;
  END IF;

  SELECT label INTO v_previous FROM public.seasons WHERE status = 'active' FOR UPDATE;
  IF v_previous = p_label THEN
    RETURN jsonb_build_object('previous', v_previous, 'next', p_label);
  END IF;

  IF v_previous IS NOT NULL THEN
    UPDATE public.seasons
       SET status = 'archived',
           archived_at = now(),
           archived_by = p_actor,
           ended_on = current_date
     WHERE label = v_previous;
  END IF;

  UPDATE public.seasons
     SET status = 'active', archived_at = NULL, archived_by = NULL, ended_on = NULL
   WHERE label = p_label;

  RETURN jsonb_build_object('previous', v_previous, 'next', p_label);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_active_season(text, uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_season(text, uuid)
  TO service_role;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verify — exercises BOTH functions against the real rows and rolls back, so
-- nothing changes. Run as one block; read the two grids.
-- ---------------------------------------------------------------------------
-- BEGIN;
--   SELECT public.flip_active_season('2025-2026', '__verify__', 'verify', current_date, NULL);
--   SELECT label, status, started_on, ended_on, archived_at IS NOT NULL AS archived
--     FROM public.seasons ORDER BY label;
--   -- expect: exactly one 'active' row (__verify__); 2025-2026 archived, ended_on = today
--   SELECT public.set_active_season('2025-2026', NULL);
--   SELECT label, status, ended_on FROM public.seasons ORDER BY label;
--   -- expect: 2025-2026 active with ended_on NULL; __verify__ archived
-- ROLLBACK;
--
-- Then: node scripts/audit-rls.mjs  → the anon key cannot execute either function.
