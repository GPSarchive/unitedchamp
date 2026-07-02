-- ============================================================================
-- fix-match-stats-rls-and-awards.sql
--
-- Two production defects surfaced while investigating "match stats not saved":
--
-- 1. match_player_stats and match_participants each carry a permissive policy
--    created FOR ALL with USING (true) and no WITH CHECK ("players_readable",
--    plus the typo'd duplicate "mmatch_player_stats_readable"). FOR ALL means
--    the policy also covers INSERT/UPDATE/DELETE, and a missing WITH CHECK
--    defaults to the USING expression — so ANY caller holding the public anon
--    key can write or delete stats rows through PostgREST. These were clearly
--    meant to be read-only. Recreate them as FOR SELECT.
--
-- 2. update_match_awards is SECURITY DEFINER with no role check, so any
--    authenticated user can clear/reassign MVP + Best GK on any match.
--    Recreate it with a can_edit_content() guard (defined in
--    add-editor-role-rls.sql — run that first if it hasn't been applied) and
--    revoke EXECUTE from anon.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- --- match_player_stats: public read stays, public write goes ---------------
DROP POLICY IF EXISTS players_readable ON public.match_player_stats;
DROP POLICY IF EXISTS mmatch_player_stats_readable ON public.match_player_stats;
DROP POLICY IF EXISTS match_player_stats_select_public ON public.match_player_stats;
CREATE POLICY match_player_stats_select_public
  ON public.match_player_stats FOR SELECT USING (true);

-- --- match_participants: same fix -------------------------------------------
DROP POLICY IF EXISTS players_readable ON public.match_participants;
DROP POLICY IF EXISTS match_participants_select_public ON public.match_participants;
CREATE POLICY match_participants_select_public
  ON public.match_participants FOR SELECT USING (true);

-- --- update_match_awards: add role guard, drop anon EXECUTE -----------------
-- Recreated dynamically so the migration works regardless of the original
-- parameter types (CREATE OR REPLACE with mismatched types would silently
-- create an overload instead of replacing). Assumes the original RETURNS void;
-- if not, drop the old function first and re-run.
DO $mig$
DECLARE
  fn_args text;
BEGIN
  SELECT pg_get_function_identity_arguments(p.oid) INTO fn_args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'update_match_awards';

  IF fn_args IS NULL THEN
    RAISE EXCEPTION 'public.update_match_awards not found';
  END IF;

  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION public.update_match_awards(%s)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    BEGIN
      -- SECURITY DEFINER bypasses RLS, so gate explicitly on the caller's JWT.
      IF NOT public.can_edit_content() THEN
        RAISE EXCEPTION 'Forbidden: admin or editor role required'
          USING ERRCODE = '42501';
      END IF;

      -- Clear all awards for this match first
      UPDATE match_player_stats
      SET mvp = false, best_goalkeeper = false
      WHERE match_id = p_match_id;

      -- Set new MVP if provided
      IF p_mvp_player_id IS NOT NULL AND p_mvp_player_id > 0 THEN
        UPDATE match_player_stats
        SET mvp = true
        WHERE match_id = p_match_id AND player_id = p_mvp_player_id;
      END IF;

      -- Set new Best GK if provided
      IF p_best_gk_player_id IS NOT NULL AND p_best_gk_player_id > 0 THEN
        UPDATE match_player_stats
        SET best_goalkeeper = true
        WHERE match_id = p_match_id AND player_id = p_best_gk_player_id;
      END IF;
    END;
    $body$;
  $f$, fn_args);

  EXECUTE format('REVOKE ALL ON FUNCTION public.update_match_awards(%s) FROM PUBLIC', fn_args);
  EXECUTE format('REVOKE ALL ON FUNCTION public.update_match_awards(%s) FROM anon', fn_args);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.update_match_awards(%s) TO authenticated', fn_args);
END
$mig$;

COMMIT;

-- ============================================================================
-- VERIFY:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('match_player_stats','match_participants');
--   -- expect: *_select_public (SELECT) + *_editor (INSERT/UPDATE/DELETE) only
--
--   SELECT proname, prosecdef, prosrc FROM pg_proc
--   WHERE proname = 'update_match_awards';
--   -- expect: body contains the can_edit_content() guard
-- ============================================================================
