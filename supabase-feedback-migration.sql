-- ============================================
-- Supabase Migration: Add Feedback Table
-- Date: 2025-11-25
-- Description: Creates feedbacks table with all required fields
-- ============================================

-- Create feedbacks table
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id TEXT NOT NULL PRIMARY KEY,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "shotTag" TEXT NOT NULL,
    version TEXT NOT NULL,
    department TEXT NOT NULL,
    "leadName" TEXT,
    status TEXT NOT NULL,
    "feedbackNotes" TEXT,
    "feedbackDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedbacks_showName ON public.feedbacks("showName");
CREATE INDEX IF NOT EXISTS idx_feedbacks_shotName ON public.feedbacks("shotName");
CREATE INDEX IF NOT EXISTS idx_feedbacks_department ON public.feedbacks(department);
CREATE INDEX IF NOT EXISTS idx_feedbacks_leadName ON public.feedbacks("leadName");
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON public.feedbacks(status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_feedbackDate ON public.feedbacks("feedbackDate");
CREATE INDEX IF NOT EXISTS idx_feedbacks_taskId ON public.feedbacks("taskId");

-- Add foreign key constraint to tasks table (optional, but recommended)
-- Uncomment if you want to enforce referential integrity
-- ALTER TABLE public.feedbacks 
-- ADD CONSTRAINT fk_feedbacks_taskId 
-- FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON DELETE SET NULL;

-- NOTE: RLS is NOT enabled because authentication is handled by Next.js API routes
-- Your app uses Prisma + next-auth on the server side, not Supabase client-side auth
-- Enabling RLS would block all database access from your API routes

-- If you need RLS in the future, make sure to:
-- 1. Use service_role key in your API routes, OR
-- 2. Set up proper JWT authentication between Next.js and Supabase, OR  
-- 3. Use permissive policies that allow server-side access

-- Create trigger to auto-update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feedbacks_updated_at
    BEFORE UPDATE ON public.feedbacks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Verification Query
-- Run this to verify the table was created successfully:
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'feedbacks'
-- ORDER BY ordinal_position;
-- ============================================
