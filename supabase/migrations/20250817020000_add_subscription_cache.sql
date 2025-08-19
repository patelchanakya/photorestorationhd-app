-- Subscription Cache Table for Production-Scale Security
-- Caches RevenueCat subscription status to avoid API calls on every request

-- Create subscription_cache table
CREATE TABLE subscription_cache (
  user_id TEXT PRIMARY KEY,
  is_pro BOOLEAN DEFAULT false,
  plan_type TEXT DEFAULT 'free', -- 'free', 'weekly', 'monthly'
  expires_at TIMESTAMPTZ,
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  transaction_id TEXT,
  revenue_cat_user_id TEXT, -- Original RevenueCat user ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_subscription_cache_expires ON subscription_cache(expires_at);
CREATE INDEX idx_subscription_cache_last_verified ON subscription_cache(last_verified);
CREATE INDEX idx_subscription_cache_transaction_id ON subscription_cache(transaction_id);

-- Enable RLS
ALTER TABLE subscription_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all access via service role
CREATE POLICY "Allow all access to subscription_cache" 
ON subscription_cache 
FOR ALL 
USING (true);

-- Grant permissions
GRANT ALL ON subscription_cache TO authenticated;
GRANT ALL ON subscription_cache TO anon;

-- Function to check if cache is stale (older than 1 hour)
CREATE OR REPLACE FUNCTION is_subscription_cache_stale(
  p_last_verified TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Cache is stale if:
  -- 1. Last verified > 1 hour ago
  -- 2. OR subscription expires within 24 hours and not verified in 10 minutes
  -- 3. OR no last_verified timestamp
  
  IF p_last_verified IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- If subscription expires within 24 hours, refresh more frequently
  IF p_expires_at IS NOT NULL AND p_expires_at <= NOW() + INTERVAL '24 hours' THEN
    RETURN p_last_verified < NOW() - INTERVAL '10 minutes';
  END IF;
  
  -- Standard cache duration: 1 hour
  RETURN p_last_verified < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to get cached subscription status
CREATE OR REPLACE FUNCTION get_cached_subscription_status(
  p_user_id TEXT
) RETURNS TABLE(
  is_pro BOOLEAN,
  plan_type TEXT,
  expires_at TIMESTAMPTZ,
  is_stale BOOLEAN,
  cache_age_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.is_pro,
    sc.plan_type,
    sc.expires_at,
    is_subscription_cache_stale(sc.last_verified, sc.expires_at) as is_stale,
    ROUND(EXTRACT(EPOCH FROM (NOW() - sc.last_verified))/60)::INTEGER as cache_age_minutes
  FROM subscription_cache sc
  WHERE sc.user_id = p_user_id;
  
  -- If no cache entry exists, return default values with stale=true
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, 'free'::TEXT, NULL::TIMESTAMPTZ, true::BOOLEAN, 99999::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update subscription cache
CREATE OR REPLACE FUNCTION update_subscription_cache(
  p_user_id TEXT,
  p_is_pro BOOLEAN,
  p_plan_type TEXT DEFAULT 'free',
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_transaction_id TEXT DEFAULT NULL,
  p_revenue_cat_user_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO subscription_cache (
    user_id, 
    is_pro, 
    plan_type, 
    expires_at, 
    last_verified, 
    transaction_id,
    revenue_cat_user_id,
    updated_at
  ) VALUES (
    p_user_id,
    p_is_pro,
    p_plan_type,
    p_expires_at,
    NOW(),
    p_transaction_id,
    p_revenue_cat_user_id,
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    is_pro = EXCLUDED.is_pro,
    plan_type = EXCLUDED.plan_type,
    expires_at = EXCLUDED.expires_at,
    last_verified = NOW(),
    transaction_id = EXCLUDED.transaction_id,
    revenue_cat_user_id = EXCLUDED.revenue_cat_user_id,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache for a user (force refresh)
CREATE OR REPLACE FUNCTION invalidate_subscription_cache(
  p_user_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE subscription_cache 
  SET last_verified = NOW() - INTERVAL '2 hours'  -- Force stale
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old cache entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_subscription_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  additional_count INTEGER;
BEGIN
  -- Delete cache entries older than 30 days for free users
  -- Keep Pro user cache longer for analytics
  DELETE FROM subscription_cache 
  WHERE updated_at < NOW() - INTERVAL '30 days'
  AND plan_type = 'free';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete expired Pro subscriptions older than 7 days
  DELETE FROM subscription_cache
  WHERE expires_at < NOW() - INTERVAL '7 days'
  AND is_pro = false;
  
  GET DIAGNOSTICS additional_count = ROW_COUNT;
  deleted_count := deleted_count + additional_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_subscription_cache_stale(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION is_subscription_cache_stale(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION get_cached_subscription_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cached_subscription_status(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_subscription_cache(TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_subscription_cache(TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION invalidate_subscription_cache(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION invalidate_subscription_cache(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_subscription_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_subscription_cache() TO anon;

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_cache_updated_at
  BEFORE UPDATE ON subscription_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_cache_updated_at();

-- Comments for documentation
COMMENT ON TABLE subscription_cache IS 
'Caches RevenueCat subscription status to avoid API rate limits. Refreshed periodically and via webhooks.';

COMMENT ON COLUMN subscription_cache.user_id IS 
'User tracking ID (stable:{uuid} for free users, transaction ID for Pro users)';

COMMENT ON COLUMN subscription_cache.last_verified IS 
'When subscription status was last verified with RevenueCat API';

COMMENT ON COLUMN subscription_cache.expires_at IS 
'When subscription expires (NULL for lifetime/free users)';

COMMENT ON FUNCTION get_cached_subscription_status(TEXT) IS 
'Returns cached subscription status with staleness indicator for smart refresh logic';

COMMENT ON FUNCTION update_subscription_cache(TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, TEXT) IS 
'Updates subscription cache from RevenueCat API calls or webhook events';