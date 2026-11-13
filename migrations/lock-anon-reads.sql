-- ============================================================================
-- lock-anon-reads.sql  — run once in the Supabase SQL editor; idempotent.
--
-- !! DEPLOY THE APP FIRST. !!
-- This migration removes the anon key's ability to read ANY table. The app
-- version that goes with it reads those tables on the server with the service
-- role. Run this against a production that still serves the old code and the
-- /matches explorer, article pages and announcements go empty.
--
-- WHY
-- The anon key ships in the browser bundle (it has to — sign-in needs it).
-- Until now it could also read ten tables directly through the REST API:
--   matches, teams, tournaments, tournament_stages, tournament_groups,
--   tournament_teams, tournament_awards, stage_standings, seasons,
--   articles (published), announcements (published)
-- so anyone could copy the URL + key out of DevTools and download those
-- tables as JSON, on a schedule, without ever touching the website — out of
-- reach of the rate limiter and invisible in the site's own logs.
--
-- AFTER THIS
--   anon (the public key)               -> reads nothing
--   authenticated, not staff (players)  -> reads nothing
--   authenticated staff (admin/editor)  -> reads everything, as before
--                                          (dashboard code using the
--                                          cookie-bound client keeps working)
--   service role (the server)           -> bypasses RLS, as before
--
-- Code that moved off the anon read path in the same change:
--   /matches explorer          -> GET /api/matches/explorer   (service role)
--   /article/[slug]            -> service role + explicit published check
--   /announcement/[id]         -> service role + explicit published filter
--   /api/articles-public       -> service role
--   /api/announcements (GET)   -> service role; published-only for non-staff
--   dashboard RowEditor leg-1  -> GET /api/matches/:id        (staff only)
--
-- Verify before/after with:  node scripts/audit-anon-reads.mjs
--   before: 10 tables "OPEN"      after: every line "closed"
--
-- ROLLBACK: re-run migrations/enable-public-read-rls.sql (restores the
-- public_read policies) and, for seasons, the policy in add-seasons.sql.
-- ============================================================================

BEGIN;

-- can_edit_content() comes from add-editor-role-rls.sql; fail loudly if absent
-- rather than creating policies that reference a missing function.
DO $$
BEGIN
  IF to_regprocedure('public.can_edit_content()') IS NULL THEN
    RAISE EXCEPTION 'public.can_edit_content() is missing — run migrations/add-editor-role-rls.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Replace every SELECT policy on the formerly-public tables with a single
--    staff-only one. Write policies (INSERT/UPDATE/DELETE) are not touched.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p RECORD;
  tables text[] := ARRAY[
    'matches','teams','tournaments','tournament_stages','tournament_groups',
    'tournament_teams','tournament_awards','stage_standings','seasons',
    'articles','announcements'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY staff_read ON public.%I FOR SELECT USING (public.can_edit_content())',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) A policy written as FOR ALL also grants SELECT. If any of these tables
--    carries one that is open to everyone, the lock above would be undone by
--    it — stop and show it instead of silently leaving a hole.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  leak text;
BEGIN
  SELECT string_agg(format('%s.%s (%s)', tablename, policyname, coalesce(qual, 'no USING')), '; ')
    INTO leak
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd = 'ALL'
    AND tablename IN (
      'matches','teams','tournaments','tournament_stages','tournament_groups',
      'tournament_teams','tournament_awards','stage_standings','seasons',
      'articles','announcements'
    )
    AND (qual IS NULL OR btrim(qual, '() ') = 'true');

  IF leak IS NOT NULL THEN
    RAISE EXCEPTION 'Open FOR ALL policy would still allow public reads: %', leak;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) search_teams_fuzzy: the only data-returning function the app calls, and
--    only from the server (OMADES page, service role). Functions are
--    executable by everyone by default, and a SECURITY DEFINER one would
--    bypass the policies above — so take it away from the public roles.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'search_teams_fuzzy'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- After running:
--   1. node scripts/audit-anon-reads.mjs   -> "0 of N tables/views are readable"
--   2. Logged OUT: open /, /matches (both tabs, a tournament filter, page 2),
--      /articles, one article, one announcement, /tournaments/<id>, /OMADES
--      (use the search box), one team page, one match page.
--   3. Logged IN as editor: /dashboard/matches (edit a match; open a leg-2
--      knockout match and check the aggregate line), /dashboard/articles,
--      /dashboard/announcements, /dashboard/teams, the tournament editor.
-- ============================================================================
