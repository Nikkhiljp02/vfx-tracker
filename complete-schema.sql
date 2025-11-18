-- Complete Database Schema for VFX Tracker
-- Run this in Supabase SQL Editor to create all tables

-- ============================================
-- AUTHENTICATION & USER MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_role_isActive_idx" ON "users"("role", "isActive");
CREATE INDEX IF NOT EXISTS "users_isActive_idx" ON "users"("isActive");

-- Sessions
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_sessionToken_key" ON "sessions"("sessionToken");
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_userId_fkey";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- SHOWS & SHOTS
-- ============================================

CREATE TABLE IF NOT EXISTS "shows" (
    "id" TEXT NOT NULL,
    "showName" TEXT NOT NULL,
    "clientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "departments" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    
    CONSTRAINT "shows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shows_status_idx" ON "shows"("status");
CREATE INDEX IF NOT EXISTS "shows_showName_idx" ON "shows"("showName");
CREATE INDEX IF NOT EXISTS "shows_createdDate_idx" ON "shows"("createdDate" DESC);

CREATE TABLE IF NOT EXISTS "shots" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "episode" TEXT,
    "sequence" TEXT,
    "turnover" TEXT,
    "frames" INTEGER,
    "shotTag" TEXT NOT NULL DEFAULT 'Fresh',
    "parentShotId" TEXT,
    "scopeOfWork" TEXT,
    "remark" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "shots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shots_showId_idx" ON "shots"("showId");
CREATE INDEX IF NOT EXISTS "shots_shotName_idx" ON "shots"("shotName");
CREATE INDEX IF NOT EXISTS "shots_shotTag_idx" ON "shots"("shotTag");
CREATE INDEX IF NOT EXISTS "shots_episode_idx" ON "shots"("episode");
CREATE INDEX IF NOT EXISTS "shots_sequence_idx" ON "shots"("sequence");
CREATE INDEX IF NOT EXISTS "shots_turnover_idx" ON "shots"("turnover");
CREATE INDEX IF NOT EXISTS "shots_createdDate_idx" ON "shots"("createdDate" DESC);
CREATE INDEX IF NOT EXISTS "shots_showId_shotName_idx" ON "shots"("showId", "shotName");

ALTER TABLE "shots" DROP CONSTRAINT IF EXISTS "shots_showId_fkey";
ALTER TABLE "shots" ADD CONSTRAINT "shots_showId_fkey" 
    FOREIGN KEY ("showId") REFERENCES "shows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shots" DROP CONSTRAINT IF EXISTS "shots_parentShotId_fkey";
ALTER TABLE "shots" ADD CONSTRAINT "shots_parentShotId_fkey" 
    FOREIGN KEY ("parentShotId") REFERENCES "shots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- TASKS
-- ============================================

CREATE TABLE IF NOT EXISTS "tasks" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'YTS',
    "leadName" TEXT,
    "bidMds" DOUBLE PRECISION,
    "internalEta" TIMESTAMP(3),
    "clientEta" TIMESTAMP(3),
    "deliveredVersion" TEXT,
    "deliveredDate" TIMESTAMP(3),
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tasks_shotId_idx" ON "tasks"("shotId");
CREATE INDEX IF NOT EXISTS "tasks_department_idx" ON "tasks"("department");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status");
CREATE INDEX IF NOT EXISTS "tasks_leadName_idx" ON "tasks"("leadName");
CREATE INDEX IF NOT EXISTS "tasks_isInternal_idx" ON "tasks"("isInternal");
CREATE INDEX IF NOT EXISTS "tasks_internalEta_idx" ON "tasks"("internalEta");
CREATE INDEX IF NOT EXISTS "tasks_clientEta_idx" ON "tasks"("clientEta");
CREATE INDEX IF NOT EXISTS "tasks_shotId_department_idx" ON "tasks"("shotId", "department");
CREATE INDEX IF NOT EXISTS "tasks_status_department_idx" ON "tasks"("status", "department");

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_shotId_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_shotId_fkey" 
    FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- DEPARTMENTS & STATUS OPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS "departments" (
    "id" TEXT NOT NULL,
    "deptName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "departments_deptName_key" ON "departments"("deptName");
CREATE INDEX IF NOT EXISTS "departments_isActive_idx" ON "departments"("isActive");

CREATE TABLE IF NOT EXISTS "status_options" (
    "id" TEXT NOT NULL,
    "statusName" TEXT NOT NULL,
    "statusOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "colorCode" TEXT NOT NULL DEFAULT '#6B7280',
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "status_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "status_options_statusName_key" ON "status_options"("statusName");
CREATE INDEX IF NOT EXISTS "status_options_isActive_statusOrder_idx" ON "status_options"("isActive", "statusOrder");

-- ============================================
-- ACTIVITY & NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "fullEntityData" TEXT,
    "userName" TEXT,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "activity_logs_userId_idx" ON "activity_logs"("userId");

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "relatedName" TEXT,
    "sourceUserId" TEXT,
    "sourceUserName" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "notifications_createdDate_idx" ON "notifications"("createdDate");

CREATE TABLE IF NOT EXISTS "shot_notes" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" TEXT,
    "attachments" TEXT,
    "userName" TEXT NOT NULL DEFAULT 'User',
    "userId" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    
    CONSTRAINT "shot_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shot_notes_shotId_idx" ON "shot_notes"("shotId");
CREATE INDEX IF NOT EXISTS "shot_notes_createdDate_idx" ON "shot_notes"("createdDate");
CREATE INDEX IF NOT EXISTS "shot_notes_userId_idx" ON "shot_notes"("userId");

ALTER TABLE "shot_notes" DROP CONSTRAINT IF EXISTS "shot_notes_shotId_fkey";
ALTER TABLE "shot_notes" ADD CONSTRAINT "shot_notes_shotId_fkey" 
    FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- DELIVERY SCHEDULING
-- ============================================

CREATE TABLE IF NOT EXISTS "delivery_schedules" (
    "id" TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL,
    "dateOption" TEXT NOT NULL,
    "specificDate" TEXT,
    "customFrom" TEXT,
    "customTo" TEXT,
    "scheduledTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sendDirectly" BOOLEAN NOT NULL DEFAULT true,
    "lastExecuted" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "delivery_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "delivery_schedules_isActive_scheduledTime_idx" ON "delivery_schedules"("isActive", "scheduledTime");
CREATE INDEX IF NOT EXISTS "delivery_schedules_scheduleType_idx" ON "delivery_schedules"("scheduleType");

CREATE TABLE IF NOT EXISTS "schedule_execution_logs" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "dateOption" TEXT NOT NULL,
    "dateRange" TEXT,
    "deliveryCount" INTEGER,
    "errorMessage" TEXT,
    "sendDirectly" BOOLEAN NOT NULL,
    
    CONSTRAINT "schedule_execution_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "schedule_execution_logs_scheduleId_executedAt_idx" ON "schedule_execution_logs"("scheduleId", "executedAt");

ALTER TABLE "schedule_execution_logs" DROP CONSTRAINT IF EXISTS "schedule_execution_logs_scheduleId_fkey";
ALTER TABLE "schedule_execution_logs" ADD CONSTRAINT "schedule_execution_logs_scheduleId_fkey" 
    FOREIGN KEY ("scheduleId") REFERENCES "delivery_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- RESOURCE MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS "resource_members" (
    "id" TEXT NOT NULL,
    "empId" TEXT NOT NULL,
    "empName" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "reportingTo" TEXT,
    "department" TEXT NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'Day',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "resource_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resource_members_empId_key" ON "resource_members"("empId");
CREATE INDEX IF NOT EXISTS "resource_members_department_idx" ON "resource_members"("department");
CREATE INDEX IF NOT EXISTS "resource_members_isActive_idx" ON "resource_members"("isActive");
CREATE INDEX IF NOT EXISTS "resource_members_empId_idx" ON "resource_members"("empId");

CREATE TABLE IF NOT EXISTS "resource_allocations" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL,
    "manDays" DOUBLE PRECISION NOT NULL,
    "isLeave" BOOLEAN NOT NULL DEFAULT false,
    "isIdle" BOOLEAN NOT NULL DEFAULT false,
    "isWeekendWorking" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "resource_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "resource_allocations_resourceId_idx" ON "resource_allocations"("resourceId");
CREATE INDEX IF NOT EXISTS "resource_allocations_allocationDate_idx" ON "resource_allocations"("allocationDate");
CREATE INDEX IF NOT EXISTS "resource_allocations_showName_idx" ON "resource_allocations"("showName");
CREATE INDEX IF NOT EXISTS "resource_allocations_shotName_idx" ON "resource_allocations"("shotName");
CREATE INDEX IF NOT EXISTS "resource_allocations_resourceId_allocationDate_idx" ON "resource_allocations"("resourceId", "allocationDate");

ALTER TABLE "resource_allocations" DROP CONSTRAINT IF EXISTS "resource_allocations_resourceId_fkey";
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_resourceId_fkey" 
    FOREIGN KEY ("resourceId") REFERENCES "resource_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- AWARD SHEET
-- ============================================

CREATE TABLE IF NOT EXISTS "award_sheets" (
    "id" TEXT NOT NULL,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "customFields" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "award_sheets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "award_sheets_showName_idx" ON "award_sheets"("showName");
CREATE INDEX IF NOT EXISTS "award_sheets_shotName_idx" ON "award_sheets"("shotName");
CREATE UNIQUE INDEX IF NOT EXISTS "award_sheets_showName_shotName_key" ON "award_sheets"("showName", "shotName");

-- ============================================
-- SAVED VIEWS
-- ============================================

CREATE TABLE IF NOT EXISTS "saved_views" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewType" TEXT NOT NULL DEFAULT 'resource',
    "filters" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isQuickFilter" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "saved_views_createdBy_idx" ON "saved_views"("createdBy");
CREATE INDEX IF NOT EXISTS "saved_views_viewType_idx" ON "saved_views"("viewType");
CREATE INDEX IF NOT EXISTS "saved_views_isQuickFilter_idx" ON "saved_views"("isQuickFilter");

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE 'Schema migration completed successfully!';
    RAISE NOTICE 'All tables, indexes, and foreign keys have been created.';
END $$;
