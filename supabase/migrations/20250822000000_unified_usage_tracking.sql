-- Unified Usage Tracking System
-- Replaces separate photo/video tracking with a single transaction-based system

-- Create unified usage tracking table
CREATE TABLE IF NOT EXISTS user_unified_usage (
  id SERIAL PRIMARY KEY,
  tracking_id TEXT NOT NULL UNIQUE, -- 'store:transactionId' for Pro, '$RCAnonymousID:xxx' for free
  photo_count INTEGER NOT NULL DEFAULT 0,
  video_count INTEGER NOT NULL DEFAULT 0,
  plan_type TEXT NOT NULL DEFAULT 'free', -- 'free', 'weekly', 'monthly'
  is_pro BOOLEAN NOT NULL DEFAULT false,
  photo_limit INTEGER NOT NULL DEFAULT 5, -- 5 for free, unlimited (999999) for Pro
  video_limit INTEGER NOT NULL DEFAULT 0, -- 0 for free, 31 for monthly, 8 for weekly
  billing_cycle_start TIMESTAMP WITH TIME ZONE,
  next_reset_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_plan_type CHECK (plan_type IN ('free', 'weekly', 'monthly')),
  CONSTRAINT non_negative_counts CHECK (photo_count >= 0 AND video_count >= 0),
  CONSTRAINT valid_limits CHECK (photo_limit >= 0 AND video_limit >= 0)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_unified_usage_tracking_id ON user_unified_usage(tracking_id);
CREATE INDEX IF NOT EXISTS idx_unified_usage_is_pro ON user_unified_usage(is_pro);
CREATE INDEX IF NOT EXISTS idx_unified_usage_plan_type ON user_unified_usage(plan_type);

-- Function to get or create user usage record with proper defaults
CREATE OR REPLACE FUNCTION get_or_create_unified_usage(
  p_tracking_id TEXT,
  p_is_pro BOOLEAN DEFAULT NULL,
  p_plan_type TEXT DEFAULT NULL
) RETURNS user_unified_usage AS $$
DECLARE
  usage_record user_unified_usage;
  detected_is_pro BOOLEAN;
  detected_plan_type TEXT;
  detected_photo_limit INTEGER;
  detected_video_limit INTEGER;
BEGIN
  -- Try to get existing record
  SELECT * INTO usage_record FROM user_unified_usage WHERE tracking_id = p_tracking_id;
  
  IF FOUND THEN
    RETURN usage_record;
  END IF;
  
  -- Auto-detect user type if not provided
  IF p_is_pro IS NULL THEN
    detected_is_pro := (p_tracking_id LIKE 'store:%' OR p_tracking_id LIKE 'orig:%' OR p_tracking_id LIKE 'fallback:%');
  ELSE
    detected_is_pro := p_is_pro;
  END IF;
  
  -- Auto-detect plan type
  IF p_plan_type IS NULL THEN
    IF detected_is_pro THEN
      -- Default to monthly for Pro users (can be updated later)
      detected_plan_type := 'monthly';
    ELSE
      detected_plan_type := 'free';
    END IF;
  ELSE
    detected_plan_type := p_plan_type;
  END IF;
  
  -- Set limits based on user type and plan
  IF detected_is_pro THEN
    detected_photo_limit := 999999; -- Unlimited photos for Pro
    CASE detected_plan_type
      WHEN 'weekly' THEN detected_video_limit := 8;
      WHEN 'monthly' THEN detected_video_limit := 31;
      ELSE detected_video_limit := 31; -- Default to monthly
    END CASE;
  ELSE
    detected_photo_limit := 5; -- Free user photo limit
    detected_video_limit := 0; -- No videos for free users
  END IF;
  
  -- Create new record
  INSERT INTO user_unified_usage (
    tracking_id,
    photo_count,
    video_count,
    plan_type,
    is_pro,
    photo_limit,
    video_limit,
    billing_cycle_start,
    next_reset_date
  ) VALUES (
    p_tracking_id,
    0, -- Start with 0 usage
    0,
    detected_plan_type,
    detected_is_pro,
    detected_photo_limit,
    detected_video_limit,
    CASE WHEN detected_is_pro THEN NOW() ELSE NULL END,
    CASE WHEN detected_is_pro THEN 
      CASE detected_plan_type
        WHEN 'weekly' THEN NOW() + INTERVAL '7 days'
        WHEN 'monthly' THEN NOW() + INTERVAL '30 days'
        ELSE NOW() + INTERVAL '30 days'
      END
    ELSE NULL END
  ) RETURNING * INTO usage_record;
  
  RETURN usage_record;
END;
$$ LANGUAGE plpgsql;

-- Function to check and increment photo usage (unified system)
CREATE OR REPLACE FUNCTION check_and_increment_photo_usage_unified(
  p_tracking_id TEXT,
  p_is_pro BOOLEAN DEFAULT NULL,
  p_plan_type TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  usage_record user_unified_usage;
BEGIN
  -- Get or create usage record
  SELECT * INTO usage_record FROM get_or_create_unified_usage(p_tracking_id, p_is_pro, p_plan_type);
  
  -- Pro users have unlimited photos - always allow and track
  IF usage_record.is_pro THEN
    UPDATE user_unified_usage 
    SET photo_count = photo_count + 1, updated_at = NOW()
    WHERE tracking_id = p_tracking_id;
    RETURN TRUE;
  END IF;
  
  -- Free users have limits
  IF usage_record.photo_count >= usage_record.photo_limit THEN
    RETURN FALSE; -- Limit exceeded
  END IF;
  
  -- Increment usage atomically
  UPDATE user_unified_usage 
  SET photo_count = photo_count + 1, updated_at = NOW()
  WHERE tracking_id = p_tracking_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check and increment video usage (unified system)
CREATE OR REPLACE FUNCTION check_and_increment_video_usage_unified(
  p_tracking_id TEXT,
  p_is_pro BOOLEAN DEFAULT NULL,
  p_plan_type TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  usage_record user_unified_usage;
BEGIN
  -- Get or create usage record
  SELECT * INTO usage_record FROM get_or_create_unified_usage(p_tracking_id, p_is_pro, p_plan_type);
  
  -- Free users cannot use videos
  IF NOT usage_record.is_pro THEN
    RETURN FALSE;
  END IF;
  
  -- Check if usage has reset (monthly/weekly cycle)
  IF usage_record.next_reset_date IS NOT NULL AND NOW() > usage_record.next_reset_date THEN
    -- Reset usage counts
    UPDATE user_unified_usage 
    SET 
      video_count = 0,
      photo_count = 0, -- Reset photos too for Pro users (though they're unlimited)
      billing_cycle_start = NOW(),
      next_reset_date = CASE usage_record.plan_type
        WHEN 'weekly' THEN NOW() + INTERVAL '7 days'
        WHEN 'monthly' THEN NOW() + INTERVAL '30 days'
        ELSE NOW() + INTERVAL '30 days'
      END,
      updated_at = NOW()
    WHERE tracking_id = p_tracking_id;
    
    -- Refresh the record
    SELECT * INTO usage_record FROM user_unified_usage WHERE tracking_id = p_tracking_id;
  END IF;
  
  -- Check video limits for Pro users
  IF usage_record.video_count >= usage_record.video_limit THEN
    RETURN FALSE; -- Video limit exceeded
  END IF;
  
  -- Increment video usage atomically
  UPDATE user_unified_usage 
  SET video_count = video_count + 1, updated_at = NOW()
  WHERE tracking_id = p_tracking_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback photo usage
CREATE OR REPLACE FUNCTION rollback_photo_usage_unified(
  p_tracking_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_unified_usage 
  SET photo_count = GREATEST(photo_count - 1, 0), updated_at = NOW()
  WHERE tracking_id = p_tracking_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback video usage
CREATE OR REPLACE FUNCTION rollback_video_usage_unified(
  p_tracking_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_unified_usage 
  SET video_count = GREATEST(video_count - 1, 0), updated_at = NOW()
  WHERE tracking_id = p_tracking_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get current usage status
CREATE OR REPLACE FUNCTION get_unified_usage_status(
  p_tracking_id TEXT
) RETURNS TABLE(
  tracking_id TEXT,
  photo_count INTEGER,
  video_count INTEGER,
  photo_limit INTEGER,
  video_limit INTEGER,
  plan_type TEXT,
  is_pro BOOLEAN,
  can_use_photos BOOLEAN,
  can_use_videos BOOLEAN,
  next_reset_date TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  usage_record user_unified_usage;
BEGIN
  -- Get or create usage record (with auto-detection)
  SELECT * INTO usage_record FROM get_or_create_unified_usage(p_tracking_id);
  
  -- Return the current status
  RETURN QUERY
  SELECT 
    usage_record.tracking_id,
    usage_record.photo_count,
    usage_record.video_count,
    usage_record.photo_limit,
    usage_record.video_limit,
    usage_record.plan_type,
    usage_record.is_pro,
    CASE 
      WHEN usage_record.is_pro THEN TRUE -- Pro users: unlimited photos
      ELSE usage_record.photo_count < usage_record.photo_limit -- Free users: check limit
    END as can_use_photos,
    CASE 
      WHEN NOT usage_record.is_pro THEN FALSE -- Free users: no videos
      WHEN usage_record.next_reset_date IS NOT NULL AND NOW() > usage_record.next_reset_date THEN TRUE -- Cycle reset
      ELSE usage_record.video_count < usage_record.video_limit -- Check video limit
    END as can_use_videos,
    usage_record.next_reset_date;
END;
$$ LANGUAGE plpgsql;

-- Migration: Populate unified table from existing data
-- Copy video usage data (Pro users)
INSERT INTO user_unified_usage (
  tracking_id,
  photo_count,
  video_count,
  plan_type,
  is_pro,
  photo_limit,
  video_limit,
  billing_cycle_start,
  next_reset_date,
  created_at,
  updated_at
)
SELECT 
  user_id as tracking_id,
  0 as photo_count, -- Pro users start with 0 photo count (unlimited anyway)
  back_to_life_count as video_count,
  plan_type,
  true as is_pro,
  999999 as photo_limit, -- Unlimited photos
  usage_limit as video_limit,
  billing_cycle_start,
  next_reset_date,
  created_at,
  updated_at
FROM user_video_usage
WHERE is_active = true
ON CONFLICT (tracking_id) DO NOTHING;

-- Copy photo usage data (Free users) 
INSERT INTO user_unified_usage (
  tracking_id,
  photo_count,
  video_count,
  plan_type,
  is_pro,
  photo_limit,
  video_limit,
  billing_cycle_start,
  next_reset_date,
  created_at,
  updated_at
)
SELECT 
  user_id as tracking_id,
  photo_count,
  0 as video_count, -- Free users can't use videos
  plan_type,
  false as is_pro,
  usage_limit as photo_limit,
  0 as video_limit, -- No videos for free users
  NULL as billing_cycle_start,
  NULL as next_reset_date,
  created_at,
  updated_at
FROM user_photo_usage
ON CONFLICT (tracking_id) DO NOTHING;

-- Add comment explaining the new system
COMMENT ON TABLE user_unified_usage IS 'Unified usage tracking for both photos and videos. Uses transaction IDs for Pro users and RevenueCat anonymous IDs for free users. Pro users get unlimited photos but limited videos, free users get limited photos and no videos.';