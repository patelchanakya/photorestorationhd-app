-- Final fix for store: format support in video generation
-- This correctly calls check_and_increment_usage with the proper 8 parameters

CREATE OR REPLACE FUNCTION increment_back_to_life_usage(
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_success BOOLEAN;
  v_current_count INTEGER;
  v_usage_limit INTEGER;
  v_next_reset_date TIMESTAMPTZ;
  v_transaction_id TEXT;
  v_is_pro_user BOOLEAN := false;
BEGIN
  -- Log the function call for debugging
  RAISE NOTICE '[BACKEND] increment_back_to_life_usage called with user_id: %', p_user_id;

  -- Determine if this is a Pro user and extract transaction ID
  IF p_user_id LIKE 'orig:%' THEN
    v_transaction_id := substring(p_user_id from 6); -- Remove "orig:" prefix
    v_is_pro_user := true;
    RAISE NOTICE '[BACKEND] Detected orig: format, transaction_id: %', v_transaction_id;
  ELSIF p_user_id LIKE 'store:%' THEN
    v_transaction_id := substring(p_user_id from 7); -- Remove "store:" prefix  
    v_is_pro_user := true;
    RAISE NOTICE '[BACKEND] Detected store: format, transaction_id: %', v_transaction_id;
  ELSIF p_user_id LIKE 'fallback:%' THEN
    v_transaction_id := substring(p_user_id from 10); -- Remove "fallback:" prefix
    v_is_pro_user := true;
    RAISE NOTICE '[BACKEND] Detected fallback: format, transaction_id: %', v_transaction_id;
  ELSE
    -- Anonymous or other format - not a Pro user
    v_transaction_id := NULL;
    v_is_pro_user := false;
    RAISE NOTICE '[BACKEND] Non-Pro user format detected: %', p_user_id;
  END IF;
  
  -- Only Pro users can use video generation
  IF NOT v_is_pro_user THEN
    RAISE NOTICE '[BACKEND] Access denied - not a Pro user';
    RETURN json_build_object(
      'success', false,
      'reason', 'Video generation requires Pro subscription',
      'current_count', 0,
      'limit', 0,
      'code', 'PRO_REQUIRED_FOR_VIDEOS'
    );
  END IF;
  
  RAISE NOTICE '[BACKEND] Pro user verified, proceeding with video generation check';
  
  -- Call check_and_increment_usage with ALL 8 required parameters
  SELECT check_and_increment_usage(
    p_user_id,                              -- p_user_id TEXT
    'monthly',                              -- p_plan_type TEXT  
    31,                                     -- p_usage_limit INTEGER
    NOW(),                                  -- p_billing_cycle_start TIMESTAMPTZ
    NOW() + INTERVAL '1 month',             -- p_next_reset_date TIMESTAMPTZ
    NOW(),                                  -- p_original_purchase_date TIMESTAMPTZ
    COALESCE(v_transaction_id, 'unknown'),  -- p_store_transaction_id TEXT (can't be null)
    v_transaction_id                        -- p_original_transaction_id TEXT (can be null)
  ) INTO v_success;
  
  RAISE NOTICE '[BACKEND] check_and_increment_usage returned: %', v_success;
  
  -- Get current usage info for response
  SELECT back_to_life_count, usage_limit, next_reset_date 
  INTO v_current_count, v_usage_limit, v_next_reset_date
  FROM user_video_usage 
  WHERE user_id = p_user_id;
  
  -- Handle case where user record doesn't exist yet (first time user)
  IF v_current_count IS NULL THEN
    v_current_count := 1;
    v_usage_limit := 31;
    v_next_reset_date := NOW() + INTERVAL '1 month';
    RAISE NOTICE '[BACKEND] First time user - using defaults';
  END IF;
  
  RAISE NOTICE '[BACKEND] Current count: %, Limit: %', v_current_count, v_usage_limit;
  
  -- Return JSON response in the format expected by the service
  IF v_success THEN
    RAISE NOTICE '[BACKEND] Video generation approved';
    RETURN json_build_object(
      'success', true,
      'current_count', v_current_count,
      'limit', v_usage_limit,
      'next_reset_date', v_next_reset_date,
      'can_use', v_current_count < v_usage_limit,
      'transaction_id', v_transaction_id,
      'user_type', 'pro'
    );
  ELSE
    -- Determine the reason for failure
    IF v_current_count >= v_usage_limit THEN
      RAISE NOTICE '[BACKEND] Monthly limit reached';
      RETURN json_build_object(
        'success', false,
        'reason', 'Monthly limit reached. You can create 1 video per day.',
        'current_count', v_current_count,
        'limit', v_usage_limit,
        'next_reset_date', v_next_reset_date,
        'transaction_id', v_transaction_id,
        'code', 'MONTHLY_LIMIT_REACHED'
      );
    ELSE
      -- Must be daily limit
      RAISE NOTICE '[BACKEND] Daily limit reached';
      RETURN json_build_object(
        'success', false,
        'reason', 'Daily limit reached. Try again tomorrow.',
        'current_count', v_current_count,
        'limit', v_usage_limit,
        'next_reset_date', v_next_reset_date,
        'transaction_id', v_transaction_id,
        'code', 'DAILY_LIMIT_REACHED'
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_back_to_life_usage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_back_to_life_usage(TEXT) TO anon;

-- Add helpful comment
COMMENT ON FUNCTION increment_back_to_life_usage IS 'Handles video generation limits for Pro users. Supports orig:, store:, and fallback: user ID formats. Correctly calls check_and_increment_usage with all 8 required parameters.';