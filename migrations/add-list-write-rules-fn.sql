-- migrations/add-list-write-rules-fn.sql
--
-- list_write_rules(): the catalog of database rules that can reject an admin
-- write — constraints, UNIQUE indexes and triggers on the tables the tournament
-- editor (save-all) and the matches dashboard write to.
--
-- Why: src/app/lib/dbErrors/describeDbError.ts turns each of these rules into a
-- Greek sentence for the admin. The list of rules is finite but lives in the
-- database (some, like unique_league_match_idx and ensure_match_teams_active,
-- were created directly in Supabase and are in no migration). This function
-- lets scripts/check-error-catalog.ts diff the live catalog against the
-- mapping, so a rule added later shows up as "unmapped" instead of silently
-- falling back to the generic message.
--
-- Read-only. Callable by the service role only (scripts with .env.local).
--
-- Run in Supabase → SQL Editor. Verify with:
--   select * from public.list_write_rules();

CREATE OR REPLACE FUNCTION public.list_write_rules()
RETURNS TABLE (kind text, table_name text, name text, definition text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH t(name) AS (
    VALUES ('matches'), ('tournament_teams'), ('tournament_stages'),
           ('tournament_groups'), ('tournaments'), ('stage_slots'), ('intake_mappings')
  )
  -- Table constraints: primary/unique/foreign/check/exclusion.
  SELECT 'constraint'::text, c.relname::text, con.conname::text, pg_get_constraintdef(con.oid)
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN t ON t.name = c.relname
  WHERE c.relnamespace = 'public'::regnamespace
  UNION ALL
  -- Only UNIQUE indexes can reject a write; plain indexes are left out.
  SELECT 'index', i.tablename::text, i.indexname::text, i.indexdef
  FROM pg_indexes i
  JOIN t ON t.name = i.tablename
  WHERE i.schemaname = 'public' AND i.indexdef ILIKE 'create unique index%'
  UNION ALL
  -- Triggers, with the function they run (that is where any RAISE text lives).
  SELECT 'trigger', c.relname::text, tg.tgname::text, pg_get_triggerdef(tg.oid)
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN t ON t.name = c.relname
  WHERE NOT tg.tgisinternal AND c.relnamespace = 'public'::regnamespace
  UNION ALL
  SELECT DISTINCT 'trigger_fn', c.relname::text, p.proname::text, pg_get_functiondef(p.oid)
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN pg_proc p ON p.oid = tg.tgfoid
  JOIN t ON t.name = c.relname
  WHERE NOT tg.tgisinternal AND c.relnamespace = 'public'::regnamespace
  ORDER BY 1, 2, 3;
$$;

COMMENT ON FUNCTION public.list_write_rules() IS
  'Catalog of constraints, unique indexes and triggers on the admin write tables; diffed against the dbErrors mapping by scripts/check-error-catalog.ts.';

REVOKE EXECUTE ON FUNCTION public.list_write_rules() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.list_write_rules() TO service_role;
