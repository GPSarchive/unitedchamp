-- =====================================================
-- Migration: Add View Count to Articles
-- Description: Adds view_count column to track article views
-- Date: 2026-01-09
-- =====================================================

-- Add view_count column
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT 0 NOT NULL;

-- Create index for sorting by view count
CREATE INDEX IF NOT EXISTS idx_articles_view_count
  ON articles(view_count DESC);

-- Add comment for documentation
COMMENT ON COLUMN articles.view_count IS 'Number of times the article has been viewed';

-- Create function to increment article views
CREATE OR REPLACE FUNCTION increment_article_views(article_id BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE articles
  SET view_count = view_count + 1
  WHERE id = article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION increment_article_views(BIGINT) TO authenticated, anon;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'articles' AND column_name = 'view_count';
