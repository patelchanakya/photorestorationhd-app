-- Add NOT NULL constraints and default values for critical billing cycle fields
-- This ensures data integrity and prevents broken state

ALTER TABLE user_video_usage 
ALTER COLUMN billing_cycle_start SET NOT NULL,
ALTER COLUMN next_reset_date SET NOT NULL,
ALTER COLUMN original_purchase_date SET NOT NULL;

-- Add check constraint to ensure plan_type is valid
ALTER TABLE user_video_usage 
ADD CONSTRAINT check_valid_plan_type 
CHECK (plan_type IN ('weekly', 'monthly'));

-- Add check constraint to ensure back_to_life_count is not negative
ALTER TABLE user_video_usage 
ADD CONSTRAINT check_non_negative_count 
CHECK (back_to_life_count >= 0);

-- Add check constraint to ensure usage_limit is positive
ALTER TABLE user_video_usage 
ADD CONSTRAINT check_positive_usage_limit 
CHECK (usage_limit > 0);