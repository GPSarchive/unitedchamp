-- ============================================================================
-- editor-referee-notes-rls.sql — editors may read + write referee notes
--
-- add-match-referee-notes.sql made public.match_referee_notes ADMIN-ONLY.
-- Editors now get the same access as admins: they see and edit the
-- "Σημειώσεις διαιτητή" box in the /matches/[id] stats editor and open the
-- full list on /dashboard/match-notes.
--
-- This replaces the four *_admin_* policies with *_editor ones using the
-- admin-OR-editor test — the same predicate as public.can_edit_content()
-- (add-editor-role-rls.sql), written inline so this file has no dependency
-- on that migration having been run. Anon still has no policy at all: the
-- public key can neither read nor write the notes.
--
-- RUN THIS BEFORE DEPLOYING the matching app change. With the new code but
-- the old policies, an editor sees an empty note box and "Save all" fails on
-- the note write (RLS rejects the upsert), aborting the whole save.
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
-- Rollback: re-run add-match-referee-notes.sql (its step 3 recreates the
-- admin-only policies), then DROP the four *_editor policies below.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS match_referee_notes_admin_select  ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_admin_insert  ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_admin_update  ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_admin_delete  ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_editor_select ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_editor_insert ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_editor_update ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_editor_delete ON public.match_referee_notes;

CREATE POLICY match_referee_notes_editor_select ON public.match_referee_notes
  FOR SELECT TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin','editor'], false));
CREATE POLICY match_referee_notes_editor_insert ON public.match_referee_notes
  FOR INSERT TO authenticated
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin','editor'], false));
CREATE POLICY match_referee_notes_editor_update ON public.match_referee_notes
  FOR UPDATE TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin','editor'], false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin','editor'], false));
CREATE POLICY match_referee_notes_editor_delete ON public.match_referee_notes
  FOR DELETE TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin','editor'], false));

COMMENT ON TABLE public.match_referee_notes IS
  'Internal referee notes, one per match. Admins + editors (RLS). Written from the /matches/[id] stats editor, listed on /dashboard/match-notes.';

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (run after the migration)
-- =====================================================

-- Expect exactly 4 rows, all *_editor, roles = {authenticated}, and no *_admin_* left.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'match_referee_notes'
ORDER BY policyname;

-- RLS still on (expect relrowsecurity = true)
SELECT relname, relrowsecurity FROM pg_class WHERE oid = 'public.match_referee_notes'::regclass;
