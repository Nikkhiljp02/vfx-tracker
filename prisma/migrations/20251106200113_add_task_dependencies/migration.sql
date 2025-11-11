/*
  Warnings:

  - You are about to drop the `shot_dependencies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `dependencies` on the `tasks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "shot_dependencies_shotId_dependsOnShotId_key";

-- DropIndex
DROP INDEX "shot_dependencies_dependsOnShotId_idx";

-- DropIndex
DROP INDEX "shot_dependencies_shotId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "shot_dependencies";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_dependencies_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_dependencies_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shotId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'YTS',
    "leadName" TEXT,
    "bidMds" REAL,
    "internalEta" DATETIME,
    "clientEta" DATETIME,
    "deliveredVersion" TEXT,
    "deliveredDate" DATETIME,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    CONSTRAINT "tasks_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("bidMds", "clientEta", "createdDate", "deliveredDate", "deliveredVersion", "department", "id", "internalEta", "isInternal", "leadName", "shotId", "status", "updatedDate") SELECT "bidMds", "clientEta", "createdDate", "deliveredDate", "deliveredVersion", "department", "id", "internalEta", "isInternal", "leadName", "shotId", "status", "updatedDate" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "task_dependencies_taskId_idx" ON "task_dependencies"("taskId");

-- CreateIndex
CREATE INDEX "task_dependencies_dependsOnTaskId_idx" ON "task_dependencies"("dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_taskId_dependsOnTaskId_key" ON "task_dependencies"("taskId", "dependsOnTaskId");
