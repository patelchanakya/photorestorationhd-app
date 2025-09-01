-- Migration: Add store_transaction_id column to track subscription changes
-- This enables truth-based reset detection instead of time-based hacks

-- Add store_transaction_id column to user_video_usage table
ALTER TABLE user_video_usage 
ADD COLUMN store_transaction_id TEXT DEFAULT NULL;

-- Create index for faster lookups by transaction ID
CREATE INDEX IF NOT EXISTS idx_user_video_usage_transaction_id 
ON user_video_usage(store_transaction_id);

-- Add comment explaining the column
COMMENT ON COLUMN user_video_usage.store_transaction_id IS 'RevenueCat store transaction ID - used to detect new subscriptions for usage reset';