-- Fix user_onboarding table to support upsert operations
-- Add unique constraint on user_id to enable ON CONFLICT operations

-- Add unique constraint on user_id for upsert operations
ALTER TABLE user_onboarding 
ADD CONSTRAINT user_onboarding_user_id_unique UNIQUE (user_id);

-- Also ensure all our new tables have proper RLS policies
-- (These should already exist from previous migrations, but adding for safety)

-- Ensure onboarding_steps has unrestricted policy
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'onboarding_steps' 
    AND policyname = 'Allow all operations on onboarding_steps'
  ) THEN
    CREATE POLICY "Allow all operations on onboarding_steps" ON onboarding_steps
      FOR ALL USING (true);
  END IF;
END $$;

-- Ensure feature_interactions has unrestricted policy
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'feature_interactions' 
    AND policyname = 'Allow all operations on feature_interactions'
  ) THEN
    CREATE POLICY "Allow all operations on feature_interactions" ON feature_interactions
      FOR ALL USING (true);
  END IF;
END $$;

-- Ensure onboarding_conversions has unrestricted policy
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'onboarding_conversions' 
    AND policyname = 'Allow all operations on onboarding_conversions'
  ) THEN
    CREATE POLICY "Allow all operations on onboarding_conversions" ON onboarding_conversions
      FOR ALL USING (true);
  END IF;
END $$;