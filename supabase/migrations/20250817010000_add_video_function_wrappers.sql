-- Add wrapper functions to match the function names expected by video service code
-- This migration creates compatibility wrappers for the video generation system

-- Wrapper for increment_back_to_life_usage that calls the existing check_and_increment_usage
-- Returns JSON with success, reason, and usage info as expected by the service
CREATE OR REPLACE FUNCTION increment_back_to_life_usage(
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_plan_details JSON;
  v_success BOOLEAN;
  v_current_count INTEGER;
  v_usage_limit INTEGER;
  v_next_reset_date TIMESTAMPTZ;
BEGIN
  -- Get subscription plan details from the user - this should be passed from the service
  -- For now, we'll use default Pro user settings since this is only called for Pro users
  -- TODO: Service should pass plan details to avoid this lookup
  
  -- Default Pro user settings (monthly plan)
  v_plan_details := json_build_object(
    'plan_type', 'monthly',
    'usage_limit', 31,
    'billing_cycle_start', NOW(),
    'next_reset_date', NOW() + INTERVAL '1 month',
    'original_purchase_date', NOW(),
    'store_transaction_id', 'default'
  );
  
  -- Call the existing atomic function
  SELECT check_and_increment_usage(
    p_user_id,
    (v_plan_details->>'plan_type')::TEXT,
    (v_plan_details->>'usage_limit')::INTEGER,
    (v_plan_details->>'billing_cycle_start')::TIMESTAMPTZ,
    (v_plan_details->>'next_reset_date')::TIMESTAMPTZ,
    (v_plan_details->>'original_purchase_date')::TIMESTAMPTZ,
    (v_plan_details->>'store_transaction_id')::TEXT
  ) INTO v_success;
  
  -- Get current usage info for response
  SELECT back_to_life_count, usage_limit, next_reset_date 
  INTO v_current_count, v_usage_limit, v_next_reset_date
  FROM user_video_usage 
  WHERE user_id = p_user_id;
  
  -- Handle case where user record doesn't exist yet
  IF v_current_count IS NULL THEN
    v_current_count := 0;
    v_usage_limit := 31;
    v_next_reset_date := NOW() + INTERVAL '1 month';
  END IF;
  
  -- Return JSON response in the format expected by the service
  IF v_success THEN
    RETURN json_build_object(
      'success', true,
      'current_count', v_current_count,
      'limit', v_usage_limit,
      'next_reset_date', v_next_reset_date,
      'can_use', v_current_count < v_usage_limit
    );
  ELSE
    -- Determine the reason for failure
    IF v_current_count >= v_usage_limit THEN
      RETURN json_build_object(
        'success', false,
        'reason', 'Monthly limit reached. You can create 1 video per day.',
        'current_count', v_current_count,
        'limit', v_usage_limit,
        'next_reset_date', v_next_reset_date
      );
    ELSE
      -- Must be daily limit (weekly plan)
      RETURN json_build_object(
        'success', false,
        'reason', 'Daily limit reached. Try again tomorrow.',
        'current_count', v_current_count,
        'limit', v_usage_limit,
        'next_reset_date', v_next_reset_date
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Wrapper for rollback_back_to_life_usage that calls the existing rollback_usage
CREATE OR REPLACE FUNCTION rollback_back_to_life_usage(
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_success BOOLEAN;
  v_current_count INTEGER;
BEGIN
  -- Call the existing rollback function
  SELECT rollback_usage(p_user_id) INTO v_success;
  
  -- Get updated count
  SELECT back_to_life_count INTO v_current_count
  FROM user_video_usage 
  WHERE user_id = p_user_id;
  
  -- Handle case where user record doesn't exist
  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;
  
  -- Return JSON response
  RETURN json_build_object(
    'success', v_success,
    'current_count', v_current_count,
    'rollback_completed', v_success
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to the roles that need them
GRANT EXECUTE ON FUNCTION increment_back_to_life_usage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_back_to_life_usage(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION rollback_back_to_life_usage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_back_to_life_usage(TEXT) TO anon;

-- Migration complete
-- These wrapper functions now match the names expected by the video service code
-- They call the existing atomic functions and return the expected JSON format