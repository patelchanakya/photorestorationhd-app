-- Create restorations table
CREATE TABLE IF NOT EXISTS public.restorations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT, -- Changed from UUID to TEXT to allow 'anonymous'
  original_filename TEXT NOT NULL,
  restored_filename TEXT,
  thumbnail_filename TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  prediction_id TEXT,
  webhook_status TEXT
);

-- Add indexes
CREATE INDEX idx_restorations_user_id ON public.restorations(user_id);
CREATE INDEX idx_restorations_status ON public.restorations(status);
CREATE INDEX idx_restorations_created_at ON public.restorations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.restorations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow public access for anonymous users)
CREATE POLICY "Allow public access" ON public.restorations
  FOR ALL USING (true);