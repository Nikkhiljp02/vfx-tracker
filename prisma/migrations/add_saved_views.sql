-- SavedView table for persistent filter configurations
CREATE TABLE IF NOT EXISTS "SavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "viewType" TEXT NOT NULL DEFAULT 'resource',
    "filters" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isQuickFilter" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS "idx_saved_views_user" ON "SavedView"("createdBy");
CREATE INDEX IF NOT EXISTS "idx_saved_views_type" ON "SavedView"("viewType");
CREATE INDEX IF NOT EXISTS "idx_saved_views_quick" ON "SavedView"("isQuickFilter") WHERE "isQuickFilter" = true;
CREATE INDEX IF NOT EXISTS "idx_saved_views_public" ON "SavedView"("isPublic") WHERE "isPublic" = true;
