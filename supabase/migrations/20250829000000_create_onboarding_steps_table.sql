-- Create onboarding_steps table for detailed step-by-step tracking
CREATE TABLE IF NOT EXISTS onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id UUID NOT NULL,
  step_name TEXT NOT NULL, -- 'welcome', 'permissions', 'features', 'preview', 'community', 'setup'
  step_status TEXT NOT NULL CHECK (step_status IN ('viewed', 'completed', 'skipped', 'abandoned')),
  time_spent_seconds INTEGER DEFAULT 0,
  step_data JSONB, -- Additional context like selected features, permissions granted, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_user_id ON onboarding_steps(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_session_id ON onboarding_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_step_name ON onboarding_steps(step_name);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_created_at ON onboarding_steps(created_at);

-- Create composite index for funnel analysis
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_funnel ON onboarding_steps(user_id, session_id, step_name, created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (no auth required for analytics)
CREATE POLICY "Allow all operations on onboarding_steps" ON onboarding_steps
  FOR ALL USING (true);

-- Create function to generate session IDs for onboarding flows
CREATE OR REPLACE FUNCTION generate_onboarding_session()
RETURNS UUID AS $$
BEGIN
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;