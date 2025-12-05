-- Employee Type Migration for Supabase
-- Run this in your Supabase SQL Editor
-- Adds employeeType field to resource_members table

-- Add employeeType column with default value 'Artist'
ALTER TABLE resource_members 
ADD COLUMN IF NOT EXISTS "employeeType" TEXT NOT NULL DEFAULT 'Artist';

-- Add check constraint to ensure valid employeeType values
ALTER TABLE resource_members 
ADD CONSTRAINT "resource_members_employeeType_check" 
CHECK ("employeeType" IN ('Artist', 'Lead', 'Supervisor', 'Production'));

-- Create index on employeeType for better query performance
CREATE INDEX IF NOT EXISTS idx_resource_members_employee_type 
ON resource_members("employeeType");

-- Optional: Update existing records based on designation patterns
-- (Uncomment and modify if you have existing data that needs categorization)

-- Update Leads based on designation
-- UPDATE resource_members 
-- SET "employeeType" = 'Lead' 
-- WHERE designation ILIKE '%lead%' OR designation ILIKE '%sr%senior%';

-- Update Supervisors based on designation
-- UPDATE resource_members 
-- SET "employeeType" = 'Supervisor' 
-- WHERE designation ILIKE '%supervisor%' OR designation ILIKE '%head%';

-- Update Production staff based on department
-- UPDATE resource_members 
-- SET "employeeType" = 'Production' 
-- WHERE department = 'Production';

-- Verify the migration
SELECT 
    'employeeType column added successfully!' as message,
    COUNT(*) as total_members,
    COUNT(*) FILTER (WHERE "employeeType" = 'Artist') as artists,
    COUNT(*) FILTER (WHERE "employeeType" = 'Lead') as leads,
    COUNT(*) FILTER (WHERE "employeeType" = 'Supervisor') as supervisors,
    COUNT(*) FILTER (WHERE "employeeType" = 'Production') as production
FROM resource_members;

-- Show distribution by employee type
SELECT 
    "employeeType",
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM resource_members
GROUP BY "employeeType"
ORDER BY count DESC;
