-- Add mode_tag column to user_video_jobs for better UX tracking
ALTER TABLE user_video_jobs 
ADD COLUMN IF NOT EXISTS mode_tag TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN user_video_jobs.mode_tag IS 'Animation mode tag like "Hug", "Group", "Fun", etc. for UI display';

-- Update existing rows to have a default mode_tag if needed
UPDATE user_video_jobs 
SET mode_tag = 'Life' 
WHERE mode_tag IS NULL;