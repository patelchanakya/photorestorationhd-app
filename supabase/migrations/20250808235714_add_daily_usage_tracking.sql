-- Add daily usage tracking for Pro users (1 video per day limit)
-- This allows weekly Pro = 7 videos, monthly Pro = 31 videos

ALTER TABLE user_video_usage 
ADD COLUMN last_video_date DATE;

-- Add index for efficient daily usage queries
CREATE INDEX idx_user_video_usage_last_video_date ON user_video_usage(last_video_date);

-- Add comment explaining the new model
COMMENT ON COLUMN user_video_usage.last_video_date IS 'Date of last Back to Life video generation (for daily limit enforcement)';
COMMENT ON COLUMN user_video_usage.back_to_life_count IS 'Total videos used in current billing cycle (resets with subscription cycle)';
COMMENT ON COLUMN user_video_usage.usage_limit IS '7 for weekly Pro, 31 for monthly Pro (1 video per day)';