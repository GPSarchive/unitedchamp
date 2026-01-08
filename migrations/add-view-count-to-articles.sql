-- =====================================================
-- Migration: Add View Count to Articles
-- Description: Adds view tracking and optimizes article queries
-- Date: 2026-01-08
-- =====================================================

-- Step 1: Add view_count column with constraint
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL
CHECK (view_count >= 0);

-- Step 2: Update existing articles to have 0 views
UPDATE articles
SET view_count = 0
WHERE view_count IS NULL;

-- Step 3: Create indexes for optimal query performance

-- Index for sorting by popularity (most viewed articles)
CREATE INDEX IF NOT EXISTS idx_articles_view_count
ON articles(view_count DESC);

-- Composite index for related articles and navigation queries
-- This optimizes: WHERE status = 'published' AND published_at < X ORDER BY published_at DESC
CREATE INDEX IF NOT EXISTS idx_articles_status_published_at
ON articles(status, published_at DESC)
WHERE status = 'published';

-- Step 4: Create function to atomically increment view count
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

-- Step 5: Add comments for documentation
COMMENT ON COLUMN articles.view_count IS 'Number of times article has been viewed (increments on each page load)';

-- =====================================================
-- VERIFICATION QUERIES (Optional - run to verify)
-- =====================================================

-- Check if view_count column was added
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'articles' AND column_name = 'view_count';

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'articles' AND indexname LIKE '%view%';

-- Test the function
-- SELECT increment_article_view_count('test-article-slug');
