-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "shot_notes" ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdDate_idx" ON "notifications"("createdDate");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "shot_notes_userId_idx" ON "shot_notes"("userId");
