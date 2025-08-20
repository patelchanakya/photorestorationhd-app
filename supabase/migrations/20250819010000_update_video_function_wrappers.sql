-- Update video function wrappers to work with new check_and_increment_usage signature
-- This fixes the wrapper functions to use the updated atomic function with original transaction ID support

-- Drop and recreate increment_back_to_life_usage wrapper with new signature support
DROP FUNCTION IF EXISTS increment_back_to_life_usage(TEXT);

CREATE OR REPLACE FUNCTION increment_back_to_life_usage(
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_plan_details JSON;
  v_success BOOLEAN;
  v_current_count INTEGER;
  v_usage_limit INTEGER;
  v_next_reset_date TIMESTAMPTZ;
  v_original_transaction_id TEXT;
BEGIN
  -- Extract original transaction ID from user_id if it has "orig:" prefix
  IF p_user_id LIKE 'orig:%' THEN
    v_original_transaction_id := substring(p_user_id from 6); -- Remove "orig:" prefix
  ELSE
    v_original_transaction_id := NULL;
  END IF;
  
  -- Get current usage record to determine plan details
  -- If no record exists, use default Pro user settings (monthly plan)
  SELECT 
    COALESCE(plan_type, 'monthly'),
    COALESCE(usage_limit, 31),
    COALESCE(billing_cycle_start, NOW()),
    COALESCE(next_reset_date, NOW() + INTERVAL '1 month'),
    COALESCE(original_purchase_date, NOW()),
    COALESCE(store_transaction_id, 'default'),
    COALESCE(original_transaction_id, v_original_transaction_id)
  INTO 
    v_plan_details
  FROM (
    SELECT 
      u.plan_type,
      u.usage_limit,
      u.billing_cycle_start,
      u.next_reset_date,
      u.original_purchase_date,
      u.store_transaction_id,
      u.original_transaction_id
    FROM user_video_usage u
    WHERE u.user_id = p_user_id
    
    UNION ALL
    
    -- Default values if no record exists
    SELECT 
      'monthly'::TEXT,
      31::INTEGER,
      NOW()::TIMESTAMPTZ,
      (NOW() + INTERVAL '1 month')::TIMESTAMPTZ,
      NOW()::TIMESTAMPTZ,
      'default'::TEXT,
      v_original_transaction_id::TEXT
    WHERE NOT EXISTS (SELECT 1 FROM user_video_usage WHERE user_id = p_user_id)
    
    LIMIT 1
  ) defaults;
  
  -- Build plan details JSON from the retrieved/default values
  v_plan_details := json_build_object(
    'plan_type', COALESCE((SELECT plan_type FROM (SELECT v_plan_details) t), 'monthly'),
    'usage_limit', 31,
    'billing_cycle_start', NOW(),
    'next_reset_date', NOW() + INTERVAL '1 month',
    'original_purchase_date', NOW(),
    'store_transaction_id', 'wrapper_call',
    'original_transaction_id', v_original_transaction_id
  );
  
  -- Call the updated atomic function with original transaction ID
  SELECT check_and_increment_usage(
    p_user_id,
    (v_plan_details->>'plan_type')::TEXT,
    (v_plan_details->>'usage_limit')::INTEGER,
    (v_plan_details->>'billing_cycle_start')::TIMESTAMPTZ,
    (v_plan_details->>'next_reset_date')::TIMESTAMPTZ,
    (v_plan_details->>'original_purchase_date')::TIMESTAMPTZ,
    (v_plan_details->>'store_transaction_id')::TEXT,
    (v_plan_details->>'original_transaction_id')::TEXT
  ) INTO v_success;
  
  -- Get current usage info for response
  SELECT back_to_life_count, usage_limit, next_reset_date 
  INTO v_current_count, v_usage_limit, v_next_reset_date
  FROM user_video_usage 
  WHERE user_id = p_user_id;
  
  -- Handle case where user record doesn't exist yet (shouldn't happen after call above)
  IF v_current_count IS NULL THEN
    v_current_count := 1;
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
      'can_use', v_current_count < v_usage_limit,
      'original_transaction_id', v_original_transaction_id
    );
  ELSE
    -- Determine the reason for failure
    IF v_current_count >= v_usage_limit THEN
      RETURN json_build_object(
        'success', false,
        'reason', 'Monthly limit reached. You can create 1 video per day.',
        'current_count', v_current_count,
        'limit', v_usage_limit,
        'next_reset_date', v_next_reset_date,
        'original_transaction_id', v_original_transaction_id
      );
    ELSE
      -- Must be daily limit (weekly plan)
      RETURN json_build_object(
        'success', false,
        'reason', 'Daily limit reached. Try again tomorrow.',
        'current_count', v_current_count,
        'limit', v_usage_limit,
        'next_reset_date', v_next_reset_date,
        'original_transaction_id', v_original_transaction_id
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- The rollback function should continue to work as-is since its signature didn't change
-- But let's make sure it has the latest permissions

-- Grant execute permissions to the updated wrapper function
GRANT EXECUTE ON FUNCTION increment_back_to_life_usage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_back_to_life_usage(TEXT) TO anon;

-- Migration complete
-- The wrapper function now properly calls the updated atomic function with original transaction ID support
-- This maintains backward compatibility while enabling the new reset logic