-- Re-scope teams.name / teams.am uniqueness from GLOBAL to PER SEASON.
--
-- The seasonal contract (plans/seasonal-data-contract.md, D1 = A) makes a NEW
-- team row for every season, so the same club name/AM must be able to exist
-- once per season. The pre-seasonal schema (base DDL not in this repo — see
-- docs/inventory/data-model.md gap #10) made teams.name and teams.am unique
-- across ALL rows, which broke every create path after the first season flip:
-- "Δημιουργία από παλιά ομάδα" re-uses the old row's name by design, and
-- manual creates collide with archived-season (even soft-deleted) rows. The
-- API reported each such 23505 as "AM must be unique" regardless of the
-- constraint that actually fired.
--
-- Soft-deleted rows STAY inside the uniqueness scope: per D5 a deleted team
-- is still a team of its season, and excluding them would let a restore
-- produce two live rows with one name.
--
-- Safe to run any time: the old GLOBAL uniqueness is strictly stronger than
-- per-season uniqueness, so no existing rows can violate the new indexes.

-- 1) Drop the global single-column unique CONSTRAINTS on name / am, whatever
--    they are named (the base DDL was made in the Supabase dashboard; the
--    typical auto-names are teams_name_key / teams_am_key, but don't assume).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.teams'::regclass
      AND c.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
             FROM unnest(c.conkey) AS k(attnum)
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
          IN (ARRAY['name'], ARRAY['am'])
  LOOP
    EXECUTE format('ALTER TABLE public.teams DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 1b) Also drop plain unique INDEXES on (name) or (am) that are not backed by
--     a constraint (dashboard-created uniqueness sometimes takes this form).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT i.indexrelid::regclass AS idx
    FROM pg_index i
    WHERE i.indrelid = 'public.teams'::regclass
      AND i.indisunique AND NOT i.indisprimary
      AND i.indnkeyatts = 1
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
      AND (SELECT a.attname::text FROM pg_attribute a
             WHERE a.attrelid = i.indrelid AND a.attnum = i.indkey[0]) IN ('name', 'am')
  LOOP
    EXECUTE format('DROP INDEX %s', r.idx);
  END LOOP;
END $$;

-- 2) Per-season uniqueness. AM stays optional: the partial index guards only
--    non-null AMs — the same NULL behaviour the old plain UNIQUE had (NULLs
--    distinct), just cheaper. season_label is NOT NULL since the phase-0 merge.
CREATE UNIQUE INDEX IF NOT EXISTS teams_season_name_uniq
  ON public.teams (season_label, name);

CREATE UNIQUE INDEX IF NOT EXISTS teams_season_am_uniq
  ON public.teams (season_label, am)
  WHERE am IS NOT NULL;

-- =====================
-- VERIFICATION QUERIES
-- =====================
-- Unique indexes now on teams (expect teams_pkey + the two new ones, nothing
-- single-column on name/am):
--
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'teams'
--   AND indexdef ILIKE '%unique%';
--
-- Smoke test from /dashboard/teams (as admin):
--   * "Δημιουργία από παλιά ομάδα" on a 2025-2026 row now creates the
--     active-season copy.
--   * Creating the same team twice in the active season still fails, and the
--     API now names the conflicting field (name vs AM).
