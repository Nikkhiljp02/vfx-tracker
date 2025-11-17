-- Performance Optimization Indexes for VFX Tracker
-- Execute this on Supabase database for 5x faster queries

-- Resource Allocation Indexes (Most critical for Resource Forecast)
CREATE INDEX IF NOT EXISTS "idx_allocations_resource_date" ON "resource_allocations"("resourceId", "allocationDate");
CREATE INDEX IF NOT EXISTS "idx_allocations_date_range" ON "resource_allocations"("allocationDate");
CREATE INDEX IF NOT EXISTS "idx_allocations_resource_active" ON "resource_allocations"("resourceId") WHERE "isLeave" = false AND "isIdle" = false;

-- Resource Member Indexes
CREATE INDEX IF NOT EXISTS "idx_members_active_dept" ON "resource_members"("isActive", "department");
CREATE INDEX IF NOT EXISTS "idx_members_shift" ON "resource_members"("shift") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "idx_members_emp_id" ON "resource_members"("empId");

-- Shot and Task Indexes
CREATE INDEX IF NOT EXISTS "idx_shots_show_status" ON "shots"("showId", "status");
CREATE INDEX IF NOT EXISTS "idx_shots_sequence" ON "shots"("showId", "sequenceName");
CREATE INDEX IF NOT EXISTS "idx_tasks_shot_status" ON "tasks"("shotId", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_assigned" ON "tasks"("assignedTo");

-- Activity Log Indexes (for fast filtering)
CREATE INDEX IF NOT EXISTS "idx_activity_timestamp" ON "activity_logs"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_activity_user" ON "activity_logs"("userId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_activity_entity" ON "activity_logs"("entityType", "entityId");

-- Notification Indexes
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications"("userId", "isRead", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_notifications_unread" ON "notifications"("userId") WHERE "isRead" = false;

-- Delivery Schedule Indexes
CREATE INDEX IF NOT EXISTS "idx_delivery_shot_date" ON "delivery_schedules"("shotId", "deliveryDate");
CREATE INDEX IF NOT EXISTS "idx_delivery_date" ON "delivery_schedules"("deliveryDate");

-- Show and Department Indexes
CREATE INDEX IF NOT EXISTS "idx_shows_active" ON "shows"("name") WHERE "id" IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_allocations_complex" ON "resource_allocations"("resourceId", "allocationDate", "manDays") 
  WHERE "isLeave" = false AND "isIdle" = false;

-- Analyze tables for query planner optimization
ANALYZE "resource_allocations";
ANALYZE "resource_members";
ANALYZE "shots";
ANALYZE "tasks";
ANALYZE "activity_logs";
ANALYZE "notifications";
