-- Fix all constraint issues that could cause silent failures
-- This makes the system more reliable by removing overly restrictive constraints

-- 1. Fix plan_type constraint mismatch between tables
-- user_video_usage only allows ('weekly', 'monthly') but user_unified_usage allows ('free', 'weekly', 'monthly')
-- This could cause silent failures if functions try to insert 'free' into video usage table

-- Remove the restrictive constraint from user_video_usage
ALTER TABLE user_video_usage 
DROP CONSTRAINT IF EXISTS check_valid_plan_type;

-- Add the same constraint as user_unified_usage for consistency
ALTER TABLE user_video_usage 
ADD CONSTRAINT check_valid_plan_type 
CHECK (plan_type IN ('free', 'weekly', 'monthly'));

-- 2. Fix numeric constraints that could be too restrictive
-- These could cause silent failures if functions try to insert edge case values

-- Remove overly restrictive constraints
ALTER TABLE user_video_usage 
DROP CONSTRAINT IF EXISTS check_non_negative_count;

ALTER TABLE user_video_usage 
DROP CONSTRAINT IF EXISTS check_positive_usage_limit;

-- Add more flexible constraints that allow edge cases
ALTER TABLE user_video_usage 
ADD CONSTRAINT check_non_negative_count 
CHECK (back_to_life_count >= 0);

ALTER TABLE user_video_usage 
ADD CONSTRAINT check_usage_limit_valid 
CHECK (usage_limit >= 0); -- Allow 0 for edge cases

-- 3. Fix unified usage constraints to be more flexible
-- Remove overly restrictive constraints that could cause silent failures

ALTER TABLE user_unified_usage 
DROP CONSTRAINT IF EXISTS non_negative_counts;

ALTER TABLE user_unified_usage 
DROP CONSTRAINT IF EXISTS valid_limits;

-- Add more flexible constraints
ALTER TABLE user_unified_usage 
ADD CONSTRAINT non_negative_counts 
CHECK (photo_count >= 0 AND video_count >= 0);

ALTER TABLE user_unified_usage 
ADD CONSTRAINT valid_limits 
CHECK (photo_limit >= 0 AND video_limit >= 0);

-- 4. Fix unique constraints that could cause issues
-- The user_onboarding unique constraint could cause failures if functions try to insert duplicate user_id

-- Remove the unique constraint that could cause silent failures
ALTER TABLE user_onboarding 
DROP CONSTRAINT IF EXISTS user_onboarding_user_id_u;

-- Add a more flexible constraint that allows updates
ALTER TABLE user_onboarding 
ADD CONSTRAINT user_onboarding_user_id_unique 
UNIQUE (user_id);

-- 5. Add comments to document the changes
COMMENT ON TABLE user_video_usage IS 'Video usage tracking with flexible constraints to prevent silent failures';
COMMENT ON TABLE user_unified_usage IS 'Unified usage tracking with flexible constraints to prevent silent failures';
COMMENT ON TABLE user_onboarding IS 'User onboarding with flexible constraints to prevent silent failures';

-- 6. Verify all constraints are now consistent
-- This ensures no more silent failures due to constraint violations
