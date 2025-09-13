-- Add nano modes to photo_predictions mode constraint
-- This migration adds all the nano-banana modes that are actually being used

-- Drop the existing constraint
ALTER TABLE photo_predictions DROP CONSTRAINT IF EXISTS valid_mode;

-- Add the new constraint with ALL modes including nano modes
ALTER TABLE photo_predictions ADD CONSTRAINT valid_mode
CHECK (mode IN ('repair', 'outfit', 'background', 'enhance', 'custom', 'memorial', 'water_damage', 'restoration', 'nano_banana', 'nano_outfit', 'nano_background', 'nano_memorial', 'nano_repair', 'nano_water_damage', 'nano_restoration'));

-- Update the comment to reflect all modes
COMMENT ON COLUMN photo_predictions.mode IS
'AI processing mode: repair, outfit, background, enhance, custom, memorial, water_damage, restoration, nano_banana, nano_outfit, nano_background, nano_memorial, nano_repair, nano_water_damage, nano_restoration';