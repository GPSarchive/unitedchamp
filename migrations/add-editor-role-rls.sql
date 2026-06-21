-- ============================================================================
-- add-editor-role-rls.sql
--
-- Grants the new "editor" role the same RLS write access as "admin" across the
-- content surfaces an editor is allowed to manage:
--   * match cluster: matches, match_player_stats, match_participants,
--     player_statistics, tournament_awards, and the progression tables
--     (tournaments, tournament_stages, tournament_groups, tournament_teams,
--      stage_slots, intake_mappings, stage_standings)
--   * articles
--   * announcements
--   * posts
--
-- Mechanism: the existing policies test
--     (auth.jwt() -> 'app_metadata' -> 'roles') @> '["admin"]'::jsonb
-- which is true only for admins. We replace each with an overlap test
--     (auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin','editor']
-- which is true when the roles array contains EITHER 'admin' OR 'editor'.
--
-- This is idempotent: DROP POLICY IF EXISTS then CREATE. Re-running is safe and
-- also collapses the duplicate same-named policies the audit surfaced.
--
-- NOT touched (stay admin-only): teams, player, player_teams, audit_logs.
-- ============================================================================

-- A helper expression used everywhere. (Inlined per-policy below; Postgres RLS
-- doesn't let us alias it, so it's repeated — but it's always the same test.)
--   (auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin','editor']

BEGIN;

-- ---------------------------------------------------------------------------
-- Generic "edit content" predicate via a SQL function, so policies stay short
-- and a future role tweak is one-line. SECURITY INVOKER + STABLE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_edit_content()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin','editor'],
    false
  );
$$;

-- ===========================================================================
-- Helper: for each table we drop the known admin-only policy names (including
-- the duplicated `players_*_admin_only` ones) and recreate clean editor-aware
-- policies. We standardize on four policy names per table:
--   <t>_select_editor (only where a SELECT policy existed), _insert/_update/_delete_editor
-- ===========================================================================

-- A reusable macro isn't available in plain SQL, so each table is spelled out.
-- The body is mechanical: same four policies, same predicate.

-- --- matches ---------------------------------------------------------------
DROP POLICY IF EXISTS matches_insert_admin_only ON public.matches;
DROP POLICY IF EXISTS matches_update_admin_only ON public.matches;
DROP POLICY IF EXISTS matches_delete_admin_only ON public.matches;
CREATE POLICY matches_insert_editor ON public.matches FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY matches_update_editor ON public.matches FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY matches_delete_editor ON public.matches FOR DELETE TO authenticated USING (public.can_edit_content());

-- --- match_player_stats -----------------------------------------------------
DROP POLICY IF EXISTS players_insert_admin_only ON public.match_player_stats;
DROP POLICY IF EXISTS players_update_admin_only ON public.match_player_stats;
DROP POLICY IF EXISTS players_delete_admin_only ON public.match_player_stats;
DROP POLICY IF EXISTS match_player_stats_insert_admin_only ON public.match_player_stats;
DROP POLICY IF EXISTS match_player_stats_update_admin_only ON public.match_player_stats;
DROP POLICY IF EXISTS match_player_stats_delete_admin_only ON public.match_player_stats;
CREATE POLICY match_player_stats_insert_editor ON public.match_player_stats FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY match_player_stats_update_editor ON public.match_player_stats FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY match_player_stats_delete_editor ON public.match_player_stats FOR DELETE TO authenticated USING (public.can_edit_content());

-- --- match_participants ------------------------------------------------------
DROP POLICY IF EXISTS players_insert_admin_only ON public.match_participants;
DROP POLICY IF EXISTS players_update_admin_only ON public.match_participants;
DROP POLICY IF EXISTS players_delete_admin_only ON public.match_participants;
CREATE POLICY match_participants_insert_editor ON public.match_participants FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY match_participants_update_editor ON public.match_participants FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY match_participants_delete_editor ON public.match_participants FOR DELETE TO authenticated USING (public.can_edit_content());

-- --- player_statistics ------------------------------------------------------
-- NOTE: the audit showed a SELECT policy "player_statistics_select_admin_only"
-- that restricts reads to admins. We widen it to editors too so the stats
-- editor can read existing aggregates. (If you want stats publicly readable,
-- change USING to `true` instead — ask first.)
DROP POLICY IF EXISTS player_statistics_select_admin_only ON public.player_statistics;
DROP POLICY IF EXISTS player_statistics_insert_admin_only ON public.player_statistics;
DROP POLICY IF EXISTS player_statistics_update_admin_only ON public.player_statistics;
DROP POLICY IF EXISTS player_statistics_delete_admin_only ON public.player_statistics;
CREATE POLICY player_statistics_select_editor ON public.player_statistics FOR SELECT TO authenticated USING (public.can_edit_content());
CREATE POLICY player_statistics_insert_editor ON public.player_statistics FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY player_statistics_update_editor ON public.player_statistics FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY player_statistics_delete_editor ON public.player_statistics FOR DELETE TO authenticated USING (public.can_edit_content());

-- --- tournament_awards ------------------------------------------------------
DROP POLICY IF EXISTS players_insert_admin_only ON public.tournament_awards;
DROP POLICY IF EXISTS players_update_admin_only ON public.tournament_awards;
DROP POLICY IF EXISTS players_delete_admin_only ON public.tournament_awards;
CREATE POLICY tournament_awards_insert_editor ON public.tournament_awards FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY tournament_awards_update_editor ON public.tournament_awards FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY tournament_awards_delete_editor ON public.tournament_awards FOR DELETE TO authenticated USING (public.can_edit_content());

-- --- progression tables (needed when saving a KO match progresses the bracket)
-- tournaments
DROP POLICY IF EXISTS players_insert_admin_only ON public.tournaments;
DROP POLICY IF EXISTS players_update_admin_only ON public.tournaments;
DROP POLICY IF EXISTS players_delete_admin_only ON public.tournaments;
CREATE POLICY tournaments_insert_editor ON public.tournaments FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY tournaments_update_editor ON public.tournaments FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY tournaments_delete_editor ON public.tournaments FOR DELETE TO authenticated USING (public.can_edit_content());

-- tournament_stages
DROP POLICY IF EXISTS players_insert_admin_only ON public.tournament_stages;
DROP POLICY IF EXISTS players_update_admin_only ON public.tournament_stages;
DROP POLICY IF EXISTS players_delete_admin_only ON public.tournament_stages;
CREATE POLICY tournament_stages_insert_editor ON public.tournament_stages FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY tournament_stages_update_editor ON public.tournament_stages FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY tournament_stages_delete_editor ON public.tournament_stages FOR DELETE TO authenticated USING (public.can_edit_content());

-- tournament_groups
DROP POLICY IF EXISTS players_insert_admin_only ON public.tournament_groups;
DROP POLICY IF EXISTS players_update_admin_only ON public.tournament_groups;
DROP POLICY IF EXISTS players_delete_admin_only ON public.tournament_groups;
CREATE POLICY tournament_groups_insert_editor ON public.tournament_groups FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY tournament_groups_update_editor ON public.tournament_groups FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY tournament_groups_delete_editor ON public.tournament_groups FOR DELETE TO authenticated USING (public.can_edit_content());

-- tournament_teams
DROP POLICY IF EXISTS players_insert_admin_only ON public.tournament_teams;
DROP POLICY IF EXISTS players_update_admin_only ON public.tournament_teams;
DROP POLICY IF EXISTS players_delete_admin_only ON public.tournament_teams;
CREATE POLICY tournament_teams_insert_editor ON public.tournament_teams FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY tournament_teams_update_editor ON public.tournament_teams FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY tournament_teams_delete_editor ON public.tournament_teams FOR DELETE TO authenticated USING (public.can_edit_content());

-- stage_slots
DROP POLICY IF EXISTS players_insert_admin_only ON public.stage_slots;
DROP POLICY IF EXISTS players_update_admin_only ON public.stage_slots;
DROP POLICY IF EXISTS players_delete_admin_only ON public.stage_slots;
CREATE POLICY stage_slots_insert_editor ON public.stage_slots FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY stage_slots_update_editor ON public.stage_slots FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY stage_slots_delete_editor ON public.stage_slots FOR DELETE TO authenticated USING (public.can_edit_content());

-- intake_mappings
DROP POLICY IF EXISTS players_insert_admin_only ON public.intake_mappings;
DROP POLICY IF EXISTS players_update_admin_only ON public.intake_mappings;
DROP POLICY IF EXISTS players_delete_admin_only ON public.intake_mappings;
CREATE POLICY intake_mappings_insert_editor ON public.intake_mappings FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY intake_mappings_update_editor ON public.intake_mappings FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY intake_mappings_delete_editor ON public.intake_mappings FOR DELETE TO authenticated USING (public.can_edit_content());

-- stage_standings
DROP POLICY IF EXISTS players_insert_admin_only ON public.stage_standings;
DROP POLICY IF EXISTS players_update_admin_only ON public.stage_standings;
DROP POLICY IF EXISTS players_delete_admin_only ON public.stage_standings;
CREATE POLICY stage_standings_insert_editor ON public.stage_standings FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY stage_standings_update_editor ON public.stage_standings FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY stage_standings_delete_editor ON public.stage_standings FOR DELETE TO authenticated USING (public.can_edit_content());

-- --- articles ---------------------------------------------------------------
-- The "players_insert_admin_only" FOR ALL policy gated ALL writes. Replace with
-- granular editor policies. (The public "Public articles are viewable by
-- everyone" SELECT policy is left untouched.)
DROP POLICY IF EXISTS players_insert_admin_only ON public.articles;
CREATE POLICY articles_insert_editor ON public.articles FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY articles_update_editor ON public.articles FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY articles_delete_editor ON public.articles FOR DELETE TO authenticated USING (public.can_edit_content());
-- Editors/admins can SELECT drafts too (public policy already covers published):
CREATE POLICY articles_select_editor ON public.articles FOR SELECT TO authenticated USING (public.can_edit_content());

-- --- announcements ----------------------------------------------------------
DROP POLICY IF EXISTS announcements_insert_admin_only ON public.announcements;
DROP POLICY IF EXISTS announcements_update_admin_only ON public.announcements;
DROP POLICY IF EXISTS announcements_delete_admin_only ON public.announcements;
CREATE POLICY announcements_insert_editor ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY announcements_update_editor ON public.announcements FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY announcements_delete_editor ON public.announcements FOR DELETE TO authenticated USING (public.can_edit_content());

-- --- posts ------------------------------------------------------------------
DROP POLICY IF EXISTS "admin can insert posts" ON public.posts;
DROP POLICY IF EXISTS "admin can update posts" ON public.posts;
DROP POLICY IF EXISTS "admin can delete posts" ON public.posts;
CREATE POLICY posts_insert_editor ON public.posts FOR INSERT TO authenticated WITH CHECK (public.can_edit_content());
CREATE POLICY posts_update_editor ON public.posts FOR UPDATE TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY posts_delete_editor ON public.posts FOR DELETE TO authenticated USING (public.can_edit_content());

COMMIT;

-- ============================================================================
-- VERIFY (run after committing): every in-scope table should now show
-- *_editor policies and NO *_admin_only policy. This should return rows, none
-- of which contain 'admin_only' in the policyname.
-- ============================================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('matches','match_player_stats','match_participants',
--     'player_statistics','tournament_awards','tournaments','tournament_stages',
--     'tournament_groups','tournament_teams','stage_slots','intake_mappings',
--     'stage_standings','articles','announcements','posts')
-- ORDER BY tablename, cmd;
