-- ============================================================================
-- add-seasons.sql  (Seasonal system, Phase 0 / step 1 — schema only)
-- Run once in the Supabase SQL editor. Idempotent, safe to re-run.
-- Source of truth: plans/seasonal-data-contract.md (approved 2026-09-04).
--
-- Adds:
--   1) public.seasons            — the list of seasons and THE POINTER
--                                  (exactly one row may be status='active').
--   2) teams.season_label        — every team row belongs to one season (D1=A:
--                                  a club gets a NEW team row every season).
--   3) teams.copied_from_team_id — lineage: which previous-season row this
--                                  team was created from ("create from old team").
--
-- This file is purely additive. It does NOT stamp any data and does NOT add
-- the tournaments.season FK — both happen in seasonal-phase0-merge.sql after
-- the pre-flight there has been run and its output kept.
-- ============================================================================

BEGIN;

-- 1) seasons ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seasons (
  label          text PRIMARY KEY,                       -- storage key, e.g. '2025-2026' (D4)
  display_label  text NOT NULL,                          -- what the UI prints, e.g. '2025/26'
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'archived')),
  started_on     date,
  ended_on       date,
  archived_at    timestamptz,
  archived_by    uuid REFERENCES auth.users (id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Exactly one active season at a time. A concurrent double-close fails cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_one_active
  ON public.seasons ((true)) WHERE status = 'active';

-- 2) teams.season_label -----------------------------------------------------
-- Nullable here; the merge stamps all rows and then sets NOT NULL.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS season_label text REFERENCES public.seasons (label);

CREATE INDEX IF NOT EXISTS idx_teams_season ON public.teams (season_label);

-- 3) teams.copied_from_team_id (lineage) --------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS copied_from_team_id bigint REFERENCES public.teams (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_copied_from ON public.teams (copied_from_team_id);

-- RLS: seasons is public-read (labels are not sensitive and the archive hub
-- lists them); writes only via service role (no INSERT/UPDATE/DELETE policy).
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON public.seasons;
CREATE POLICY public_read ON public.seasons FOR SELECT USING (true);

COMMIT;

-- Verify:
--   select * from public.seasons;                                  -- 0 rows until the merge
--   select column_name from information_schema.columns
--     where table_name='teams' and column_name in ('season_label','copied_from_team_id');
