-- Add missing columns to user_video_usage table for production sync
ALTER TABLE user_video_usage 
ADD COLUMN IF NOT EXISTS expires_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add index for active users
CREATE INDEX IF NOT EXISTS idx_user_video_usage_active ON user_video_usage (is_active) WHERE (is_active = true);