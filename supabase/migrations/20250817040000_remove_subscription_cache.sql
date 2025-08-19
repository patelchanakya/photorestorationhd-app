-- Remove subscription cache system - replaced with simple expiration-based checks
-- This eliminates complex caching in favor of RevenueCat API + SecureStorage

-- Drop all subscription cache functions
DROP FUNCTION IF EXISTS get_cached_subscription_status(TEXT);
DROP FUNCTION IF EXISTS update_subscription_cache(TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS invalidate_subscription_cache(TEXT);
DROP FUNCTION IF EXISTS is_subscription_cache_stale(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS cleanup_subscription_cache();

-- Drop trigger and trigger function
DROP TRIGGER IF EXISTS trigger_update_subscription_cache_updated_at ON subscription_cache;
DROP FUNCTION IF EXISTS update_subscription_cache_updated_at();

-- Drop the subscription cache table entirely
DROP TABLE IF EXISTS subscription_cache;

-- Note: Keep usage tracking tables (user_photo_usage, user_video_usage) - these are still needed
-- The new architecture:
-- 1. App startup: getCustomerInfo() -> SecureStorage
-- 2. Pro checks: Simple expiration date comparison
-- 3. Usage tracking: Database for cross-device enforcement