-- Create onboarding_conversions table for tracking conversion events
CREATE TABLE IF NOT EXISTS onboarding_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id UUID, -- Link to onboarding session
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('free_trial', 'subscription', 'first_edit', 'share', 'app_review', 'referral')),
  conversion_value DECIMAL(10,2), -- Revenue value if applicable
  time_to_convert_hours INTEGER, -- Hours from onboarding start to conversion
  trigger_feature TEXT, -- Which feature or step triggered the conversion
  conversion_metadata JSONB DEFAULT '{}', -- Additional context like subscription tier, share platform, etc.
  revenue_cat_transaction_id TEXT, -- Link to RevenueCat transaction
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_onboarding_conversions_user_id ON onboarding_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_conversions_session_id ON onboarding_conversions(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_conversions_conversion_type ON onboarding_conversions(conversion_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_conversions_trigger_feature ON onboarding_conversions(trigger_feature);
CREATE INDEX IF NOT EXISTS idx_onboarding_conversions_created_at ON onboarding_conversions(created_at);

-- Create composite index for conversion analysis
CREATE INDEX IF NOT EXISTS idx_onboarding_conversions_analysis ON onboarding_conversions(conversion_type, trigger_feature, created_at);

-- Enable RLS (Row Level Security)  
ALTER TABLE onboarding_conversions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (no auth required for analytics)
CREATE POLICY "Allow all operations on onboarding_conversions" ON onboarding_conversions
  FOR ALL USING (true);

-- Create function to calculate conversion rates
CREATE OR REPLACE FUNCTION get_conversion_rates(
  days_back INTEGER DEFAULT 30,
  conversion_type_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  conversion_type TEXT,
  trigger_feature TEXT,
  conversion_count BIGINT,
  total_users_with_feature BIGINT,
  conversion_rate NUMERIC,
  avg_time_to_convert_hours NUMERIC,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oc.conversion_type,
    oc.trigger_feature,
    COUNT(oc.id) as conversion_count,
    COUNT(DISTINCT uo.user_id) as total_users_with_feature,
    CASE 
      WHEN COUNT(DISTINCT uo.user_id) > 0 
      THEN (COUNT(oc.id)::NUMERIC / COUNT(DISTINCT uo.user_id)::NUMERIC) * 100
      ELSE 0 
    END as conversion_rate,
    AVG(oc.time_to_convert_hours) as avg_time_to_convert_hours,
    COALESCE(SUM(oc.conversion_value), 0) as total_revenue
  FROM onboarding_conversions oc
  LEFT JOIN user_onboarding uo ON oc.user_id = uo.user_id
  WHERE oc.created_at >= NOW() - INTERVAL '%s days'
    AND (conversion_type_filter IS NULL OR oc.conversion_type = conversion_type_filter)
  GROUP BY oc.conversion_type, oc.trigger_feature
  ORDER BY conversion_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user conversion timeline
CREATE OR REPLACE FUNCTION get_user_conversion_timeline(
  p_user_id TEXT
)
RETURNS TABLE (
  conversion_type TEXT,
  conversion_value DECIMAL,
  trigger_feature TEXT,
  time_to_convert_hours INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oc.conversion_type,
    oc.conversion_value,
    oc.trigger_feature,
    oc.time_to_convert_hours,
    oc.created_at
  FROM onboarding_conversions oc
  WHERE oc.user_id = p_user_id
  ORDER BY oc.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to track conversion events
CREATE OR REPLACE FUNCTION track_conversion_event(
  p_user_id TEXT,
  p_session_id UUID,
  p_conversion_type TEXT,
  p_conversion_value DECIMAL DEFAULT NULL,
  p_trigger_feature TEXT DEFAULT NULL,
  p_conversion_metadata JSONB DEFAULT '{}',
  p_revenue_cat_transaction_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  conversion_id UUID;
  onboarding_start_time TIMESTAMP WITH TIME ZONE;
  hours_to_convert INTEGER;
BEGIN
  -- Get onboarding start time to calculate conversion time
  SELECT created_at INTO onboarding_start_time
  FROM user_onboarding
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Calculate hours to convert
  IF onboarding_start_time IS NOT NULL THEN
    hours_to_convert := EXTRACT(EPOCH FROM (NOW() - onboarding_start_time)) / 3600;
  END IF;
  
  -- Insert conversion record
  INSERT INTO onboarding_conversions (
    user_id,
    session_id,
    conversion_type,
    conversion_value,
    time_to_convert_hours,
    trigger_feature,
    conversion_metadata,
    revenue_cat_transaction_id
  ) VALUES (
    p_user_id,
    p_session_id,
    p_conversion_type,
    p_conversion_value,
    hours_to_convert,
    p_trigger_feature,
    p_conversion_metadata,
    p_revenue_cat_transaction_id
  )
  RETURNING id INTO conversion_id;
  
  RETURN conversion_id;
END;
$$ LANGUAGE plpgsql;