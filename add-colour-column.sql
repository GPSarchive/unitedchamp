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

-- ============================================================
-- UPDATE RPC FUNCTION: search_teams_fuzzy
-- ============================================================
-- If you have a search_teams_fuzzy RPC function, update it to include the colour field
-- Example update (modify according to your actual function):

/*
CREATE OR REPLACE FUNCTION search_teams_fuzzy(
  search_term TEXT,
  page_limit INT DEFAULT 16,
  page_offset INT DEFAULT 0
)
RETURNS TABLE (
  id INT,
  name TEXT,
  logo TEXT,
  colour TEXT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.logo,
    t.colour,
    COUNT(*) OVER() AS total_count
  FROM teams t
  WHERE t.name ILIKE '%' || search_term || '%'
    AND t.deleted_at IS NULL
  ORDER BY t.name ASC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;
*/
