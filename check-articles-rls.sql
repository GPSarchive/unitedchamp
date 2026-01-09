-- Check and fix Row Level Security (RLS) for articles table
-- This allows public read access to published articles

-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'articles';

-- Show existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'articles';

-- Enable RLS on articles table (if not already enabled)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public articles are viewable by everyone" ON articles;

-- Create policy to allow public read access to published articles
CREATE POLICY "Public articles are viewable by everyone"
ON articles
FOR SELECT
USING (status = 'published');

-- Verify the policy was created
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'articles';
