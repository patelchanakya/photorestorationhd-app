-- Test that our new column and functions exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_video_usage' 
AND column_name = 'original_transaction_id';

-- Test that our new function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'get_video_usage_status';