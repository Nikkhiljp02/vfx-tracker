-- ============================================
-- URGENT FIX: Disable RLS or Add Bypass Policies
-- This will allow data to be fetched in production
-- ============================================

-- Option 1: Disable RLS on all main tables (Quick Fix)
-- Run this if you want to quickly restore data access

ALTER TABLE public.shows DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks DISABLE ROW LEVEL SECURITY;

-- ============================================
-- OR Option 2: Add permissive policies (Better for production)
-- Run this if you want to keep RLS enabled but allow access
-- ============================================

-- Shows table policies
DROP POLICY IF EXISTS "Allow all access to shows" ON public.shows;
CREATE POLICY "Allow all access to shows" 
ON public.shows 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Shots table policies
DROP POLICY IF EXISTS "Allow all access to shots" ON public.shots;
CREATE POLICY "Allow all access to shots" 
ON public.shots 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Tasks table policies
DROP POLICY IF EXISTS "Allow all access to tasks" ON public.tasks;
CREATE POLICY "Allow all access to tasks" 
ON public.tasks 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Departments table policies
DROP POLICY IF EXISTS "Allow all access to departments" ON public.departments;
CREATE POLICY "Allow all access to departments" 
ON public.departments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Status options table policies
DROP POLICY IF EXISTS "Allow all access to status_options" ON public.status_options;
CREATE POLICY "Allow all access to status_options" 
ON public.status_options 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Feedbacks table policies (replace restrictive ones)
DROP POLICY IF EXISTS "Allow authenticated users to read feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Allow authenticated users to insert feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Allow authenticated users to update feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "Allow authenticated users to delete feedbacks" ON public.feedbacks;

CREATE POLICY "Allow all access to feedbacks" 
ON public.feedbacks 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- ============================================
-- Verification: Check if RLS is enabled
-- ============================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('shows', 'shots', 'tasks', 'departments', 'status_options', 'feedbacks')
ORDER BY tablename;

-- ============================================
-- Check existing policies
-- ============================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
