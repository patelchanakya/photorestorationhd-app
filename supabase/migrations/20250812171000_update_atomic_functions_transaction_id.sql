-- Migration: Update atomic functions to handle store_transaction_id
-- This enables transaction-based reset detection in the database functions

-- Function to atomically check and increment usage (UPDATED WITH TRANSACTION ID)
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id TEXT,
  p_plan_type TEXT DEFAULT 'weekly',
  p_usage_limit INTEGER DEFAULT 7,
  p_billing_cycle_start TIMESTAMPTZ DEFAULT NOW(),
  p_next_reset_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  p_original_purchase_date TIMESTAMPTZ DEFAULT NOW(),
  p_store_transaction_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_usage INTEGER;
  today_date DATE;
  can_use_today BOOLEAN;
  record_exists BOOLEAN;
  existing_transaction_id TEXT;
  needs_reset BOOLEAN;
BEGIN
  -- Get today's date as DATE type
  today_date := CURRENT_DATE;
  
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
      store_transaction_id,
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
      p_store_transaction_id,
      today_date::TEXT,
      true,
      NOW()
    );
    
    RETURN true;
  END IF;
  
  -- Get current usage and existing transaction ID
  SELECT 
    back_to_life_count,
    store_transaction_id,
    CASE 
      WHEN last_video_date IS NULL OR last_video_date != today_date::TEXT THEN true
      ELSE false
    END
  INTO current_usage, existing_transaction_id, can_use_today
  FROM user_video_usage 
  WHERE user_id = p_user_id;
  
  -- Check if we need to reset due to new transaction
  needs_reset := (p_store_transaction_id IS NOT NULL 
                  AND (existing_transaction_id IS NULL 
                       OR existing_transaction_id != p_store_transaction_id));
  
  -- If needs reset, reset the usage first
  IF needs_reset THEN
    UPDATE user_video_usage 
    SET 
      back_to_life_count = 1, -- Reset to 1 (pre-increment)
      plan_type = p_plan_type,
      usage_limit = p_usage_limit,
      billing_cycle_start = p_billing_cycle_start,
      next_reset_date = p_next_reset_date,
      original_purchase_date = p_original_purchase_date,
      store_transaction_id = p_store_transaction_id,
      last_video_date = today_date::TEXT,
      updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN true;
  END IF;
  
  -- Check if user can generate video (no reset needed)
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
    last_video_date = today_date::TEXT,
    updated_at = NOW()
  WHERE 
    user_id = p_user_id 
    AND back_to_life_count < p_usage_limit -- Double-check to prevent race conditions
    AND (last_video_date IS NULL OR last_video_date != today_date::TEXT);
  
  -- Return true if row was updated (increment succeeded)
  RETURN FOUND;
END;
$$;