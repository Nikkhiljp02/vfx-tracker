-- Soft Bookings Table Migration for Supabase
-- Run this in your Supabase SQL Editor

-- Create the soft_bookings table
CREATE TABLE IF NOT EXISTS soft_bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "showName" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    department TEXT NOT NULL,
    "manDays" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "splitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "srPercentage" DOUBLE PRECISION DEFAULT 0,
    "midPercentage" DOUBLE PRECISION DEFAULT 0,
    "jrPercentage" DOUBLE PRECISION DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    notes TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_soft_bookings_show ON soft_bookings("showName");
CREATE INDEX IF NOT EXISTS idx_soft_bookings_department ON soft_bookings(department);
CREATE INDEX IF NOT EXISTS idx_soft_bookings_status ON soft_bookings(status);
CREATE INDEX IF NOT EXISTS idx_soft_bookings_dates ON soft_bookings("startDate", "endDate");

-- Add RLS policies (optional - enable if you have RLS enabled)
-- ALTER TABLE soft_bookings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read bookings
-- CREATE POLICY "Allow read soft_bookings" ON soft_bookings
--     FOR SELECT USING (true);

-- Allow authenticated users to insert bookings
-- CREATE POLICY "Allow insert soft_bookings" ON soft_bookings
--     FOR INSERT WITH CHECK (true);

-- Allow authenticated users to update bookings
-- CREATE POLICY "Allow update soft_bookings" ON soft_bookings
--     FOR UPDATE USING (true);

-- Allow authenticated users to delete bookings
-- CREATE POLICY "Allow delete soft_bookings" ON soft_bookings
--     FOR DELETE USING (true);

-- Verify table was created
SELECT 'soft_bookings table created successfully!' as message;
