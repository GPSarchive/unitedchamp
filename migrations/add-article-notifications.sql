-- =====================================================
-- Migration: Add Article Notifications
-- Description: Creates notifications when articles are published
-- Date: 2026-01-09
-- =====================================================

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read
  ON notifications(read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at DESC);

-- Create function to notify users about new articles
CREATE OR REPLACE FUNCTION notify_new_article()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Only create notifications when an article is published for the first time
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    -- Create a notification for all users
    FOR user_record IN SELECT id FROM auth.users WHERE id IS NOT NULL
    LOOP
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (
        user_record.id,
        'Νέο Άρθρο Διαθέσιμο',
        NEW.title,
        'info',
        '/article/' || NEW.slug
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for article notifications
DROP TRIGGER IF EXISTS trigger_notify_new_article ON articles;
CREATE TRIGGER trigger_notify_new_article
  AFTER INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_article();

-- Add comments
COMMENT ON TABLE notifications IS 'User notifications for various events';
COMMENT ON COLUMN notifications.type IS 'Notification type: info, success, warning, or error';
COMMENT ON COLUMN notifications.link IS 'Optional link to navigate when notification is clicked';
COMMENT ON COLUMN notifications.read IS 'Whether the user has read this notification';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if notifications table was created
SELECT table_name FROM information_schema.tables WHERE table_name = 'notifications';

-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'trigger_notify_new_article';
