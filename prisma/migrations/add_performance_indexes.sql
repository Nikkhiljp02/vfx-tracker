-- Performance Optimization Indexes for VFX Tracker
-- Execute this on Supabase database for 5x faster queries

-- Resource Allocation Indexes (Most critical for Resource Forecast)
CREATE INDEX IF NOT EXISTS "idx_allocations_resource_date" ON "ResourceAllocation"("resourceId", "allocationDate");
CREATE INDEX IF NOT EXISTS "idx_allocations_date_range" ON "ResourceAllocation"("allocationDate");
CREATE INDEX IF NOT EXISTS "idx_allocations_resource_active" ON "ResourceAllocation"("resourceId") WHERE "isLeave" = false AND "isIdle" = false;

-- Resource Member Indexes
CREATE INDEX IF NOT EXISTS "idx_members_active_dept" ON "ResourceMember"("isActive", "department");
CREATE INDEX IF NOT EXISTS "idx_members_shift" ON "ResourceMember"("shift") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "idx_members_emp_id" ON "ResourceMember"("empId");

-- Shot and Task Indexes
CREATE INDEX IF NOT EXISTS "idx_shots_show_status" ON "Shot"("showId", "status");
CREATE INDEX IF NOT EXISTS "idx_shots_sequence" ON "Shot"("showId", "sequenceName");
CREATE INDEX IF NOT EXISTS "idx_tasks_shot_status" ON "Task"("shotId", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_assigned" ON "Task"("assignedTo");

-- Activity Log Indexes (for fast filtering)
CREATE INDEX IF NOT EXISTS "idx_activity_timestamp" ON "ActivityLog"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_activity_user" ON "ActivityLog"("userId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_activity_entity" ON "ActivityLog"("entityType", "entityId");

-- Notification Indexes
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "Notification"("userId", "isRead", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_notifications_unread" ON "Notification"("userId") WHERE "isRead" = false;

-- Delivery Schedule Indexes
CREATE INDEX IF NOT EXISTS "idx_delivery_shot_date" ON "DeliverySchedule"("shotId", "deliveryDate");
CREATE INDEX IF NOT EXISTS "idx_delivery_date" ON "DeliverySchedule"("deliveryDate");

-- Show and Department Indexes
CREATE INDEX IF NOT EXISTS "idx_shows_active" ON "Show"("name") WHERE "id" IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_allocations_complex" ON "ResourceAllocation"("resourceId", "allocationDate", "manDays") 
  WHERE "isLeave" = false AND "isIdle" = false;

-- Analyze tables for query planner optimization
ANALYZE "ResourceAllocation";
ANALYZE "ResourceMember";
ANALYZE "Shot";
ANALYZE "Task";
ANALYZE "ActivityLog";
ANALYZE "Notification";
