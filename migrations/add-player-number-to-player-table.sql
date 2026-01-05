-- Migration: Add player_number column to player table
-- Description: Adds a permanent player number field (jersey/shirt number) to the player table
-- This is different from match-specific player numbers in match_player_stats
-- Run this in your Supabase SQL Editor

-- Add player_number column to player table (nullable integer)
ALTER TABLE player
ADD COLUMN IF NOT EXISTS player_number INT;

-- Optional: Add a comment to describe the column
COMMENT ON COLUMN player.player_number IS 'Player permanent jersey/shirt number (not unique, can be shared by multiple players)';

-- Optional: Add an index for better query performance when filtering by player number
CREATE INDEX IF NOT EXISTS idx_player_number ON player(player_number);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'player' AND column_name = 'player_number';
