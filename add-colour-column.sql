-- Migration: Add colour column to teams table
-- Run this in your Supabase SQL Editor

-- Add colour column to teams table (nullable, hex color string)
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS colour TEXT;

-- Optional: Add a check constraint to ensure valid hex color format (#RRGGBB)
ALTER TABLE teams
ADD CONSTRAINT IF NOT EXISTS valid_hex_colour
CHECK (colour IS NULL OR colour ~ '^#[0-9A-Fa-f]{6}$');

-- Optional: Add a comment to describe the column
COMMENT ON COLUMN teams.colour IS 'Team primary colour extracted from logo (hex format: #RRGGBB)';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'teams' AND column_name = 'colour';
