-- Migration: Pre-computed player stats cache tables
-- Eliminates expensive JS aggregation on the /paiktes page by storing
-- pre-computed career and tournament-scoped stats.
-- These tables are refreshed after every match finish/revert.

-- 1. Player career stats (all-time aggregates)
CREATE TABLE IF NOT EXISTS player_career_stats (
  player_id         INT PRIMARY KEY REFERENCES player(id) ON DELETE CASCADE,
  total_matches     INT NOT NULL DEFAULT 0,
  total_goals       INT NOT NULL DEFAULT 0,
  total_assists     INT NOT NULL DEFAULT 0,
  total_yellow_cards INT NOT NULL DEFAULT 0,
  total_red_cards   INT NOT NULL DEFAULT 0,
  total_blue_cards  INT NOT NULL DEFAULT 0,
  total_mvp         INT NOT NULL DEFAULT 0,
  total_best_gk     INT NOT NULL DEFAULT 0,
  total_wins        INT NOT NULL DEFAULT 0,
  primary_team_id   INT REFERENCES teams(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sort-by-stat queries on the players page
CREATE INDEX IF NOT EXISTS idx_pcs_goals    ON player_career_stats(total_goals DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_matches  ON player_career_stats(total_matches DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_assists  ON player_career_stats(total_assists DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_mvp      ON player_career_stats(total_mvp DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_best_gk  ON player_career_stats(total_best_gk DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_wins     ON player_career_stats(total_wins DESC);

-- 2. Player tournament stats (per-tournament aggregates)
CREATE TABLE IF NOT EXISTS player_tournament_stats (
  player_id      INT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  tournament_id  INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  matches        INT NOT NULL DEFAULT 0,
  goals          INT NOT NULL DEFAULT 0,
  assists        INT NOT NULL DEFAULT 0,
  yellow_cards   INT NOT NULL DEFAULT 0,
  red_cards      INT NOT NULL DEFAULT 0,
  blue_cards     INT NOT NULL DEFAULT 0,
  mvp_count      INT NOT NULL DEFAULT 0,
  best_gk_count  INT NOT NULL DEFAULT 0,
  wins           INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_pts_tournament       ON player_tournament_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_pts_tournament_goals  ON player_tournament_stats(tournament_id, goals DESC);
CREATE INDEX IF NOT EXISTS idx_pts_tournament_assists ON player_tournament_stats(tournament_id, assists DESC);
