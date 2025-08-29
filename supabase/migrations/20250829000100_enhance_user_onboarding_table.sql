-- Enhance user_onboarding table with additional tracking columns
ALTER TABLE user_onboarding 
ADD COLUMN IF NOT EXISTS onboarding_version TEXT DEFAULT 'v3',
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completion_status TEXT DEFAULT 'partial' CHECK (completion_status IN ('completed', 'abandoned', 'partial')),
ADD COLUMN IF NOT EXISTS drop_off_step TEXT,
ADD COLUMN IF NOT EXISTS time_to_complete_seconds INTEGER,
ADD COLUMN IF NOT EXISTS permissions_granted JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_prompt TEXT,
ADD COLUMN IF NOT EXISTS referral_source TEXT,
ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS experiment_variant TEXT,
ADD COLUMN IF NOT EXISTS experiment_id TEXT,
ADD COLUMN IF NOT EXISTS session_id UUID;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completion_status ON user_onboarding(completion_status);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_onboarding_version ON user_onboarding(onboarding_version);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_experiment_variant ON user_onboarding(experiment_variant);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_session_id ON user_onboarding(session_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completed_at ON user_onboarding(completed_at);

-- Update the existing trigger function to handle completion timestamp
CREATE OR REPLACE FUNCTION update_user_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Auto-set completed_at when completion_status changes to 'completed'
  IF OLD.completion_status != 'completed' AND NEW.completion_status = 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  
  -- Calculate time_to_complete if completed and not already set
  IF NEW.completion_status = 'completed' AND NEW.time_to_complete_seconds IS NULL THEN
    NEW.time_to_complete_seconds = EXTRACT(EPOCH FROM (NOW() - NEW.created_at))::INTEGER;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add function to mark onboarding as completed
CREATE OR REPLACE FUNCTION complete_user_onboarding(
  p_user_id TEXT,
  p_completion_status TEXT DEFAULT 'completed'
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_onboarding 
  SET 
    completion_status = p_completion_status,
    completed_at = CASE WHEN p_completion_status = 'completed' THEN NOW() ELSE completed_at END,
    time_to_complete_seconds = CASE 
      WHEN p_completion_status = 'completed' AND time_to_complete_seconds IS NULL 
      THEN EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER
      ELSE time_to_complete_seconds 
    END,
    updated_at = NOW()
  WHERE id = (
    SELECT id 
    FROM user_onboarding 
    WHERE user_id = p_user_id 
    ORDER BY created_at DESC 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;