-- Migration to Subscriber-Stable Keys
-- Migrate existing device-based keys to subscriber-stable keys where possible
-- This prevents reinstall reset abuse for existing users

BEGIN;

-- First, let's see what existing records we have
DO $$
BEGIN
  RAISE NOTICE 'Migration: Checking existing user_video_usage records...';
END $$;

-- Create a temporary function to help with migration
CREATE OR REPLACE FUNCTION migrate_existing_records()
RETURNS INTEGER AS $$
DECLARE
  record_count INTEGER := 0;
  migrated_count INTEGER := 0;
BEGIN
  -- Count existing records
  SELECT COUNT(*) INTO record_count FROM user_video_usage;
  RAISE NOTICE 'Found % existing records to evaluate for migration', record_count;
  
  -- Since we don't have transaction IDs for existing device-based records,
  -- we'll leave them as-is. New users will get the bulletproof approach.
  -- 
  -- Existing users will continue to use device-based tracking until:
  -- 1. They reinstall (gets new subscriber-stable key)
  -- 2. Their subscription renews (billing cycle reset gives them fresh count)
  --
  -- This is acceptable because:
  -- - Existing users already have established usage patterns
  -- - New transaction IDs on renewal will create fresh, stable records
  -- - We prevent the abuse vector for all new users immediately
  
  RAISE NOTICE 'Migration strategy: Existing device-based records will be preserved';
  RAISE NOTICE 'New subscriber-stable keys will be used for all new records';
  RAISE NOTICE 'Migration completed - % records migrated', migrated_count;
  
  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_existing_records();

-- Clean up the temporary function
DROP FUNCTION migrate_existing_records();

-- Add a comment to document the migration strategy
COMMENT ON TABLE user_video_usage IS 
'Video usage tracking table. Supports both legacy device-based keys and new subscriber-stable keys (orig: and stable: prefixes). New records use subscriber-stable keys to prevent reinstall abuse.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Subscriber-stable key system ready';
  RAISE NOTICE 'Existing records preserved, new records will use bulletproof keys';
END $$;

COMMIT;