-- ============================================================================
-- add-match-referee-notes.sql — private referee notes per match
--
-- One optional free-text note per match, written from the stats editor on
-- /matches/[id] ("Σημειώσεις διαιτητή") and read on /dashboard/match-notes.
--
-- Why a separate table instead of a column on matches: matches is publicly
-- readable (enable-public-read-rls.sql), so any column there is visible to the
-- anon key. These notes are internal, so they live in their own table whose
-- RLS admits ADMINS ONLY, for reads and writes. Editors use the stats editor
-- too but never see or touch the notes (the app hides the field for them).
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
-- Order: independent of the other pending migrations. If add-audit-log.sql has
-- already been run, step 4 attaches the audit trigger; if not, step 4 is a
-- no-op — add ('match_referee_notes', 'updated_at,updated_by,updated_by_email')
-- to that file's trigger list, or simply re-run this file afterwards.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Table. `id` is the PK (audit_row_change() keys audit rows by `id`);
--    match_id is UNIQUE so the app can upsert on it. Deleting a match deletes
--    its note.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_referee_notes (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id         integer NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  note             text NOT NULL
                   CHECK (char_length(btrim(note)) BETWEEN 1 AND 2000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_email text
);

COMMENT ON TABLE public.match_referee_notes IS
  'Internal referee notes, one per match. Admin-only (RLS). Written from the /matches/[id] stats editor, listed on /dashboard/match-notes.';
COMMENT ON COLUMN public.match_referee_notes.updated_by_email IS
  'Email of the last editor, stamped by trigger from the JWT so the notes page needs no auth.users lookup.';

-- The notes page lists newest-edited first.
CREATE INDEX IF NOT EXISTS idx_match_referee_notes_updated_at
  ON public.match_referee_notes (updated_at DESC);

-- ---------------------------------------------------------------------------
-- 2) Authorship stamps — set server-side from the caller's JWT, never trusted
--    from the client. created_* are frozen after insert. SQL-editor writes
--    (no JWT) leave the *_by columns NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_referee_notes_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at       := now();
  NEW.updated_by       := auth.uid();
  NEW.updated_by_email := auth.jwt() ->> 'email';
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_referee_notes_stamp ON public.match_referee_notes;
CREATE TRIGGER match_referee_notes_stamp
  BEFORE INSERT OR UPDATE ON public.match_referee_notes
  FOR EACH ROW EXECUTE FUNCTION public.match_referee_notes_stamp();

-- ---------------------------------------------------------------------------
-- 3) RLS: admins only. No anon policy at all, so the public key can neither
--    read nor write. Same admin test as audit_log_admin_read.
-- ---------------------------------------------------------------------------
ALTER TABLE public.match_referee_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_referee_notes_admin_select ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_admin_insert ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_admin_update ON public.match_referee_notes;
DROP POLICY IF EXISTS match_referee_notes_admin_delete ON public.match_referee_notes;

CREATE POLICY match_referee_notes_admin_select ON public.match_referee_notes
  FOR SELECT TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));
CREATE POLICY match_referee_notes_admin_insert ON public.match_referee_notes
  FOR INSERT TO authenticated
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));
CREATE POLICY match_referee_notes_admin_update ON public.match_referee_notes
  FOR UPDATE TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));
CREATE POLICY match_referee_notes_admin_delete ON public.match_referee_notes
  FOR DELETE TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));

-- ---------------------------------------------------------------------------
-- 4) Audit trail — only if add-audit-log.sql has been applied. The stamp
--    columns are ignored in UPDATE diffs so only real note edits are logged.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.audit_row_change()') IS NULL THEN
    RAISE NOTICE 'audit: public.audit_row_change() not found — trigger not attached (run add-audit-log.sql, then re-run this file)';
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS audit_row_change ON public.match_referee_notes;
  CREATE TRIGGER audit_row_change
    AFTER INSERT OR UPDATE OR DELETE ON public.match_referee_notes
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('updated_at,updated_by,updated_by_email');
END $$;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (run after the migration)
-- =====================================================

-- Columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'match_referee_notes'
ORDER BY ordinal_position;

-- RLS on + the four admin policies (expect rowsecurity = true, 4 policies)
SELECT relname, relrowsecurity FROM pg_class WHERE oid = 'public.match_referee_notes'::regclass;
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'match_referee_notes'
ORDER BY policyname;

-- Triggers (expect match_referee_notes_stamp, plus audit_row_change if the audit log is installed)
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.match_referee_notes'::regclass AND NOT tgisinternal;
