-- =====================================================
-- Migration: Create Articles Table
-- Description: Creates articles table for blog/news content
--              Extended from announcements with additional fields
--              for proper article management
-- Date: 2025-12-31
-- =====================================================

-- Step 1: Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,

  -- Content fields
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT DEFAULT NULL,
  slug TEXT DEFAULT NULL,

  -- Publishing fields
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  published_at TIMESTAMPTZ DEFAULT NULL,
  start_at TIMESTAMPTZ DEFAULT NULL,
  end_at TIMESTAMPTZ DEFAULT NULL,

  -- Organization fields
  category TEXT DEFAULT NULL,
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  pinned BOOLEAN DEFAULT FALSE,

  -- Media fields
  featured_image TEXT DEFAULT NULL,

  -- Author & tracking
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  view_count INTEGER DEFAULT 0,

  -- Metadata
  format TEXT DEFAULT 'md' CHECK (format IN ('md', 'html', 'plain')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_status
  ON articles(status);

CREATE INDEX IF NOT EXISTS idx_articles_published_at
  ON articles(published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_articles_slug
  ON articles(slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_category
  ON articles(category) WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_author
  ON articles(author_id) WHERE author_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_pinned_priority
  ON articles(pinned DESC, priority DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_tags
  ON articles USING GIN(tags);

-- Step 3: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at_trigger
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

-- Step 4: Add comments for documentation
COMMENT ON TABLE articles IS 'Articles/blog posts for the website';
COMMENT ON COLUMN articles.title IS 'Article title';
COMMENT ON COLUMN articles.content IS 'Full article content (supports Markdown, HTML, or plain text)';
COMMENT ON COLUMN articles.excerpt IS 'Short description/summary for article listings';
COMMENT ON COLUMN articles.slug IS 'URL-friendly identifier (e.g., "new-tournament-rules")';
COMMENT ON COLUMN articles.status IS 'Publication status: draft, published, scheduled, or archived';
COMMENT ON COLUMN articles.published_at IS 'When the article was published (NULL for drafts)';
COMMENT ON COLUMN articles.start_at IS 'Optional: when to start showing the article';
COMMENT ON COLUMN articles.end_at IS 'Optional: when to stop showing the article';
COMMENT ON COLUMN articles.category IS 'Article category (e.g., "Rules", "News", "Tournaments")';
COMMENT ON COLUMN articles.tags IS 'Array of tags for filtering and organization';
COMMENT ON COLUMN articles.priority IS 'Higher numbers appear first (for featured articles)';
COMMENT ON COLUMN articles.pinned IS 'Whether the article is pinned to the top';
COMMENT ON COLUMN articles.featured_image IS 'URL to the article featured/cover image';
COMMENT ON COLUMN articles.author_id IS 'User who created the article';
COMMENT ON COLUMN articles.view_count IS 'Number of times the article has been viewed';
COMMENT ON COLUMN articles.format IS 'Content format: md (Markdown), html, or plain text';

-- Step 5: Optionally migrate existing announcements to articles
-- (Uncomment if you want to copy announcements to articles)
-- INSERT INTO articles (
--   title,
--   content,
--   status,
--   published_at,
--   start_at,
--   end_at,
--   priority,
--   pinned,
--   format,
--   created_at,
--   updated_at
-- )
-- SELECT
--   title,
--   COALESCE(body, content, ''),
--   status,
--   CASE WHEN status = 'published' THEN COALESCE(start_at, created_at) ELSE NULL END,
--   start_at,
--   end_at,
--   COALESCE(priority, 0),
--   COALESCE(pinned, FALSE),
--   COALESCE(format, 'md'),
--   created_at,
--   updated_at
-- FROM announcements;

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

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'articles';
