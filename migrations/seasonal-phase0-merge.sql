-- ============================================================================
-- seasonal-phase0-merge.sql  (Seasonal system, Phase 0 / step 3 — THE MERGE)
-- Run ONCE in the Supabase SQL editor, AFTER add-seasons.sql and
-- add-season-aggregates.sql. Re-runnable (every statement is a no-op the
-- second time), but treat it as one-shot: it stamps live data.
-- Source of truth: plans/seasonal-data-contract.md §3 (approved 2026-09-04).
--
-- What it does (D2 + D5):
--   * creates the single merged season '2025-2026' as the ACTIVE season
--   * stamps EVERY tournament, adjustment and team (all 62, soft-deleted
--     included — 15 of the 17 deleted teams played real matches) '2025-2026'
--   * adds the FKs that make season labels validated from now on
--   * archives the 6 hand-typed teams.season_score values (column stays until
--     Phase 7)
-- What it does NOT do: delete anything, touch matches/stats/rosters, or flip
-- tournaments.status.
--
-- Pre-flight result on 2026-09-04 (read-only, service role): all 8 tournaments
-- and all 51 adjustments ALREADY carry '2025-2026'; match dates span
-- 2025-10-14 → 2026-07-20 (one Sep-30 season). So the two UPDATE ... SET season
-- statements below overwrite nothing. Re-run section A anyway and KEEP the
-- output — it is the record of whatever is there on the day you run this.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) PRE-FLIGHT (read-only). Run this ONE query first, on its own, and save the
--    grid it returns. (One query, because the SQL editor only shows the last
--    statement's result.)
-- ---------------------------------------------------------------------------
-- select 'tournaments by season' as check_name, coalesce(season, '<null>') as key, count(*)::text as value
--   from public.tournaments group by season
-- union all
-- select 'adjustments by season', coalesce(season, '<null>'), count(*)::text
--   from public.season_team_adjustments group by season
-- union all
-- select 'teams', 'live', count(*) filter (where deleted_at is null)::text from public.teams
-- union all
-- select 'teams', 'deleted', count(*) filter (where deleted_at is not null)::text from public.teams
-- union all
-- select 'teams', 'already stamped', count(*) filter (where season_label is not null)::text from public.teams
-- union all
-- select 'season_score', name, season_score::text from public.teams where coalesce(season_score, 0) <> 0
-- union all
-- select 'seasons', label, status from public.seasons
-- union all
-- select 'player_season_stats (dead)', 'rows', count(*)::text from public.player_season_stats
-- order by 1, 2;
--
-- Take a Supabase backup (Dashboard → Database → Backups) before section B.

-- ---------------------------------------------------------------------------
-- B) THE MERGE
-- ---------------------------------------------------------------------------
BEGIN;

-- B1) The merged season, active.
INSERT INTO public.seasons (label, display_label, status, started_on)
VALUES ('2025-2026', '2025/26', 'active', '2025-09-30')
ON CONFLICT (label) DO NOTHING;

-- B2) Stamp everything (D2). ALL rows, regardless of current text.
UPDATE public.tournaments             SET season = '2025-2026' WHERE season IS DISTINCT FROM '2025-2026';
UPDATE public.season_team_adjustments SET season = '2025-2026' WHERE season IS DISTINCT FROM '2025-2026';

-- B3) Stamp ALL teams, soft-deleted included (D5). deleted_at keeps meaning
--     "hidden on live pages"; in the archive they are teams of this season.
UPDATE public.teams SET season_label = '2025-2026' WHERE season_label IS NULL;

-- B4) Validate labels from now on.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_season_fkey') THEN
    ALTER TABLE public.tournaments
      ADD CONSTRAINT tournaments_season_fkey
      FOREIGN KEY (season) REFERENCES public.seasons (label);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'season_team_adjustments_season_fkey') THEN
    ALTER TABLE public.season_team_adjustments
      ADD CONSTRAINT season_team_adjustments_season_fkey
      FOREIGN KEY (season) REFERENCES public.seasons (label);
  END IF;
END $$;

ALTER TABLE public.teams ALTER COLUMN season_label SET NOT NULL;

-- B5) Archive the hand-typed season_score values (column itself dropped in Phase 7).
INSERT INTO public.team_season_score_archive (team_id, score)
SELECT id, season_score FROM public.teams
WHERE coalesce(season_score, 0) <> 0
ON CONFLICT (team_id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- C) VERIFY — one query; every row must show ok = true.
-- ---------------------------------------------------------------------------
-- select 'exactly one active season' as check_name,
--        (select count(*) from public.seasons where status = 'active') = 1 as ok
-- union all
-- select 'all tournaments 2025-2026',
--        (select count(*) from public.tournaments where season is distinct from '2025-2026') = 0
-- union all
-- select 'all adjustments 2025-2026',
--        (select count(*) from public.season_team_adjustments where season is distinct from '2025-2026') = 0
-- union all
-- select 'all teams stamped',
--        (select count(*) from public.teams where season_label is distinct from '2025-2026') = 0
-- union all
-- select 'season_score archived (6 as of 2026-09-04)',
--        (select count(*) from public.team_season_score_archive) = (select count(*) from public.teams where coalesce(season_score,0) <> 0)
-- union all
-- select 'FKs present',
--        (select count(*) from pg_constraint where conname in ('tournaments_season_fkey','season_team_adjustments_season_fkey')) = 2
-- union all
-- select 'new tables empty',
--        (select count(*) from public.player_season_stats) + (select count(*) from public.season_team_standings) = 0;
--
-- Then: node scripts/audit-rls.mjs  → anon reads 0 rows from the 4 staff tables.
--
-- Nothing on the site changes behaviour after this file: no code reads the new
-- tables or columns yet. Rolling back = leaving them in place, unused.
