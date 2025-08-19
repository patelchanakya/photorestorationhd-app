-- Test script for security implementation
-- Run these queries in Supabase dashboard to verify functionality

-- 1. Test subscription cache functions
SELECT 'Testing cache functions...' as test_step;

-- Test cache update
SELECT update_subscription_cache(
  'test-user-123',
  true,
  'monthly',
  (NOW() + INTERVAL '1 month')::timestamptz,
  'test-transaction-123',
  'rc-test-user'
) as cache_update_result;

-- Test cache retrieval
SELECT * FROM get_cached_subscription_status('test-user-123') as cache_status;

-- Verify data was stored
SELECT * FROM subscription_cache WHERE user_id = 'test-user-123';

-- Test staleness detection
SELECT is_subscription_cache_stale(NOW() - INTERVAL '30 minutes', NULL) as is_30min_stale;
SELECT is_subscription_cache_stale(NOW() - INTERVAL '2 hours', NULL) as is_2hour_stale;

-- 2. Test video wrapper functions (existing)
SELECT 'Testing video wrapper functions...' as test_step;

-- Test video usage increment
SELECT increment_back_to_life_usage('test-pro-user') as video_increment_result;

-- Test rollback
SELECT rollback_back_to_life_usage('test-pro-user') as video_rollback_result;

-- 3. Test photo usage functions (existing)  
SELECT 'Testing photo usage functions...' as test_step;

-- Test photo usage for free user
SELECT check_and_increment_photo_usage('test-free-user', 5) as photo_increment_result;

-- Check current usage
SELECT * FROM get_photo_usage('test-free-user') as photo_usage;

-- 4. Test cleanup function
SELECT 'Testing cleanup function...' as test_step;
SELECT cleanup_subscription_cache() as cleanup_result;

-- 5. View all tables to confirm structure
SELECT 'Database structure verification...' as test_step;
\d subscription_cache
\d user_photo_usage  
\d user_video_usage

-- 6. Test cache invalidation
SELECT 'Testing cache invalidation...' as test_step;
SELECT invalidate_subscription_cache('test-user-123') as invalidate_result;
SELECT * FROM get_cached_subscription_status('test-user-123') as cache_after_invalidation;