-- =====================================================
-- Migration: Verify and Fix Articles Schema
-- Description: Ensures all required columns exist for articles
-- Date: 2026-01-08
-- =====================================================

-- Add featured_image column if it doesn't exist
-- (should already exist from original migration, but this ensures it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'featured_image'
  ) THEN
    ALTER TABLE articles ADD COLUMN featured_image TEXT;
    RAISE NOTICE 'Added missing featured_image column to articles table';
  ELSE
    RAISE NOTICE 'featured_image column already exists';
  END IF;
END $$;

-- Verify all required columns exist
DO $$
DECLARE
  missing_columns TEXT[];
BEGIN
  SELECT ARRAY_AGG(col)
  INTO missing_columns
  FROM (
    SELECT unnest(ARRAY['id', 'title', 'slug', 'content', 'excerpt', 'featured_image',
                        'status', 'author_id', 'published_at', 'created_at', 'updated_at']) AS col
  ) expected
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = expected.col
  );

  IF missing_columns IS NOT NULL THEN
    RAISE WARNING 'Missing columns in articles table: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE 'All required columns exist in articles table ✓';
  END IF;
END $$;

-- Display current schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;
