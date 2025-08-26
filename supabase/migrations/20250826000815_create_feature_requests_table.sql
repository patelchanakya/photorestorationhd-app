-- Create feature_requests table
CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_text TEXT NOT NULL,
  user_email TEXT,
  device_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS (Row Level Security) policy to allow inserts from anyone
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to insert feature requests
CREATE POLICY "Anyone can insert feature requests" ON feature_requests
  FOR INSERT
  WITH CHECK (true);

-- Policy to allow reading feature requests (for admin purposes)
CREATE POLICY "Allow read access to feature requests" ON feature_requests
  FOR SELECT
  USING (true);

-- Create index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON feature_requests(created_at DESC);