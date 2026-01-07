-- =====================================================
-- Migration: Add Articles Table
-- Description: Adds table for blog/article content management
--              with support for rich content, SEO, and publishing workflow
-- Date: 2026-01-07
-- =====================================================

-- Step 1: Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content JSONB NOT NULL,
  excerpt TEXT,
  featured_image TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_slug
  ON articles(slug);

CREATE INDEX IF NOT EXISTS idx_articles_status
  ON articles(status);

CREATE INDEX IF NOT EXISTS idx_articles_author
  ON articles(author_id);

CREATE INDEX IF NOT EXISTS idx_articles_published_at
  ON articles(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_created_at
  ON articles(created_at DESC);

-- Step 3: Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger for auto-updating updated_at
CREATE TRIGGER trigger_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

-- Step 5: Add comments for documentation
COMMENT ON TABLE articles IS 'Blog articles and content pages with rich text editing';
COMMENT ON COLUMN articles.slug IS 'URL-friendly unique identifier for article';
COMMENT ON COLUMN articles.content IS 'Rich content stored as TipTap JSON format';
COMMENT ON COLUMN articles.excerpt IS 'Short description/summary for SEO and previews';
COMMENT ON COLUMN articles.featured_image IS 'Path to featured image in Supabase Storage';
COMMENT ON COLUMN articles.status IS 'Publication status: draft, published, or archived';
COMMENT ON COLUMN articles.author_id IS 'User who created the article';
COMMENT ON COLUMN articles.published_at IS 'Timestamp when article was first published';

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify migration)
-- =====================================================

-- Check if table was created successfully
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'articles';

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'articles';
