-- Simplified Video Tracking Migration
-- Based on test results: Use single stable device ID approach
-- 
-- Key Changes:
-- 1. Remove dual-ID complexity (no transaction_id columns)
-- 2. Use user_id as primary key (stable device ID)
-- 3. Remove last_device_id column (not needed in single-ID approach)
-- 4. Simplified schema for better maintainability

-- Drop existing functions with specific signatures to avoid conflicts
DROP FUNCTION IF EXISTS check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) CASCADE;
DROP FUNCTION IF EXISTS rollback_usage(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS rollback_usage(TEXT) CASCADE;

-- Drop existing table if it exists (clean slate)
DROP TABLE IF EXISTS user_video_usage CASCADE;

-- Create simplified user_video_usage table
CREATE TABLE IF NOT EXISTS user_video_usage (
  user_id TEXT PRIMARY KEY,  -- Stable device ID (RevenueCat App User ID)
  back_to_life_count INTEGER DEFAULT 0,
  plan_type TEXT DEFAULT 'monthly' CHECK (plan_type IN ('weekly', 'monthly')),
  usage_limit INTEGER DEFAULT 31,
  billing_cycle_start TIMESTAMPTZ NOT NULL,
  next_reset_date TIMESTAMPTZ NOT NULL,
  last_video_date DATE, -- For daily limits on weekly plans
  original_purchase_date TIMESTAMPTZ,
  store_transaction_id TEXT, -- For billing cycle reset detection
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_video_usage_next_reset 
ON user_video_usage(next_reset_date);

CREATE INDEX IF NOT EXISTS idx_user_video_usage_last_video_date 
ON user_video_usage(last_video_date);

CREATE INDEX IF NOT EXISTS idx_user_video_usage_store_transaction_id 
ON user_video_usage(store_transaction_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_video_usage_updated_at ON user_video_usage;
CREATE TRIGGER update_user_video_usage_updated_at 
  BEFORE UPDATE ON user_video_usage 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Atomic usage increment function (simplified for single-ID)
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
  existing_last_video_date DATE;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Get current usage for this user (atomic read)
  SELECT back_to_life_count, last_video_date 
  INTO current_count, existing_last_video_date
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
  IF p_plan_type = 'weekly' AND existing_last_video_date = today_date THEN
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

-- Rollback function (simplified for single-ID)
CREATE OR REPLACE FUNCTION rollback_usage(
  p_user_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Get current count (atomic read)
  SELECT back_to_life_count 
  INTO current_count
  FROM user_video_usage 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Only rollback if count > 0
  IF current_count IS NULL OR current_count <= 0 THEN
    RETURN FALSE; -- Nothing to rollback
  END IF;
  
  -- Decrement count
  UPDATE user_video_usage 
  SET 
    back_to_life_count = back_to_life_count - 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (Row Level Security)
ALTER TABLE user_video_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own records
CREATE POLICY "Users can only access their own video usage" 
ON user_video_usage 
FOR ALL 
USING (true); -- Allow all for now - we control access via service

-- Grant permissions
GRANT ALL ON user_video_usage TO authenticated;
GRANT ALL ON user_video_usage TO anon;
GRANT EXECUTE ON FUNCTION check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_usage(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION rollback_usage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_usage(TEXT) TO anon;

-- Migration complete
-- This migration creates a simplified video tracking system using only stable device IDs
-- Video limits will reset on app reinstall, but the system is much simpler and more reliable