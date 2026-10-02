-- ============================================================================
-- add-editor-players-teams-rls.sql
--
-- Editors may now manage players and teams from the dashboard: create/edit
-- players, add/remove them from rosters, create/edit teams. The API routes
-- write these tables through the caller's own session (RLS applies), so the
-- database has to agree with the API.
--
-- add-editor-role-rls.sql deliberately left player, teams and player_teams
-- admin-only; this migration lifts that for the operations the API now
-- allows, using the same public.can_edit_content() predicate (admin OR
-- editor). The admin-only policies created by hand in the dashboard stay in
-- place — RLS policies are permissive (OR-ed), so these simply widen access.
--
-- Not granted: DELETE on player / teams. Archiving is an UPDATE of
-- deleted_at, which RLS cannot tell apart from an ordinary edit, so
-- archive/restore stay admin-only at the API layer (DELETE /api/players/[id],
-- DELETE /api/teams/[id], the two /restore routes).
--
-- Idempotent: DROP POLICY IF EXISTS then CREATE. Run in the Supabase SQL
-- editor; verify afterwards with §3 of scripts/investigate-roles.sql.
-- ============================================================================

BEGIN;

-- --- player: create + edit ---------------------------------------------------
DROP POLICY IF EXISTS player_insert_editor ON public.player;
DROP POLICY IF EXISTS player_update_editor ON public.player;
CREATE POLICY player_insert_editor ON public.player
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY player_update_editor ON public.player
  FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());

-- --- teams: create + edit ----------------------------------------------------
DROP POLICY IF EXISTS teams_insert_editor ON public.teams;
DROP POLICY IF EXISTS teams_update_editor ON public.teams;
CREATE POLICY teams_insert_editor ON public.teams
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY teams_update_editor ON public.teams
  FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());

-- --- player_teams: add to / remove from a roster -----------------------------
-- (roster add goes through the service role today; the insert policy keeps
-- the database consistent with what the API allows either way)
DROP POLICY IF EXISTS player_teams_insert_editor ON public.player_teams;
DROP POLICY IF EXISTS player_teams_delete_editor ON public.player_teams;
CREATE POLICY player_teams_insert_editor ON public.player_teams
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY player_teams_delete_editor ON public.player_teams
  FOR DELETE TO authenticated USING (public.can_edit_content());

COMMIT;

-- Check what is now deployed on the three tables:
-- SELECT tablename, policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename IN ('player','teams','player_teams')
--  ORDER BY tablename, cmd, policyname;
