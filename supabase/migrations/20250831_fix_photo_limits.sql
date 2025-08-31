-- Fix photo usage limits by making function read from its own table
-- This eliminates the need to pass usage_limit parameters and makes the database the single source of truth

CREATE OR REPLACE FUNCTION check_and_increment_photo_usage(
  p_user_id TEXT,
  p_usage_limit INTEGER DEFAULT NULL -- Keep for backward compatibility
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  actual_limit INTEGER;
BEGIN
  -- Get current usage AND limit from table (atomic read)
  SELECT photo_count, usage_limit 
  INTO current_count, actual_limit
  FROM user_photo_usage 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF current_count IS NULL THEN
    -- Use parameter if provided, otherwise default to 5
    INSERT INTO user_photo_usage (user_id, photo_count, usage_limit, plan_type)
    VALUES (p_user_id, 1, COALESCE(p_usage_limit, 5), 'free');
    RETURN TRUE;
  END IF;
  
  -- Use table's limit, not parameter!
  IF current_count >= actual_limit THEN
    RETURN FALSE;
  END IF;
  
  -- Increment usage atomically
  UPDATE user_photo_usage 
  SET photo_count = photo_count + 1, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the fix
COMMENT ON FUNCTION check_and_increment_photo_usage IS 'Fixed: Now reads usage_limit from its own table instead of relying on parameters. Database is single source of truth.';
