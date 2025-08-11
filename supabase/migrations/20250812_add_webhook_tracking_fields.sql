-- Add webhook tracking fields for RevenueCat sync
-- These fields help maintain canonical user tracking and subscription state

ALTER TABLE user_video_usage 
ADD COLUMN is_active BOOLEAN DEFAULT true,
ADD COLUMN expires_date TIMESTAMPTZ;

-- Add index for active users
CREATE INDEX idx_user_video_usage_active ON user_video_usage(is_active) WHERE is_active = true;

-- Add comments explaining the webhook integration
COMMENT ON COLUMN user_video_usage.is_active IS 'Whether subscription is currently active (updated via RevenueCat webhooks)';
COMMENT ON COLUMN user_video_usage.expires_date IS 'Subscription expiration date from RevenueCat (for grace period handling)';
COMMENT ON COLUMN user_video_usage.user_id IS 'RevenueCat originalAppUserId (canonical ID that persists across reinstalls)';