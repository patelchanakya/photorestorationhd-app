-- Create feature_interactions table for detailed feature interest tracking
CREATE TABLE IF NOT EXISTS feature_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id UUID NOT NULL,
  feature_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('viewed', 'selected', 'deselected', 'tried', 'completed')),
  interaction_order INTEGER, -- Track selection order within session
  interaction_duration_ms INTEGER, -- How long they looked at/interacted with feature
  feature_metadata JSONB DEFAULT '{}', -- Additional context like custom prompts, style selections
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_feature_interactions_user_id ON feature_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_interactions_session_id ON feature_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_feature_interactions_feature_id ON feature_interactions(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_interactions_interaction_type ON feature_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_feature_interactions_created_at ON feature_interactions(created_at);

-- Create composite index for feature popularity analysis
CREATE INDEX IF NOT EXISTS idx_feature_interactions_popularity ON feature_interactions(feature_id, interaction_type, created_at);

-- Create composite index for user journey analysis
CREATE INDEX IF NOT EXISTS idx_feature_interactions_journey ON feature_interactions(user_id, session_id, interaction_order, created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE feature_interactions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (no auth required for analytics)
CREATE POLICY "Allow all operations on feature_interactions" ON feature_interactions
  FOR ALL USING (true);

-- Create function to get feature popularity stats
CREATE OR REPLACE FUNCTION get_feature_popularity_stats(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  feature_id TEXT,
  interaction_type TEXT,
  interaction_count BIGINT,
  unique_users BIGINT,
  avg_interaction_duration_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fi.feature_id,
    fi.interaction_type,
    COUNT(*) as interaction_count,
    COUNT(DISTINCT fi.user_id) as unique_users,
    AVG(fi.interaction_duration_ms) as avg_interaction_duration_ms
  FROM feature_interactions fi
  WHERE fi.created_at >= NOW() - INTERVAL '%s days'
  GROUP BY fi.feature_id, fi.interaction_type
  ORDER BY interaction_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user feature journey
CREATE OR REPLACE FUNCTION get_user_feature_journey(
  p_user_id TEXT,
  p_session_id UUID DEFAULT NULL
)
RETURNS TABLE (
  feature_id TEXT,
  interaction_type TEXT,
  interaction_order INTEGER,
  interaction_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fi.feature_id,
    fi.interaction_type,
    fi.interaction_order,
    fi.interaction_duration_ms,
    fi.created_at
  FROM feature_interactions fi
  WHERE fi.user_id = p_user_id
    AND (p_session_id IS NULL OR fi.session_id = p_session_id)
  ORDER BY fi.created_at ASC, fi.interaction_order ASC;
END;
$$ LANGUAGE plpgsql;