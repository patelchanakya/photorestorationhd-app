-- Fix the mode constraint to include 'memorial' mode
-- Drop the existing constraint
ALTER TABLE photo_predictions DROP CONSTRAINT IF EXISTS valid_mode;

-- Add the new constraint with memorial mode included
ALTER TABLE photo_predictions ADD CONSTRAINT valid_mode 
CHECK (mode IN ('repair', 'outfit', 'background', 'enhance', 'custom', 'memorial'));

-- Update the comment
COMMENT ON COLUMN photo_predictions.mode IS 
'AI processing mode: repair, outfit, background, enhance, custom, memorial';
