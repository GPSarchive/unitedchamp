-- Fix article status from 'posted' to 'published'
-- This will make articles visible on the /articles page

-- Update any articles with status 'posted' to 'published'
UPDATE articles
SET status = 'published'
WHERE status = 'posted';

-- Show the updated articles
SELECT id, title, status, published_at
FROM articles
WHERE status = 'published'
ORDER BY created_at DESC;
