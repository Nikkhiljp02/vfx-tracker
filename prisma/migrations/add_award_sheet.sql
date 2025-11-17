-- Award Sheet table to manage show and shot assignments
CREATE TABLE IF NOT EXISTS "AwardSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "customFields" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    UNIQUE("showName", "shotName")
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_award_show_shot" ON "AwardSheet"("showName", "shotName");
CREATE INDEX IF NOT EXISTS "idx_award_show" ON "AwardSheet"("showName");

-- Add showName to ResourceAllocation if not exists (for better tracking)
ALTER TABLE "ResourceAllocation" ADD COLUMN IF NOT EXISTS "showName" TEXT DEFAULT 'Default';

-- Update existing allocations to use proper showName from shotName if needed
-- This is a one-time migration helper
