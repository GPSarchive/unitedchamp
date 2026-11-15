-- ============================================================================
-- add-player-card-skins.sql — special card skins handed out by staff
--
-- /dashboard/protathlites («Πρωταθλητές») gives players a special card skin
-- as a reward: «Θρύλος» first, more skins later. Staff give a skin to a whole
-- team at once or to single players; nothing is given automatically.
--
-- One row = one player holds one skin. The row also keeps how the player's
-- photo is framed on that skin's card (x, y, zoom — see
-- src/app/preview/special-cards/framing.tsx), so every card can be adjusted
-- by hand, and which team's logo the card wears.
--
-- `skin` is free text checked by the app against its skin list
-- (src/app/dashboard/protathlites/skins.ts), so adding a skin needs no
-- migration.
--
-- RLS: admins only, for reads and writes; no anon policy at all. The app
-- writes through the service role after checking the admin role itself.
-- When public pages start showing the skins they read them server-side,
-- like every other public read since lock-anon-reads.sql.
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
-- Order: independent of the other pending migrations. If add-audit-log.sql
-- has been run, step 4 attaches the audit trigger; if not, step 4 is a no-op.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Table. `id` is the PK (audit_row_change() keys audit rows by `id`);
--    (player_id, skin) is UNIQUE so the app can upsert on it. Deleting a
--    player deletes their skins; deleting a team only clears the logo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_card_skins (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id        integer NOT NULL REFERENCES public.player(id) ON DELETE CASCADE,
  skin             text NOT NULL CHECK (skin ~ '^[a-z0-9_-]{1,40}$'),
  team_id          integer REFERENCES public.teams(id) ON DELETE SET NULL,
  frame_x          real NOT NULL DEFAULT 50 CHECK (frame_x BETWEEN 0 AND 100),
  frame_y          real NOT NULL DEFAULT 0  CHECK (frame_y BETWEEN 0 AND 100),
  frame_zoom       real NOT NULL DEFAULT 1  CHECK (frame_zoom BETWEEN 1 AND 3),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by_email text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by_email text,
  CONSTRAINT player_card_skins_player_skin_key UNIQUE (player_id, skin)
);

COMMENT ON TABLE public.player_card_skins IS
  'Special card skins given by staff (one row per player per skin) and the photo framing of that card. Admin-only (RLS). Managed on /dashboard/protathlites.';
COMMENT ON COLUMN public.player_card_skins.skin IS
  'Skin key from src/app/dashboard/protathlites/skins.ts, e.g. ''legend''.';
COMMENT ON COLUMN public.player_card_skins.team_id IS
  'Team whose logo the card wears: the team the skin was given through, or the player''s team at the time.';
COMMENT ON COLUMN public.player_card_skins.frame_x IS
  'Photo focus point, percent of the hidden overflow (50 = centred).';
COMMENT ON COLUMN public.player_card_skins.frame_y IS
  'Photo focus point, percent of the hidden overflow (0 = top).';
COMMENT ON COLUMN public.player_card_skins.frame_zoom IS
  'Photo zoom, 1 (fills the box, as the normal card) to 3.';

-- The dashboard lists one skin's holders at a time.
CREATE INDEX IF NOT EXISTS idx_player_card_skins_skin
  ON public.player_card_skins (skin);

-- ---------------------------------------------------------------------------
-- 2) updated_at — kept by trigger so no writer can forget it. created_at is
--    frozen after insert. The *_by_email columns are written by the app (it
--    writes with the service role, so there is no JWT to read them from).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.player_card_skins_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
    NEW.created_by_email := OLD.created_by_email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS player_card_skins_touch ON public.player_card_skins;
CREATE TRIGGER player_card_skins_touch
  BEFORE INSERT OR UPDATE ON public.player_card_skins
  FOR EACH ROW EXECUTE FUNCTION public.player_card_skins_touch();

-- ---------------------------------------------------------------------------
-- 3) RLS: admins only. No anon policy, so the public key can neither read
--    nor write. Same admin test as audit_log_admin_read.
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_card_skins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_card_skins_admin_select ON public.player_card_skins;
DROP POLICY IF EXISTS player_card_skins_admin_insert ON public.player_card_skins;
DROP POLICY IF EXISTS player_card_skins_admin_update ON public.player_card_skins;
DROP POLICY IF EXISTS player_card_skins_admin_delete ON public.player_card_skins;

CREATE POLICY player_card_skins_admin_select ON public.player_card_skins
  FOR SELECT TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));
CREATE POLICY player_card_skins_admin_insert ON public.player_card_skins
  FOR INSERT TO authenticated
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));
CREATE POLICY player_card_skins_admin_update ON public.player_card_skins
  FOR UPDATE TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));
CREATE POLICY player_card_skins_admin_delete ON public.player_card_skins
  FOR DELETE TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));

-- ---------------------------------------------------------------------------
-- 4) Audit trail — only if add-audit-log.sql has been applied. updated_at
--    is ignored in UPDATE diffs so only real changes are logged.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.audit_row_change()') IS NULL THEN
    RAISE NOTICE 'audit: public.audit_row_change() not found — trigger not attached (run add-audit-log.sql, then re-run this file)';
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS audit_row_change ON public.player_card_skins;
  CREATE TRIGGER audit_row_change
    AFTER INSERT OR UPDATE OR DELETE ON public.player_card_skins
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('updated_at,updated_by_email');
END $$;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (run after the migration)
-- =====================================================

-- Columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'player_card_skins'
ORDER BY ordinal_position;

-- RLS on + the four admin policies (expect rowsecurity = true, 4 policies)
SELECT relname, relrowsecurity FROM pg_class WHERE oid = 'public.player_card_skins'::regclass;
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'player_card_skins'
ORDER BY policyname;

-- Triggers (expect player_card_skins_touch, plus audit_row_change if the audit log is installed)
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.player_card_skins'::regclass AND NOT tgisinternal;
