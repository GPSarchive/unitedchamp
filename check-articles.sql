-- Diagnostic script to check articles table

-- 1. Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;

-- 2. Check all articles and their status
SELECT id, title, slug, status, published_at, created_at
FROM articles
ORDER BY created_at DESC;

-- 3. Count articles by status
SELECT status, COUNT(*) as count
FROM articles
GROUP BY status
ORDER BY count DESC;

-- 4. Show articles that might not be displaying
SELECT
  id,
  title,
  slug,
  status,
  published_at,
  CASE
    WHEN status != 'published' THEN 'Status is not "published"'
    WHEN published_at IS NULL THEN 'published_at is NULL'
    ELSE 'Should be visible'
  END as issue
FROM articles
ORDER BY created_at DESC;
