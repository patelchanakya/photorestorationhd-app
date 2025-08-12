-- Create user_video_jobs table for video persistence and recovery
CREATE TABLE IF NOT EXISTS user_video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  prediction_id TEXT UNIQUE NOT NULL,
  image_uri TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('starting', 'processing', 'completed', 'failed', 'downloaded', 'expired')),
  video_url TEXT,
  local_video_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  webhook_received_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_video_jobs_user_id ON user_video_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_video_jobs_status ON user_video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_user_video_jobs_prediction_id ON user_video_jobs(prediction_id);
CREATE INDEX IF NOT EXISTS idx_user_video_jobs_created_at ON user_video_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_video_jobs_expires_at ON user_video_jobs(expires_at);

-- Function to get pending videos for a user
CREATE OR REPLACE FUNCTION get_pending_videos(p_user_id TEXT)
RETURNS TABLE (
  id UUID,
  prediction_id TEXT,
  status TEXT,
  video_url TEXT,
  local_video_path TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vj.id,
    vj.prediction_id,
    vj.status,
    vj.video_url,
    vj.local_video_path,
    vj.created_at,
    vj.expires_at
  FROM user_video_jobs vj
  WHERE vj.user_id = p_user_id
    AND vj.status IN ('starting', 'processing', 'completed')
    AND (vj.local_video_path IS NULL OR vj.local_video_path = '')
  ORDER BY vj.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark video as downloaded
CREATE OR REPLACE FUNCTION mark_video_downloaded(
  p_prediction_id TEXT,
  p_local_path TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_video_jobs
  SET 
    status = 'downloaded',
    local_video_path = p_local_path,
    downloaded_at = NOW()
  WHERE prediction_id = p_prediction_id
    AND status IN ('completed', 'processing');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired videos
CREATE OR REPLACE FUNCTION cleanup_expired_videos()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_video_jobs
  SET status = 'expired'
  WHERE status IN ('starting', 'processing', 'completed')
    AND expires_at < NOW()
    AND (local_video_path IS NULL OR local_video_path = '');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE user_video_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own video jobs"
  ON user_video_jobs FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert their own video jobs"
  ON user_video_jobs FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update their own video jobs"
  ON user_video_jobs FOR UPDATE
  USING (auth.uid()::TEXT = user_id);