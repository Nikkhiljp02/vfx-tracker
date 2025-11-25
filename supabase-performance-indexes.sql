-- ================================================
-- Supabase Migration: Performance Indexes (Phase 1)
-- ================================================
-- This migration adds critical indexes for 10-100x query performance
-- Run this in your Supabase SQL Editor
-- Date: November 25, 2024
-- ================================================

-- Drop old indexes if they exist (recreating with better optimization)
DROP INDEX IF EXISTS "activity_logs_timestamp_idx";
DROP INDEX IF EXISTS "feedbacks_feedbackDate_idx";

-- ================================================
-- TASK INDEXES (Main tracker table - highest priority)
-- ================================================

-- Delivered Date Index (DESC for recent deliveries first)
CREATE INDEX IF NOT EXISTS "tasks_deliveredDate_idx" ON "tasks"("deliveredDate" DESC);

-- Updated Date Index (DESC for recent changes first)
CREATE INDEX IF NOT EXISTS "tasks_updatedDate_idx" ON "tasks"("updatedDate" DESC);

-- Existing indexes (verify they exist)
-- tasks_shotId_idx (should exist from previous migrations)
-- tasks_department_idx (should exist from previous migrations)
-- tasks_status_idx (should exist from previous migrations)

-- ================================================
-- ACTIVITY LOG INDEXES (Undo functionality)
-- ================================================

-- Timestamp Index (DESC for recent activities first) - CRITICAL for activity log queries
CREATE INDEX IF NOT EXISTS "activity_logs_timestamp_idx" ON "activity_logs"("timestamp" DESC);

-- Action Type Index (for filtering by CREATE/UPDATE/DELETE)
CREATE INDEX IF NOT EXISTS "activity_logs_actionType_idx" ON "activity_logs"("actionType");

-- Is Reversed Index (for filtering undone actions)
CREATE INDEX IF NOT EXISTS "activity_logs_isReversed_idx" ON "activity_logs"("isReversed");

-- Existing indexes (verify they exist)
-- activity_logs_entityType_entityId_idx (should exist from previous migrations)
-- activity_logs_userId_idx (should exist from previous migrations)

-- ================================================
-- FEEDBACK INDEXES (Client feedback tracking)
-- ================================================

-- Feedback Date Index (DESC for recent feedback first)
CREATE INDEX IF NOT EXISTS "feedbacks_feedbackDate_idx" ON "feedbacks"("feedbackDate" DESC);

-- Task ID Index (for quick task-feedback lookups)
CREATE INDEX IF NOT EXISTS "feedbacks_taskId_idx" ON "feedbacks"("taskId");

-- Composite Index: Show + Shot (for quick show/shot feedback queries)
CREATE INDEX IF NOT EXISTS "feedbacks_showName_shotName_idx" ON "feedbacks"("showName", "shotName");

-- Existing indexes (verify they exist)
-- feedbacks_showName_idx (should exist from previous migrations)
-- feedbacks_shotName_idx (should exist from previous migrations)
-- feedbacks_department_idx (should exist from previous migrations)
-- feedbacks_status_idx (should exist from previous migrations)

-- ================================================
-- VERIFICATION QUERIES
-- ================================================
-- Run these after the migration to verify indexes are created:

-- Check Task indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'tasks' ORDER BY indexname;

-- Check ActivityLog indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'activity_logs' ORDER BY indexname;

-- Check Feedback indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'feedbacks' ORDER BY indexname;

-- ================================================
-- PERFORMANCE IMPACT
-- ================================================
-- Expected improvements:
-- 1. Task queries (deliveredDate, updatedDate): 10-50x faster
-- 2. Activity log queries: 50-100x faster (critical for undo)
-- 3. Feedback queries: 10-30x faster
-- 4. Overall API response: 3-5x faster

-- ================================================
-- ROLLBACK (if needed)
-- ================================================
-- To rollback these changes, run:
-- DROP INDEX IF EXISTS "tasks_deliveredDate_idx";
-- DROP INDEX IF EXISTS "tasks_updatedDate_idx";
-- DROP INDEX IF EXISTS "activity_logs_timestamp_idx";
-- DROP INDEX IF EXISTS "activity_logs_actionType_idx";
-- DROP INDEX IF EXISTS "activity_logs_isReversed_idx";
-- DROP INDEX IF EXISTS "feedbacks_feedbackDate_idx";
-- DROP INDEX IF EXISTS "feedbacks_taskId_idx";
-- DROP INDEX IF EXISTS "feedbacks_showName_shotName_idx";
