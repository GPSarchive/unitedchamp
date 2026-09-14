-- ============================================================================
-- add-admin-role-guards.sql — the database refuses to lose its last admin.
-- Run once in the Supabase SQL editor (idempotent). Independent of
-- add-audit-log.sql; run both.
--
-- Who may make or unmake an admin:
--   * In the app, only an admin, only for OTHER accounts, and never the last
--     admin (src/app/api/admin/users/[id]/roles/route.ts → lib/roleChange.ts).
--     app_metadata is not writable by users themselves (Supabase only lets the
--     service role / admin API change it), so there is no self-service path.
--   * Outside the app (Supabase Studio, SQL editor, a script with the service
--     key) anything is possible — that is the owner's power. This trigger
--     repeats ONE rule there: the last admin cannot lose the role or be
--     deleted, because with zero admins nobody could ever grant it again from
--     the app. Every such change is recorded by add-audit-log.sql's
--     audit_auth_user_change trigger with db_role = postgres and no user.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auth_users_keep_one_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_others integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Fires on every login too (last_sign_in_at); only the role transition
    -- admin → not-admin does any work.
    IF COALESCE((OLD.raw_app_meta_data -> 'roles') ? 'admin', false)
       AND NOT COALESCE((NEW.raw_app_meta_data -> 'roles') ? 'admin', false) THEN
      SELECT count(*) INTO v_others
        FROM auth.users u
       WHERE u.id <> OLD.id
         AND COALESCE((u.raw_app_meta_data -> 'roles') ? 'admin', false);
      IF v_others = 0 THEN
        RAISE EXCEPTION 'refusing to remove the admin role from the last admin (%)', OLD.email
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE
  IF COALESCE((OLD.raw_app_meta_data -> 'roles') ? 'admin', false) THEN
    SELECT count(*) INTO v_others
      FROM auth.users u
     WHERE u.id <> OLD.id
       AND COALESCE((u.raw_app_meta_data -> 'roles') ? 'admin', false);
    IF v_others = 0 THEN
      RAISE EXCEPTION 'refusing to delete the last admin (%)', OLD.email
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auth_users_keep_one_admin() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS auth_users_keep_one_admin ON auth.users;
CREATE TRIGGER auth_users_keep_one_admin
  BEFORE UPDATE OR DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_users_keep_one_admin();

COMMIT;

-- ============================================================================
-- VERIFY (rolled back — nothing changes). Both statements must ERROR with
-- "refusing to ..." : the first strips admin from every admin, the second
-- deletes them. With two or more admins the error comes on the second row
-- (the trigger sees the rows already changed by the same statement).
-- ============================================================================
-- BEGIN;
--   UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'roles'
--    WHERE COALESCE((raw_app_meta_data -> 'roles') ? 'admin', false);
-- ROLLBACK;
-- BEGIN;
--   DELETE FROM auth.users WHERE COALESCE((raw_app_meta_data -> 'roles') ? 'admin', false);
-- ROLLBACK;
--
-- And this must still work (a login-style update that does not touch roles):
-- BEGIN;
--   UPDATE auth.users SET last_sign_in_at = now()
--    WHERE COALESCE((raw_app_meta_data -> 'roles') ? 'admin', false);
-- ROLLBACK;
