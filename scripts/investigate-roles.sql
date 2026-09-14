-- ============================================================================
-- investigate-roles.sql — READ-ONLY. Paste into the Supabase SQL editor and
-- run section by section (or all at once; every statement is a SELECT).
-- Nothing here changes data. Purpose: see exactly what each role can do in
-- the database TODAY, before new admins are added, and compare it with what
-- the repo's migrations say (migrations/add-editor-role-rls.sql,
-- migrations/enable-public-read-rls.sql). The companion code-side matrix is
-- docs/roles-and-permissions.md.
--
-- What "good" looks like is noted per section. Anything that disagrees with
-- the note is worth a look.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. WHO holds a role right now (admin / editor live in app_metadata.roles)
--    Good: only people you expect; no stale accounts; last_sign_in recent.
-- ────────────────────────────────────────────────────────────────────────────
SELECT id,
       email,
       raw_app_meta_data -> 'roles'              AS roles,
       created_at,
       last_sign_in_at,
       email_confirmed_at IS NOT NULL            AS email_confirmed,
       banned_until,
       (SELECT string_agg(provider, ',') FROM auth.identities i WHERE i.user_id = u.id) AS providers
FROM auth.users u
WHERE jsonb_array_length(COALESCE(raw_app_meta_data -> 'roles', '[]'::jsonb)) > 0
ORDER BY created_at;

-- 1b. Everybody else (accounts with NO role). They can log in but every
--     write path checks roles, so they should be harmless — this is just
--     the size of the sign-up surface. Good: small; no surprises.
SELECT count(*) AS accounts_without_role,
       min(created_at) AS oldest,
       max(created_at) AS newest
FROM auth.users
WHERE jsonb_array_length(COALESCE(raw_app_meta_data -> 'roles', '[]'::jsonb)) = 0;

SELECT email, created_at, last_sign_in_at
FROM auth.users
WHERE jsonb_array_length(COALESCE(raw_app_meta_data -> 'roles', '[]'::jsonb)) = 0
ORDER BY created_at DESC
LIMIT 20;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Row Level Security status per table.
--    Good: rls_enabled = true on EVERY table in public. A table with RLS off
--    is fully readable AND writable with the anon key (see §4 for grants).
-- ────────────────────────────────────────────────────────────────────────────
SELECT c.relname                       AS table_name,
       c.relrowsecurity                AS rls_enabled,
       c.relforcerowsecurity           AS rls_forced_for_owner,
       s.n_live_tup                    AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Every policy, in full. Compare with the two RLS migrations in the repo.
--    Good: SELECT policies = the public/staff split in enable-public-read-rls;
--          write policies = can_edit_content() (admin OR editor) on the match
--          cluster + content, and NOTHING on teams / player / player_teams /
--          seasons / audit_log (those are service-role only).
--    Any policy name you don't recognise from the migrations was created by
--    hand in the dashboard — read its qual/with_check carefully.
-- ────────────────────────────────────────────────────────────────────────────
SELECT tablename,
       policyname,
       cmd,
       roles,
       permissive,
       qual        AS using_expr,
       with_check  AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- 3b. Tables that have RLS on but NO policy at all for a given command:
--     these are locked (nobody but the service role can do that command).
--     Good: writes on teams / player / player_teams / seasons appear here.
WITH tables AS (
  SELECT c.relname AS t
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
), cmds AS (SELECT unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS cmd)
SELECT t.t AS table_name, c.cmd AS locked_command
FROM tables t CROSS JOIN cmds c
WHERE NOT EXISTS (
  SELECT 1 FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = t.t AND (p.cmd = c.cmd OR p.cmd = 'ALL')
)
ORDER BY 1, 2;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Table privileges granted to the API roles. Supabase grants ALL to
--    anon/authenticated by default and relies on RLS. This shows whether any
--    table was additionally REVOKED (belt and braces) — informational.
-- ────────────────────────────────────────────────────────────────────────────
SELECT table_name,
       grantee,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY 1, 2
ORDER BY 1, 2;

-- 4b. THE list that matters: tables anon can touch with no RLS in the way.
--     Good: EMPTY.
SELECT g.table_name, string_agg(g.privilege_type, ',' ORDER BY g.privilege_type) AS anon_privileges
FROM information_schema.role_table_grants g
JOIN pg_class c ON c.relname = g.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE g.table_schema = 'public' AND g.grantee = 'anon' AND c.relkind = 'r' AND NOT c.relrowsecurity
GROUP BY 1
ORDER BY 1;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Functions exposed through the API: who may EXECUTE them, and whether
--    they run as their owner (SECURITY DEFINER = bypasses RLS inside).
--    Good: the writing functions (replace_stage_standings, alloc_stage_slot,
--    flip_active_season, set_active_season, create_tournament,
--    update_match_awards) are NOT executable by anon; can_edit_content is
--    fine for everyone (it only reads the caller's JWT).
-- ────────────────────────────────────────────────────────────────────────────
SELECT p.proname                                              AS function_name,
       pg_get_function_identity_arguments(p.oid)              AS args,
       p.prosecdef                                            AS security_definer,
       pg_get_userbyid(p.proowner)                            AS owner,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_exec,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 5b. Full source of the functions the app calls that are NOT in the repo's
--     migrations folder — read what they actually do (create_tournament and
--     update_match_awards write; test_admin_role is a leftover debug call
--     made from the browser in MatchesDashboard.tsx).
SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_tournament', 'update_match_awards', 'search_teams_fuzzy',
                    'test_admin_role', 'can_edit_content')
ORDER BY p.proname;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Existing triggers (before add-audit-log.sql there should be few/none
--    besides updated_at helpers). After the migration: audit_row_change on
--    18 tables + audit_auth_user_change on auth.users.
-- ────────────────────────────────────────────────────────────────────────────
SELECT event_object_schema AS schema,
       event_object_table  AS table_name,
       trigger_name,
       string_agg(event_manipulation, ',' ORDER BY event_manipulation) AS events,
       action_timing,
       action_statement
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'auth')
GROUP BY 1, 2, 3, 5, 6
ORDER BY 1, 2, 3;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Views. A view without security_invoker reads its base tables as the
--    view OWNER (postgres) — i.e. it bypasses RLS. Fine for public data
--    (standings) but worth knowing. Good: only v_tournament_standings, and it
--    exposes nothing that isn't public anyway.
-- ────────────────────────────────────────────────────────────────────────────
SELECT c.relname AS view_name,
       pg_get_userbyid(c.relowner) AS owner,
       COALESCE(array_to_string(c.reloptions, ','), '') AS options,   -- look for security_invoker=true
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
ORDER BY 1;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. The dead tables from the 2026-08-24 audit. add-audit-log.sql drops
--    audit_logs only if it is still empty; users/posts are untouched.
-- ────────────────────────────────────────────────────────────────────────────
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND relname IN ('audit_logs', 'users', 'posts', 'audit_log')
ORDER BY 1;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('audit_logs', 'users', 'posts')
ORDER BY table_name, ordinal_position;


-- ────────────────────────────────────────────────────────────────────────────
-- 9. What Supabase ALREADY records for you: the built-in auth audit
--    (logins, token refreshes, user updates by the admin API, sign-ups).
--    This is the "who logged in when" half of the story; it does NOT record
--    data changes — that is what add-audit-log.sql adds.
-- ────────────────────────────────────────────────────────────────────────────
SELECT created_at,
       payload ->> 'action'                    AS action,
       payload ->> 'actor_username'            AS actor,
       payload -> 'traits' ->> 'user_email'    AS target_user,
       payload -> 'traits' ->> 'provider'      AS provider,
       ip_address
FROM auth.audit_log_entries
ORDER BY created_at DESC
LIMIT 40;

-- 9b. Admin-API user updates in the last 90 days (role toggles show up here
--     as 'user_modified' by actor 'service_role' — without saying WHICH role;
--     the new audit_log records the before/after).
SELECT created_at, payload ->> 'action' AS action, payload ->> 'actor_username' AS actor,
       payload -> 'traits' ->> 'user_email' AS target_user
FROM auth.audit_log_entries
WHERE payload ->> 'action' IN ('user_modified', 'user_deleted', 'user_signedup', 'user_invited')
  AND created_at > now() - interval '90 days'
ORDER BY created_at DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- 10. Storage. Uploads/deletes in the app go through the service role, so
--     buckets should be private with NO permissive object policies for anon.
--     Good: public = false except a deliberately public assets bucket; the
--     storage.objects policies (if any) are read-only or absent.
-- ────────────────────────────────────────────────────────────────────────────
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
ORDER BY name;

SELECT policyname, cmd, roles, qual AS using_expr, with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY cmd, policyname;


-- ────────────────────────────────────────────────────────────────────────────
-- 11. Quick "what can an EDITOR write directly through PostgREST?" list —
--     every table whose write policies pass for the editor role. The UI only
--     shows editors Articles + Announcements, but this is the real boundary
--     if they use the anon key + their own session outside the app.
-- ────────────────────────────────────────────────────────────────────────────
SELECT tablename,
       string_agg(DISTINCT cmd, ',' ORDER BY cmd) AS editor_writable_commands
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND (COALESCE(qual, '') ILIKE '%can_edit_content%' OR COALESCE(with_check, '') ILIKE '%can_edit_content%'
       OR COALESCE(qual, '') ILIKE '%editor%'          OR COALESCE(with_check, '') ILIKE '%editor%')
GROUP BY tablename
ORDER BY tablename;
