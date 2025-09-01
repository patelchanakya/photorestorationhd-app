-- Create user_onboarding table for tracking onboarding selections and analytics
CREATE TABLE IF NOT EXISTS user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  selected_features TEXT[] NOT NULL,
  primary_interest TEXT NOT NULL,
  free_attempt_used BOOLEAN DEFAULT FALSE,
  free_attempt_feature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON user_onboarding(user_id);

-- Create index on created_at for analytics queries
CREATE INDEX IF NOT EXISTS idx_user_onboarding_created_at ON user_onboarding(created_at);

-- Create index on primary_interest for feature popularity analytics
CREATE INDEX IF NOT EXISTS idx_user_onboarding_primary_interest ON user_onboarding(primary_interest);

-- Enable RLS (Row Level Security)
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (no auth required for analytics)
-- This follows the same pattern as other tables in the app
CREATE POLICY "Allow all operations on user_onboarding" ON user_onboarding
  FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_user_onboarding_updated_at
  BEFORE UPDATE ON user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_user_onboarding_updated_at();