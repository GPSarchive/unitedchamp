-- ============================================================================
-- add-audit-log.sql  — admin audit trail (run once in the Supabase SQL editor;
-- idempotent, safe to re-run). Deploy TOGETHER with the code on feat/audit-log
-- (src/app/lib/audit/*, proxy.ts): the code inserts app-level events into the
-- table created here and stamps the headers the trigger reads.
--
-- What it records — see docs/audit-log.md for the full picture:
--
--   source='db'   EVERY insert/update/delete on the source-of-truth tables
--                 listed in §5, captured by a row trigger in the same
--                 transaction as the write. Regardless of the code path: API
--                 route, server action, service-role engine, SQL editor,
--                 Supabase Studio, a script with the service key.
--                 Updates that change nothing material (only updated_at /
--                 view_count) are NOT logged.
--   source='app'  One row per admin ACTION written by the app
--                 (logAdminAction): season close, bulk save, storage delete,
--                 role change, cache rebuild …
--   auth.users    Role / email / ban changes (§6) — the backstop for changes
--                 made directly in Supabase Studio.
--
-- Who did it (actor_id / actor_email):
--   * writes through the cookie-bound client carry the user's JWT → auth.uid()
--   * writes through the service role carry x-audit-actor headers stamped by
--     proxy.ts and forwarded by lib/audit/fetch.ts. The trigger trusts those
--     headers ONLY when the request's JWT role is service_role, i.e. only our
--     server can assert an actor.
--   * anything else (SQL editor = postgres, GoTrue = supabase_auth_admin) is
--     recorded with actor NULL and the db_role that did it — which is exactly
--     the "someone edited the data outside the app" signal.
--
-- The log is append-only: UPDATE/DELETE/TRUNCATE are revoked from the app
-- roles and a guard trigger refuses row mutations unless the owner runs
--     SET audit.allow_prune = 'on';   -- then DELETE FROM public.audit_log WHERE at < now() - interval '2 years';
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) The table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),
  source       text NOT NULL CHECK (source IN ('db', 'app')),
  -- 'INSERT' | 'UPDATE' | 'DELETE' for source='db'; a dotted verb for 'app'
  op           text NOT NULL,
  table_name   text,          -- e.g. 'matches', 'auth.users'; NULL for some app events
  record_id    text,          -- primary key as text (id, or label for seasons)
  actor_id     uuid,          -- auth.users.id of the admin/editor, when known
  actor_email  text,
  db_role      text,          -- service_role | authenticated | postgres | supabase_auth_admin …
  request_id   text,          -- groups all rows one HTTP request produced
  route        text,          -- 'POST /api/tournaments/12/save-all'
  summary      text,          -- app events: the human line shown in the dashboard
  old_row      jsonb,
  new_row      jsonb,
  changed      jsonb,         -- UPDATE only: { col: { from, to }, … } (ignored cols removed)
  meta         jsonb          -- app events: structured extras
);

COMMENT ON TABLE public.audit_log IS
  'Append-only admin audit trail. source=db rows come from audit_row_change() triggers; source=app rows from lib/audit/log.ts.';

CREATE INDEX IF NOT EXISTS idx_audit_log_at        ON public.audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record    ON public.audit_log (table_name, record_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor     ON public.audit_log (actor_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_request   ON public.audit_log (request_id);

-- ---------------------------------------------------------------------------
-- 2) Access: admins read (RLS), the app appends (service role), nobody edits.
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;      -- gated by the policy below

DROP POLICY IF EXISTS audit_log_admin_read ON public.audit_log;
CREATE POLICY audit_log_admin_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false));
-- No INSERT/UPDATE/DELETE policies: the cookie-bound client can never write here.

-- The service role bypasses RLS but not GRANTs: append-only for the app too.
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM service_role;
GRANT SELECT, INSERT ON public.audit_log TO service_role;

-- Guard against edits by the owner as well (SQL editor), unless pruning on purpose.
CREATE OR REPLACE FUNCTION public.audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('audit.allow_prune', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'public.audit_log is append-only (SET audit.allow_prune = ''on'' to prune deliberately)';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_append_only ON public.audit_log;
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();

-- ---------------------------------------------------------------------------
-- 3) Who is calling? Read once per row from the PostgREST request settings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_request_context()
RETURNS TABLE (actor_id uuid, actor_email text, db_role text, request_id text, route text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_claims jsonb;
  v_hdrs   jsonb;
BEGIN
  BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN v_claims := NULL;
  END;
  BEGIN
    v_hdrs := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN v_hdrs := NULL;
  END;

  -- Outside PostgREST (SQL editor, GoTrue, pg-meta) there are no claims:
  -- the session role names the writer instead (postgres, supabase_auth_admin …).
  db_role    := COALESCE(v_claims ->> 'role', current_user::text);
  request_id := NULLIF(v_hdrs ->> 'x-audit-request', '');
  route      := NULLIF(v_hdrs ->> 'x-audit-route', '');

  IF db_role = 'service_role' THEN
    -- Only our server holds the service key, so only it can assert an actor.
    BEGIN
      actor_id := NULLIF(v_hdrs ->> 'x-audit-actor', '')::uuid;
    EXCEPTION WHEN OTHERS THEN actor_id := NULL;
    END;
    actor_email := NULLIF(v_hdrs ->> 'x-audit-actor-email', '');
  ELSIF db_role = 'authenticated' THEN
    -- A user JWT identifies its own caller; headers are ignored on purpose.
    BEGIN
      actor_id := NULLIF(v_claims ->> 'sub', '')::uuid;
    EXCEPTION WHEN OTHERS THEN actor_id := NULL;
    END;
    actor_email := NULLIF(v_claims ->> 'email', '');
  END IF;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) The row trigger. SECURITY DEFINER (owner = postgres) so the insert into
--    audit_log succeeds no matter which role performed the write.
--    Argument 0: comma-separated columns to ignore in UPDATE diffs. An UPDATE
--    whose only differences are ignored columns is not logged at all.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ignored   text[] := CASE WHEN TG_NARGS > 0 THEN string_to_array(TG_ARGV[0], ',') ELSE '{}'::text[] END;
  v_old       jsonb;
  v_new       jsonb;
  v_changed   jsonb;
  v_record_id text;
  v_ctx       record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    SELECT jsonb_object_agg(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k))
      INTO v_changed
      FROM (SELECT DISTINCT jsonb_object_keys(v_old || v_new) AS k) ks
     WHERE (v_old -> k) IS DISTINCT FROM (v_new -> k)
       AND NOT (k = ANY (v_ignored));
    IF v_changed IS NULL THEN
      RETURN NULL;  -- nothing material changed (e.g. only updated_at / view_count)
    END IF;
  ELSE
    v_old := to_jsonb(OLD);
  END IF;

  v_record_id := COALESCE(v_new ->> 'id', v_old ->> 'id', v_new ->> 'label', v_old ->> 'label');

  SELECT * INTO v_ctx FROM public.audit_request_context();

  INSERT INTO public.audit_log
    (source, op, table_name, record_id, actor_id, actor_email, db_role, request_id, route, old_row, new_row, changed)
  VALUES
    ('db', TG_OP, TG_TABLE_NAME, v_record_id, v_ctx.actor_id, v_ctx.actor_email, v_ctx.db_role,
     v_ctx.request_id, v_ctx.route, v_old, v_new, v_changed);

  RETURN NULL;  -- AFTER trigger; the return value is ignored
END;
$$;

-- Only the trigger machinery needs these; keep them out of the API surface.
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_request_context() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_log_block_mutation() FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Attach the trigger to every source-of-truth table.
--    Derived caches (stage_standings, player_*_stats, season_team_standings,
--    season_recaps, team_season_score_archive) are deliberately NOT audited:
--    they are rebuilt wholesale from the tables below and would flood the log.
--    A table missing in this database is skipped with a NOTICE.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('matches',                 'updated_at'),
      ('match_player_stats',      'updated_at'),
      ('match_participants',      'updated_at'),
      ('tournament_awards',       'updated_at'),
      ('disciplinary_actions',    'updated_at'),
      ('tournaments',             'updated_at'),
      ('tournament_stages',       'updated_at'),
      ('tournament_groups',       'updated_at'),
      ('tournament_teams',        'updated_at'),
      ('stage_slots',             'updated_at'),   -- optimistic-lock column; team/source changes still logged
      ('intake_mappings',         'updated_at'),
      ('teams',                   'updated_at'),
      ('player',                  'updated_at'),
      ('player_teams',            'updated_at'),
      ('articles',                'updated_at,view_count'),  -- public page views bump view_count
      ('announcements',           'updated_at'),
      ('seasons',                 'updated_at'),
      ('season_team_adjustments', 'updated_at')
    ) AS v(tbl, ignored)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NULL THEN
      RAISE NOTICE 'audit: table public.% does not exist here — skipped', t.tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t.tbl);
    EXECUTE format(
      'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(%L)',
      t.tbl, t.ignored
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6) auth.users backstop: role grants/revokes, email changes, bans, account
--    creation/deletion — whether done by the app (GoTrue) or in Supabase
--    Studio. Fails OPEN: this trigger fires on every login (last_sign_in_at),
--    so an audit hiccup must never block authentication.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_auth_user_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_changed   jsonb := '{}'::jsonb;
  v_old       jsonb;
  v_new       jsonb;
  v_record_id text;
  v_ctx       record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.raw_app_meta_data -> 'roles') IS DISTINCT FROM (NEW.raw_app_meta_data -> 'roles') THEN
      v_changed := v_changed || jsonb_build_object('roles',
        jsonb_build_object('from', OLD.raw_app_meta_data -> 'roles', 'to', NEW.raw_app_meta_data -> 'roles'));
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      v_changed := v_changed || jsonb_build_object('email', jsonb_build_object('from', OLD.email, 'to', NEW.email));
    END IF;
    IF OLD.banned_until IS DISTINCT FROM NEW.banned_until THEN
      v_changed := v_changed || jsonb_build_object('banned_until',
        jsonb_build_object('from', OLD.banned_until, 'to', NEW.banned_until));
    END IF;
    IF v_changed = '{}'::jsonb THEN
      RETURN NULL;  -- a login, a token refresh, metadata noise: not interesting
    END IF;
  END IF;

  -- Branch on TG_OP, never on "OLD IS NOT NULL": for a composite that test is
  -- false whenever ANY column is null (banned_until usually is).
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := jsonb_build_object('email', OLD.email, 'roles', OLD.raw_app_meta_data -> 'roles', 'banned_until', OLD.banned_until);
    v_record_id := OLD.id::text;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := jsonb_build_object('email', NEW.email, 'roles', NEW.raw_app_meta_data -> 'roles', 'banned_until', NEW.banned_until);
    v_record_id := NEW.id::text;
  END IF;

  SELECT * INTO v_ctx FROM public.audit_request_context();

  INSERT INTO public.audit_log
    (source, op, table_name, record_id, actor_id, actor_email, db_role, request_id, route, old_row, new_row, changed)
  VALUES
    ('db', TG_OP, 'auth.users', v_record_id, v_ctx.actor_id, v_ctx.actor_email, v_ctx.db_role,
     v_ctx.request_id, v_ctx.route, v_old, v_new, NULLIF(v_changed, '{}'::jsonb));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'audit_auth_user_change failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_auth_user_change() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS audit_auth_user_change ON auth.users;
CREATE TRIGGER audit_auth_user_change
  AFTER INSERT OR UPDATE OR DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_auth_user_change();

COMMIT;

-- ---------------------------------------------------------------------------
-- 7) Retire the dead, empty `audit_logs` table (2026-08-24 audit: 0 rows, no
--    code) so the two names cannot be confused. Separate transaction: if it
--    unexpectedly has rows this aborts WITHOUT undoing the migration above —
--    look at the rows, then drop by hand.
-- ---------------------------------------------------------------------------
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.audit_logs') IS NULL THEN
    RAISE NOTICE 'audit: public.audit_logs already gone';
    RETURN;
  END IF;
  EXECUTE 'SELECT count(*) FROM public.audit_logs' INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'public.audit_logs has % rows — inspect them before dropping it', n;
  END IF;
  EXECUTE 'DROP TABLE public.audit_logs';
  RAISE NOTICE 'audit: dropped empty legacy table public.audit_logs';
END $$;

-- ============================================================================
-- VERIFY (run after committing; nothing below changes data)
-- ============================================================================
-- 1. Every audited table has the trigger:
-- SELECT event_object_table, count(*) FROM information_schema.triggers
--  WHERE trigger_name = 'audit_row_change' GROUP BY 1 ORDER BY 1;         -- expect 18 rows (fewer if a table is absent)
--
-- 2. auth.users trigger present:
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'audit_auth_user_change';
--
-- 3. The log is append-only for the app key (both must FAIL):
-- SET ROLE service_role; UPDATE public.audit_log SET summary = 'x' WHERE false; RESET ROLE;   -- permission denied
-- SET ROLE service_role; DELETE FROM public.audit_log WHERE false; RESET ROLE;                -- permission denied
--
-- 4. End-to-end dry run (rolled back, so nothing is kept):
-- BEGIN;
--   UPDATE public.announcements SET updated_at = now() WHERE id = (SELECT min(id) FROM public.announcements);
--   SELECT count(*) AS should_be_0 FROM public.audit_log WHERE table_name = 'announcements' AND at > now() - interval '1 minute';
--   UPDATE public.announcements SET title = title || ' ' WHERE id = (SELECT min(id) FROM public.announcements);
--   SELECT op, table_name, record_id, db_role, actor_id, changed
--     FROM public.audit_log WHERE table_name = 'announcements' ORDER BY id DESC LIMIT 1;  -- db_role = postgres, actor NULL, changed = {title: …}
-- ROLLBACK;
--
-- 5. From the app: save any match from the dashboard, then
-- SELECT at, op, table_name, record_id, actor_email, db_role, route, request_id
--   FROM public.audit_log ORDER BY id DESC LIMIT 20;   -- actor_email = your login, route = the API path
