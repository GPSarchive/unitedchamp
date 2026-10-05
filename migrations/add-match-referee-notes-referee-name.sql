-- ============================================================================
-- add-match-referee-notes-referee-name.sql — who the note is from
--
-- Adds a private referee name to each note. The stats editor pre-fills it with
-- the logged-in admin's email, and it can be edited. It stays on the
-- admin-only match_referee_notes table and is NOT the public matches.referee
-- shown on the match page.
--
-- Run AFTER add-match-referee-notes.sql. Idempotent: safe to re-run. The
-- existing RLS policies and audit trigger cover the new column automatically.
-- ============================================================================

BEGIN;

ALTER TABLE public.match_referee_notes
  ADD COLUMN IF NOT EXISTS referee_name text;

ALTER TABLE public.match_referee_notes
  DROP CONSTRAINT IF EXISTS match_referee_notes_referee_name_len;
ALTER TABLE public.match_referee_notes
  ADD CONSTRAINT match_referee_notes_referee_name_len
  CHECK (referee_name IS NULL OR char_length(referee_name) <= 120);

COMMENT ON COLUMN public.match_referee_notes.referee_name IS
  'Private: who the note is from. Pre-filled with the admin''s email in the stats editor. Not the public matches.referee.';

COMMIT;

-- Verify: expect one row, data_type = text
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'match_referee_notes' AND column_name = 'referee_name';
