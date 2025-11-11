-- CreateTable
CREATE TABLE "shot_dependencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shotId" TEXT NOT NULL,
    "dependsOnShotId" TEXT NOT NULL,
    "dependencyType" TEXT NOT NULL DEFAULT 'blocking',
    "notes" TEXT,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    CONSTRAINT "shot_dependencies_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shot_dependencies_dependsOnShotId_fkey" FOREIGN KEY ("dependsOnShotId") REFERENCES "shots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "shot_dependencies_shotId_idx" ON "shot_dependencies"("shotId");

-- CreateIndex
CREATE INDEX "shot_dependencies_dependsOnShotId_idx" ON "shot_dependencies"("dependsOnShotId");

-- CreateIndex
CREATE UNIQUE INDEX "shot_dependencies_shotId_dependsOnShotId_key" ON "shot_dependencies"("shotId", "dependsOnShotId");
