-- Migration: Add player_number column to match_player_stats table
-- Run this in your Supabase SQL Editor

-- Add player_number column to match_player_stats table (nullable integer)
ALTER TABLE match_player_stats
ADD COLUMN IF NOT EXISTS player_number INT;

-- Optional: Add a comment to describe the column
COMMENT ON COLUMN match_player_stats.player_number IS 'Player jersey/shirt number for the match';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'match_player_stats' AND column_name = 'player_number';
