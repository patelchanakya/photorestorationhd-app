-- Disable RLS on all tables that actually exist - fuck security, we want things to work
ALTER TABLE public.device_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_conversions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restorations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_photo_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unified_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_video_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_video_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_completions DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies on actual tables
DROP POLICY IF EXISTS "Users can view own photo_predictions" ON public.photo_predictions;
DROP POLICY IF EXISTS "Users can insert own photo_predictions" ON public.photo_predictions;
DROP POLICY IF EXISTS "Users can update own photo_predictions" ON public.photo_predictions;
DROP POLICY IF EXISTS "Service role can do anything" ON public.photo_predictions;

DROP POLICY IF EXISTS "Users can view own restorations" ON public.restorations;
DROP POLICY IF EXISTS "Users can insert own restorations" ON public.restorations;
DROP POLICY IF EXISTS "Users can update own restorations" ON public.restorations;
DROP POLICY IF EXISTS "Service role can do anything" ON public.restorations;

-- Make sure anon and authenticated can do whatever they want too
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;