-- Migration: Add only atomic usage functions for multi-device protection
-- Created: 2025-08-12
-- Purpose: Prevent race conditions when multiple devices try to generate videos simultaneously

-- Function to atomically check and increment usage
-- Returns: true if increment succeeded, false if at limit or error
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id TEXT,
  p_plan_type TEXT DEFAULT 'weekly',
  p_usage_limit INTEGER DEFAULT 7,
  p_billing_cycle_start TIMESTAMPTZ DEFAULT NOW(),
  p_next_reset_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  p_original_purchase_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_usage INTEGER;
  today_date TEXT;
  can_use_today BOOLEAN;
  record_exists BOOLEAN;
BEGIN
  -- Get today's date in YYYY-MM-DD format
  today_date := TO_CHAR(NOW(), 'YYYY-MM-DD');
  
  -- Check if record exists
  SELECT EXISTS(
    SELECT 1 FROM user_video_usage WHERE user_id = p_user_id
  ) INTO record_exists;
  
  -- If no record exists, create it with count = 1
  IF NOT record_exists THEN
    INSERT INTO user_video_usage (
      user_id,
      back_to_life_count,
      plan_type,
      usage_limit,
      billing_cycle_start,
      next_reset_date,
      original_purchase_date,
      last_video_date,
      is_active,
      updated_at
    ) VALUES (
      p_user_id,
      1, -- Start with count = 1 (pre-increment)
      p_plan_type,
      p_usage_limit,
      p_billing_cycle_start,
      p_next_reset_date,
      p_original_purchase_date,
      today_date,
      true,
      NOW()
    );
    
    RETURN true;
  END IF;
  
  -- Get current usage and check daily limit
  SELECT 
    back_to_life_count,
    CASE 
      WHEN last_video_date IS NULL OR last_video_date != today_date THEN true
      ELSE false
    END
  INTO current_usage, can_use_today
  FROM user_video_usage 
  WHERE user_id = p_user_id;
  
  -- Check if user can generate video
  IF NOT can_use_today THEN
    RETURN false; -- Daily limit reached
  END IF;
  
  IF current_usage >= p_usage_limit THEN
    RETURN false; -- Monthly limit reached
  END IF;
  
  -- Atomically increment usage
  UPDATE user_video_usage 
  SET 
    back_to_life_count = back_to_life_count + 1,
    last_video_date = today_date,
    updated_at = NOW()
  WHERE 
    user_id = p_user_id 
    AND back_to_life_count < p_usage_limit -- Double-check to prevent race conditions
    AND (last_video_date IS NULL OR last_video_date != today_date);
  
  -- Return true if row was updated (increment succeeded)
  RETURN FOUND;
END;
$$;

-- Function to rollback usage increment on video generation failure
CREATE OR REPLACE FUNCTION rollback_usage(
  p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_date TEXT;
BEGIN
  -- Get today's date in YYYY-MM-DD format
  today_date := TO_CHAR(NOW(), 'YYYY-MM-DD');
  
  -- Only rollback if user used a video today (prevent invalid rollbacks)
  UPDATE user_video_usage 
  SET 
    back_to_life_count = GREATEST(0, back_to_life_count - 1),
    last_video_date = CASE 
      WHEN back_to_life_count <= 1 THEN NULL
      ELSE last_video_date
    END,
    updated_at = NOW()
  WHERE 
    user_id = p_user_id 
    AND back_to_life_count > 0
    AND last_video_date = today_date;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_and_increment_usage TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_usage TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION check_and_increment_usage IS 'Atomically checks usage limits and increments count if allowed. Prevents race conditions between multiple devices.';
COMMENT ON FUNCTION rollback_usage IS 'Rolls back usage increment when video generation fails. Only works for same-day rollbacks.';