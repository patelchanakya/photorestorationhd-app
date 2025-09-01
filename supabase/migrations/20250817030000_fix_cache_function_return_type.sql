-- Fix return type mismatch in get_cached_subscription_status function
-- The cache_age_minutes should return INTEGER, not NUMERIC

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_cached_subscription_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cached_subscription_status(TEXT) TO anon;