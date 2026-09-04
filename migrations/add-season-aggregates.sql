-- ============================================================================
-- add-season-aggregates.sql  (Seasonal system, Phase 0 / step 2 — schema only)
-- Run once in the Supabase SQL editor AFTER add-seasons.sql. Idempotent.
-- Source of truth: plans/seasonal-data-contract.md (approved 2026-09-04).
--
-- Creates the season-keyed STORED result tables. Every public page (active
-- season included) reads these with a plain SELECT; engines write them when
-- data changes (active season) or on explicit close / re-snapshot (archived).
--
--   1) player_season_stats       — per player per season (replaces the career
--                                  concept; columns = player_tournament_stats
--                                  + primary_team_id).
--                                  NOTE: an empty, unused table with this exact
--                                  name already exists in prod (verified 0 rows,
--                                  2026-08-24 and 2026-09-04). It is dropped and
--                                  recreated here.
--   2) season_team_standings     — stored Γενική Κατάταξη per season, incl. the
--                                  per-team points log (events jsonb) and the
--                                  owner-required extras (GF/GA, clean sheets,
--                                  longest win streak).
--   3) season_recaps             — the recap-modal payload, computed once at
--                                  close / re-snapshot (archive hub content).
--   4) team_season_score_archive — one-time dump of teams.season_score before
--                                  that column is dropped in Phase 7.
--
-- RLS: all four are staff_read (public.can_edit_content(), deployed by
-- add-editor-role-rls.sql) with NO write policies — public pages read through
-- the service role, exactly like player_career_stats today.
-- ============================================================================

BEGIN;

-- 1) player_season_stats ------------------------------------------------------
DROP TABLE IF EXISTS public.player_season_stats;   -- dead 0-row table, name reused

CREATE TABLE public.player_season_stats (
  player_id        int  NOT NULL REFERENCES public.player (id) ON DELETE CASCADE,
  season_label     text NOT NULL REFERENCES public.seasons (label),
  matches          int  NOT NULL DEFAULT 0,
  goals            int  NOT NULL DEFAULT 0,
  assists          int  NOT NULL DEFAULT 0,
  yellow_cards     int  NOT NULL DEFAULT 0,
  red_cards        int  NOT NULL DEFAULT 0,
  blue_cards       int  NOT NULL DEFAULT 0,
  mvp_count        int  NOT NULL DEFAULT 0,
  best_gk_count    int  NOT NULL DEFAULT 0,
  wins             int  NOT NULL DEFAULT 0,
  primary_team_id  int  REFERENCES public.teams (id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, season_label)
);

-- Sort-by-stat indexes, scoped by season (mirrors idx_pcs_* on player_career_stats).
CREATE INDEX IF NOT EXISTS idx_pss_season          ON public.player_season_stats (season_label);
CREATE INDEX IF NOT EXISTS idx_pss_season_goals    ON public.player_season_stats (season_label, goals DESC);
CREATE INDEX IF NOT EXISTS idx_pss_season_matches  ON public.player_season_stats (season_label, matches DESC);
CREATE INDEX IF NOT EXISTS idx_pss_season_assists  ON public.player_season_stats (season_label, assists DESC);
CREATE INDEX IF NOT EXISTS idx_pss_season_mvp      ON public.player_season_stats (season_label, mvp_count DESC);
CREATE INDEX IF NOT EXISTS idx_pss_season_best_gk  ON public.player_season_stats (season_label, best_gk_count DESC);
CREATE INDEX IF NOT EXISTS idx_pss_season_wins     ON public.player_season_stats (season_label, wins DESC);
CREATE INDEX IF NOT EXISTS idx_pss_primary_team    ON public.player_season_stats (primary_team_id);

-- 2) season_team_standings ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_team_standings (
  season_label        text   NOT NULL REFERENCES public.seasons (label),
  team_id             bigint NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  rank                int    NOT NULL,
  points              int    NOT NULL DEFAULT 0,
  -- Γενική Κατάταξη line (TeamSeasonLine in src/app/geniki-katataxi/points.ts)
  participations      int    NOT NULL DEFAULT 0,
  qualifications      int    NOT NULL DEFAULT 0,
  titles              int    NOT NULL DEFAULT 0,
  runner_ups          int    NOT NULL DEFAULT 0,
  wins                int    NOT NULL DEFAULT 0,
  draws               int    NOT NULL DEFAULT 0,
  losses              int    NOT NULL DEFAULT 0,
  adjustment_points   int    NOT NULL DEFAULT 0,
  adjustment_count    int    NOT NULL DEFAULT 0,
  -- Owner-required extras (contract §6), from the season's finished matches
  matches_played      int    NOT NULL DEFAULT 0,
  goals_for           int    NOT NULL DEFAULT 0,
  goals_against       int    NOT NULL DEFAULT 0,
  clean_sheets        int    NOT NULL DEFAULT 0,
  longest_win_streak  int    NOT NULL DEFAULT 0,
  -- Per-team points log: PointsEvent[] (src/app/geniki-katataxi/rules.ts),
  -- including the per-match MatchDetail breakdown the expandable log shows.
  events              jsonb  NOT NULL DEFAULT '[]'::jsonb,
  refreshed_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_label, team_id)
);

CREATE INDEX IF NOT EXISTS idx_sts_season_rank ON public.season_team_standings (season_label, rank);
CREATE INDEX IF NOT EXISTS idx_sts_team        ON public.season_team_standings (team_id);

-- 3) season_recaps ------------------------------------------------------------
-- payload = SeasonRecap from src/app/home/seasonRecap.ts (totals, podium,
-- honours, awards, records) + a `months` key (matches per month).
CREATE TABLE IF NOT EXISTS public.season_recaps (
  season_label  text  PRIMARY KEY REFERENCES public.seasons (label),
  payload       jsonb NOT NULL,
  generated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4) team_season_score_archive ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_season_score_archive (
  team_id      bigint PRIMARY KEY REFERENCES public.teams (id) ON DELETE CASCADE,
  score        int    NOT NULL,
  archived_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS ---------------------------------------------------------------------------
ALTER TABLE public.player_season_stats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_team_standings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_recaps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_season_score_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_read ON public.player_season_stats;
DROP POLICY IF EXISTS staff_read ON public.season_team_standings;
DROP POLICY IF EXISTS staff_read ON public.season_recaps;
DROP POLICY IF EXISTS staff_read ON public.team_season_score_archive;

CREATE POLICY staff_read ON public.player_season_stats       FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.season_team_standings     FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.season_recaps             FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.team_season_score_archive FOR SELECT USING (public.can_edit_content());
-- No INSERT/UPDATE/DELETE policies: service role only.

COMMIT;

-- Verify:
--   select count(*) from public.player_season_stats;        -- 0 until Phase 1 backfill
--   select count(*) from public.season_team_standings;      -- 0 until Phase 2 backfill
--   node scripts/audit-rls.mjs                              -- anon reads 0 rows, writes blocked
