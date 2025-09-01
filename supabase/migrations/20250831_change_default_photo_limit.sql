-- Change default photo limit from 5 to 3 for new users
-- This ensures ALL new users get the new limit, not just existing ones

CREATE OR REPLACE FUNCTION check_and_increment_photo_usage(
  p_user_id TEXT,
  p_usage_limit INTEGER DEFAULT NULL -- Keep for backward compatibility
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  actual_limit INTEGER;
  default_limit INTEGER := 3; -- Changed from 5 to 3
BEGIN
  -- Get current usage AND limit from table (atomic read)
  SELECT photo_count, usage_limit 
  INTO current_count, actual_limit
  FROM user_photo_usage 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF current_count IS NULL THEN
    -- Use parameter if provided, otherwise default to 3
    INSERT INTO user_photo_usage (user_id, photo_count, usage_limit, plan_type)
    VALUES (p_user_id, 1, COALESCE(p_usage_limit, default_limit), 'free');
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

-- Add comment explaining the change
COMMENT ON FUNCTION check_and_increment_photo_usage IS 'Updated: Default photo limit changed from 5 to 3 for new users. Database is single source of truth.';
