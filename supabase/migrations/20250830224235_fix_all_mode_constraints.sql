-- Fix all mode constraints to include all the modes that are actually being used
-- Drop the existing constraint
ALTER TABLE photo_predictions DROP CONSTRAINT IF EXISTS valid_mode;

-- Add the new constraint with ALL modes that functions are actually using
ALTER TABLE photo_predictions ADD CONSTRAINT valid_mode 
CHECK (mode IN ('repair', 'outfit', 'background', 'enhance', 'custom', 'memorial', 'water_damage', 'restoration'));

-- Update the comment to reflect all modes
COMMENT ON COLUMN photo_predictions.mode IS 
'AI processing mode: repair, outfit, background, enhance, custom, memorial, water_damage, restoration';
