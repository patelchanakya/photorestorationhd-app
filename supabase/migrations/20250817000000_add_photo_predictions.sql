-- Photo Predictions Table for Webhook-based AI Generation
-- Tracks all photo AI processing jobs (repair, outfit, background, etc.)

CREATE TABLE photo_predictions (
  id TEXT PRIMARY KEY,                    -- prediction_id from Replicate
  user_id TEXT,                          -- tracking who made request (from getPhotoTrackingId)
  mode TEXT NOT NULL,                    -- 'repair', 'outfit', 'background', 'enhance'
  style_key TEXT,                        -- 'outfit-1', 'bg-2', etc (for specific styles)
  status TEXT NOT NULL DEFAULT 'starting', -- 'starting', 'processing', 'succeeded', 'failed', 'canceled'
  input JSONB,                           -- Store input params (prompt, style info, etc)
  output TEXT,                           -- Output image URL when complete
  error TEXT,                            -- Error message if failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB,                        -- Additional data (processing time, etc)
  
  -- Add constraints
  CONSTRAINT valid_status CHECK (status IN ('starting', 'processing', 'succeeded', 'failed', 'canceled')),
  CONSTRAINT valid_mode CHECK (mode IN ('repair', 'outfit', 'background', 'enhance', 'custom', 'memorial', 'water_damage', 'restoration'))
);

-- Add indexes for performance
CREATE INDEX idx_photo_predictions_user_id ON photo_predictions(user_id);
CREATE INDEX idx_photo_predictions_status ON photo_predictions(status);
CREATE INDEX idx_photo_predictions_mode ON photo_predictions(mode);
CREATE INDEX idx_photo_predictions_created_at ON photo_predictions(created_at);

-- Add RLS (Row Level Security)
ALTER TABLE photo_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all for now (we control access via edge functions)
CREATE POLICY "Allow all access to photo_predictions" 
ON photo_predictions 
FOR ALL 
USING (true);

-- Grant permissions to authenticated and anon users
GRANT ALL ON photo_predictions TO authenticated;
GRANT ALL ON photo_predictions TO anon;

-- Add helpful functions

-- Function to clean up old predictions (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_photo_predictions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM photo_predictions 
  WHERE created_at < NOW() - INTERVAL '24 hours'
  AND status IN ('succeeded', 'failed', 'canceled');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on cleanup function
GRANT EXECUTE ON FUNCTION cleanup_old_photo_predictions() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_photo_predictions() TO anon;

COMMENT ON TABLE photo_predictions IS 
'Tracks AI photo processing jobs using webhooks. Stores prediction metadata and results for client polling.';

COMMENT ON COLUMN photo_predictions.id IS 
'Replicate prediction ID - used to track job status and receive webhook updates';

COMMENT ON COLUMN photo_predictions.user_id IS 
'Tracking ID from getPhotoTrackingId() - used for usage limits and attribution';

COMMENT ON COLUMN photo_predictions.mode IS 
'AI processing mode: repair, outfit, background, enhance, custom, memorial, water_damage, restoration';

COMMENT ON COLUMN photo_predictions.style_key IS 
'Specific style variant like outfit-1 (Fix Clothes), bg-2 (Heavenly), etc';

COMMENT ON FUNCTION cleanup_old_photo_predictions() IS 
'Cleans up completed predictions older than 24 hours to prevent database bloat';