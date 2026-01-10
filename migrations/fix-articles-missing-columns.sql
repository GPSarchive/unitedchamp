-- Fix missing columns in articles table
-- Run this if the articles table is missing featured_image or view_count

-- Add featured_image if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'featured_image'
  ) THEN
    ALTER TABLE articles ADD COLUMN featured_image TEXT;
    COMMENT ON COLUMN articles.featured_image IS 'Path to featured image in Supabase Storage';
  END IF;
END $$;

-- Add view_count if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'view_count'
  ) THEN
    ALTER TABLE articles ADD COLUMN view_count INTEGER DEFAULT 0 NOT NULL CHECK (view_count >= 0);
    COMMENT ON COLUMN articles.view_count IS 'Number of times article has been viewed';

    -- Create index for view count
    CREATE INDEX IF NOT EXISTS idx_articles_view_count ON articles(view_count DESC);
  END IF;
END $$;

-- Create the increment function if it doesn't exist
CREATE OR REPLACE FUNCTION increment_article_view_count(article_slug TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE articles
  SET view_count = view_count + 1
  WHERE slug = article_slug AND status = 'published'
  RETURNING view_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'articles'
AND column_name IN ('featured_image', 'view_count')
ORDER BY column_name;
