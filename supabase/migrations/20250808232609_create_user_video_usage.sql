-- Create user_video_usage table for tracking Pro user video generation limits based on billing cycles
CREATE TABLE user_video_usage (
  user_id TEXT PRIMARY KEY, -- RevenueCat originalAppUserId  
  back_to_life_count INTEGER DEFAULT 0,
  plan_type TEXT DEFAULT 'monthly', -- 'weekly' or 'monthly'
  usage_limit INTEGER DEFAULT 10, -- 2 for weekly, 10 for monthly
  billing_cycle_start TEXT, -- ISO date when current billing cycle started
  next_reset_date TEXT, -- ISO date when usage will reset next
  original_purchase_date TEXT, -- ISO date of original subscription purchase
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_user_video_usage_user_id ON user_video_usage(user_id);
CREATE INDEX idx_user_video_usage_next_reset ON user_video_usage(next_reset_date);
CREATE INDEX idx_user_video_usage_plan_type ON user_video_usage(plan_type);

-- Enable Row Level Security (RLS)
ALTER TABLE user_video_usage ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since we're using anon key)
-- In production, you might want more restrictive policies
CREATE POLICY "Allow all operations on user_video_usage" ON user_video_usage
FOR ALL USING (true) WITH CHECK (true);