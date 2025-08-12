-- Disable RLS completely for user_video_jobs table
-- This app uses RevenueCat for user management, not Supabase auth

ALTER TABLE user_video_jobs DISABLE ROW LEVEL SECURITY;