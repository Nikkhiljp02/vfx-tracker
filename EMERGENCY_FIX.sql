-- ============================================
-- EMERGENCY FIX: Restore Database Access
-- Run this IMMEDIATELY in Supabase SQL Editor
-- ============================================

-- Step 1: Disable RLS on ALL tables to restore access
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shows DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.status_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feedbacks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.verification_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.show_access DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shot_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delivery_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.execution_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.login_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_notification_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resource_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resource_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.award_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_views DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all restrictive policies on feedbacks
DROP POLICY IF EXISTS "Allow authenticated users to read feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Allow authenticated users to insert feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Allow authenticated users to update feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Allow authenticated users to delete feedbacks" ON public.feedbacks;

-- Step 3: Verify RLS is disabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- If the query above shows rls_enabled = true for any table, 
-- manually disable it with: ALTER TABLE public.[table_name] DISABLE ROW LEVEL SECURITY;

-- Step 4: Test data access
SELECT COUNT(*) as user_count FROM public.users;
SELECT COUNT(*) as show_count FROM public.shows;
SELECT COUNT(*) as task_count FROM public.tasks;

-- ============================================
-- After running this, your app should work again!
-- Login should work and data should appear
-- ============================================
