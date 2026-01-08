-- Add view_count column to articles table
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL;

-- Create an index on view_count for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_articles_view_count ON articles(view_count DESC);

-- Update existing articles to have 0 views
UPDATE articles SET view_count = 0 WHERE view_count IS NULL;

-- Create a function to atomically increment view count
CREATE OR REPLACE FUNCTION increment_article_view_count(article_slug TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE articles
  SET view_count = view_count + 1
  WHERE slug = article_slug
  RETURNING view_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;
