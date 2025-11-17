-- Add isWeekendWorking column to resource_allocations table
-- This column tracks whether an allocation is for a weekend working day

ALTER TABLE "resource_allocations" 
ADD COLUMN IF NOT EXISTS "isWeekendWorking" BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN "resource_allocations"."isWeekendWorking" IS 'True if this allocation is for a weekend working day';
