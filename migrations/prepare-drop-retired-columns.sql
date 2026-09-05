-- ============================================================================
-- prepare-drop-retired-columns.sql  (Seasonal system, Phase 7 / step 0)
-- Run in the Supabase SQL editor BEFORE deploying the Phase 6 code. Idempotent.
--
-- The Phase 6 code no longer writes teams.season_score. If that column is
-- NOT NULL without a default, team creation would fail between the deploy and
-- the drop — so relax it first. Harmless if it is already nullable.
-- ============================================================================
ALTER TABLE public.teams ALTER COLUMN season_score DROP NOT NULL;
ALTER TABLE public.teams ALTER COLUMN season_score SET DEFAULT 0;
