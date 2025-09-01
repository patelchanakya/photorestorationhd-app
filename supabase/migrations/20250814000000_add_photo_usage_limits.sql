-- Add photo usage tracking table and RPC functions for freemium model

-- Create user_photo_usage table
CREATE TABLE user_photo_usage (
  user_id TEXT PRIMARY KEY,           -- stable:{uuid} for free users
  photo_count INTEGER DEFAULT 0,      -- Photos used
  usage_limit INTEGER DEFAULT 5,      -- Always 5 for free users
  plan_type TEXT DEFAULT 'free',      -- Always 'free'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for fast lookups
CREATE INDEX idx_user_photo_usage_user_id ON user_photo_usage(user_id);

-- Create atomic RPC function for checking and incrementing photo usage
CREATE OR REPLACE FUNCTION check_and_increment_photo_usage(
  p_user_id TEXT,
  p_usage_limit INTEGER DEFAULT 5
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Get current usage (atomic read with row lock)
  SELECT photo_count INTO current_count 
  FROM user_photo_usage 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF current_count IS NULL THEN
    INSERT INTO user_photo_usage (user_id, photo_count, usage_limit)
    VALUES (p_user_id, 1, p_usage_limit);
    RETURN TRUE;
  END IF;
  
  -- Check limit
  IF current_count >= p_usage_limit THEN
    RETURN FALSE;
  END IF;
  
  -- Increment usage atomically
  UPDATE user_photo_usage 
  SET photo_count = photo_count + 1, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create rollback function for failed photo processing
CREATE OR REPLACE FUNCTION rollback_photo_usage(
  p_user_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_photo_usage 
  SET photo_count = GREATEST(photo_count - 1, 0), updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to get current photo usage
CREATE OR REPLACE FUNCTION get_photo_usage(
  p_user_id TEXT
) RETURNS TABLE(
  photo_count INTEGER,
  usage_limit INTEGER,
  plan_type TEXT,
  can_use BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(u.photo_count, 0) as photo_count,
    COALESCE(u.usage_limit, 5) as usage_limit,
    COALESCE(u.plan_type, 'free') as plan_type,
    COALESCE(u.photo_count, 0) < COALESCE(u.usage_limit, 5) as can_use
  FROM user_photo_usage u
  WHERE u.user_id = p_user_id
  UNION ALL
  SELECT 0, 5, 'free', TRUE
  WHERE NOT EXISTS (SELECT 1 FROM user_photo_usage WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;