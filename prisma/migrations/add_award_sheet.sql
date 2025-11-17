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

-- Note: showName column already exists in resource_allocations table
-- No need to add it separately
