-- CreateTable
CREATE TABLE "shot_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shotId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" TEXT,
    "attachments" TEXT,
    "userName" TEXT NOT NULL DEFAULT 'User',
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "shot_notes_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "shot_notes_shotId_idx" ON "shot_notes"("shotId");

-- CreateIndex
CREATE INDEX "shot_notes_createdDate_idx" ON "shot_notes"("createdDate");
