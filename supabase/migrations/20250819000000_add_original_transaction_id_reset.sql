-- Add original transaction ID support and monthly reset logic
-- This enables stable tracking across subscription renewals with automatic monthly resets

-- Add column to track original transaction ID (stable across renewals)
ALTER TABLE user_video_usage 
ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;

-- Add index for original transaction ID lookups
CREATE INDEX IF NOT EXISTS idx_user_video_usage_original_transaction_id 
ON user_video_usage(original_transaction_id);

-- Drop existing function to recreate with new signature
DROP FUNCTION IF EXISTS check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

-- Updated function with reset logic and original transaction ID support
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id TEXT,
  p_plan_type TEXT,
  p_usage_limit INTEGER,
  p_billing_cycle_start TIMESTAMPTZ,
  p_next_reset_date TIMESTAMPTZ,
  p_original_purchase_date TIMESTAMPTZ,
  p_store_transaction_id TEXT,
  p_original_transaction_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  existing_next_reset TIMESTAMPTZ;
  existing_last_video_date DATE;
  today_date DATE;
  billing_reset_needed BOOLEAN := FALSE;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Get current usage for this user (atomic read with lock)
  SELECT back_to_life_count, next_reset_date, last_video_date 
  INTO current_count, existing_next_reset, existing_last_video_date
  FROM user_video_usage 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- If no record exists, create one and increment
  IF current_count IS NULL THEN
    INSERT INTO user_video_usage (
      user_id, back_to_life_count, plan_type, usage_limit,
      billing_cycle_start, next_reset_date, original_purchase_date,
      store_transaction_id, original_transaction_id, last_video_date, updated_at
    ) VALUES (
      p_user_id, 1, p_plan_type, p_usage_limit,
      p_billing_cycle_start, p_next_reset_date, p_original_purchase_date,
      p_store_transaction_id, p_original_transaction_id, today_date, NOW()
    );
    RETURN TRUE;
  END IF;
  
  -- Check if we need to reset for new billing cycle
  IF NOW() > existing_next_reset THEN
    billing_reset_needed := TRUE;
    
    -- Reset for new billing cycle
    UPDATE user_video_usage 
    SET 
      back_to_life_count = 1,
      plan_type = p_plan_type,
      usage_limit = p_usage_limit,
      billing_cycle_start = p_billing_cycle_start,
      next_reset_date = p_next_reset_date,
      original_purchase_date = p_original_purchase_date,
      store_transaction_id = p_store_transaction_id,
      original_transaction_id = p_original_transaction_id,
      last_video_date = today_date,
      updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Log the reset for debugging
    RAISE NOTICE 'Video usage reset for user % - new billing cycle. Count reset to 1, next reset: %', 
      p_user_id, p_next_reset_date;
    
    RETURN TRUE;
  END IF;
  
  -- Check monthly limit
  IF current_count >= p_usage_limit THEN
    RAISE NOTICE 'Monthly video limit reached for user %: %/%', p_user_id, current_count, p_usage_limit;
    RETURN FALSE; -- At monthly limit
  END IF;
  
  -- Check daily limit (only for weekly plans)
  IF p_plan_type = 'weekly' AND existing_last_video_date = today_date THEN
    RAISE NOTICE 'Daily video limit reached for user % on weekly plan', p_user_id;
    RETURN FALSE; -- Already used today (weekly plan daily limit)
  END IF;
  
  -- Increment usage and update metadata
  UPDATE user_video_usage 
  SET 
    back_to_life_count = back_to_life_count + 1,
    last_video_date = today_date,
    plan_type = p_plan_type,
    usage_limit = p_usage_limit,
    billing_cycle_start = p_billing_cycle_start,
    next_reset_date = p_next_reset_date,
    original_purchase_date = p_original_purchase_date,
    store_transaction_id = p_store_transaction_id,
    original_transaction_id = p_original_transaction_id,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RAISE NOTICE 'Video usage incremented for user %: %/%', p_user_id, current_count + 1, p_usage_limit;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update rollback function to include original transaction ID
DROP FUNCTION IF EXISTS rollback_usage(TEXT);

CREATE OR REPLACE FUNCTION rollback_usage(
  p_user_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Get current count (atomic read with lock)
  SELECT back_to_life_count 
  INTO current_count
  FROM user_video_usage 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Only rollback if count > 0
  IF current_count IS NULL OR current_count <= 0 THEN
    RAISE NOTICE 'Rollback failed for user %: no usage to rollback (count: %)', p_user_id, current_count;
    RETURN FALSE; -- Nothing to rollback
  END IF;
  
  -- Decrement count
  UPDATE user_video_usage 
  SET 
    back_to_life_count = back_to_life_count - 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RAISE NOTICE 'Video usage rolled back for user %: %/%', p_user_id, current_count - 1, 
    (SELECT usage_limit FROM user_video_usage WHERE user_id = p_user_id);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add function to check current usage without incrementing (for UI display)
CREATE OR REPLACE FUNCTION get_video_usage_status(
  p_user_id TEXT
) RETURNS TABLE(
  current_count INTEGER,
  usage_limit INTEGER,
  next_reset_date TIMESTAMPTZ,
  can_use_today BOOLEAN,
  days_until_reset INTEGER,
  plan_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(u.back_to_life_count, 0) as current_count,
    COALESCE(u.usage_limit, 31) as usage_limit,
    u.next_reset_date,
    (COALESCE(u.back_to_life_count, 0) < COALESCE(u.usage_limit, 31)) 
      AND (u.plan_type != 'weekly' OR u.last_video_date != CURRENT_DATE) as can_use_today,
    CEIL(EXTRACT(EPOCH FROM (u.next_reset_date - NOW())) / 86400)::INTEGER as days_until_reset,
    COALESCE(u.plan_type, 'monthly') as plan_type
  FROM user_video_usage u
  WHERE u.user_id = p_user_id
  
  UNION ALL
  
  -- Return default values if no record exists
  SELECT 0, 31, NULL::TIMESTAMPTZ, TRUE, NULL::INTEGER, 'monthly'::TEXT
  WHERE NOT EXISTS (SELECT 1 FROM user_video_usage WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION rollback_usage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_usage(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_video_usage_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_video_usage_status(TEXT) TO anon;

-- Comments for documentation
COMMENT ON COLUMN user_video_usage.original_transaction_id IS 
'Original transaction ID from Apple/Google - stable across subscription renewals, used for cross-device tracking';

COMMENT ON FUNCTION check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) IS 
'Atomic function to check and increment video usage with automatic monthly reset logic based on billing cycle dates';

COMMENT ON FUNCTION get_video_usage_status(TEXT) IS 
'Returns current usage status for display in UI without incrementing count';

-- Cleanup old function references if they exist
DROP FUNCTION IF EXISTS check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS rollback_usage(TEXT, TEXT);