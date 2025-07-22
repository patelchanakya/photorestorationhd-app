-- Create device_usage table for tracking free generation limits per device
CREATE TABLE IF NOT EXISTS public.device_usage (
  device_id TEXT PRIMARY KEY,
  free_restorations_used INTEGER DEFAULT 0,
  last_reset_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX idx_device_usage_last_reset_date ON public.device_usage(last_reset_date);
CREATE INDEX idx_device_usage_updated_at ON public.device_usage(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.device_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow public access for device tracking)
CREATE POLICY "Allow public access" ON public.device_usage
  FOR ALL USING (true);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_device_usage_updated_at 
  BEFORE UPDATE ON public.device_usage 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add function_type column to restorations table if it doesn't exist
ALTER TABLE public.restorations ADD COLUMN IF NOT EXISTS function_type TEXT DEFAULT 'restoration';