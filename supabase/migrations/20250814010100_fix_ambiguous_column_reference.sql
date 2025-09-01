-- Fix ambiguous column reference in check_and_increment_usage function
-- The issue is that both a variable and column are named 'last_video_date'

-- Drop and recreate the function with fixed variable names
DROP FUNCTION IF EXISTS check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) CASCADE;

-- Recreate with proper variable naming to avoid ambiguity
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id TEXT,
  p_plan_type TEXT,
  p_usage_limit INTEGER,
  p_billing_cycle_start TIMESTAMPTZ,
  p_next_reset_date TIMESTAMPTZ,
  p_original_purchase_date TIMESTAMPTZ,
  p_store_transaction_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  today_date DATE;
  existing_last_video_date DATE;  -- Renamed to avoid ambiguity with table column
BEGIN
  today_date := CURRENT_DATE;
  
  -- Get current usage for this user (atomic read)
  SELECT back_to_life_count, last_video_date 
  INTO current_count, existing_last_video_date  -- Use the renamed variable
  FROM user_video_usage 
  WHERE user_id = p_user_id
  FOR UPDATE; -- Lock the row for atomic operation
  
  -- If no record exists, create one and increment
  IF current_count IS NULL THEN
    INSERT INTO user_video_usage (
      user_id, back_to_life_count, plan_type, usage_limit,
      billing_cycle_start, next_reset_date, original_purchase_date,
      store_transaction_id, last_video_date, updated_at
    ) VALUES (
      p_user_id, 1, p_plan_type, p_usage_limit,
      p_billing_cycle_start, p_next_reset_date, p_original_purchase_date,
      p_store_transaction_id, today_date, NOW()
    );
    RETURN TRUE;
  END IF;
  
  -- Check monthly limit
  IF current_count >= p_usage_limit THEN
    RETURN FALSE; -- At monthly limit
  END IF;
  
  -- Check daily limit (only for weekly plans)
  IF p_plan_type = 'weekly' AND existing_last_video_date = today_date THEN  -- Use renamed variable
    RETURN FALSE; -- Already used today (weekly plan daily limit)
  END IF;
  
  -- Increment usage and update last video date
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
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;