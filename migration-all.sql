-- CreateTable
CREATE TABLE "shows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "showName" TEXT NOT NULL,
    "clientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "departments" TEXT NOT NULL,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "shots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "showId" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "shotTag" TEXT NOT NULL DEFAULT 'Fresh',
    "parentShotId" TEXT,
    "scopeOfWork" TEXT,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    CONSTRAINT "shots_showId_fkey" FOREIGN KEY ("showId") REFERENCES "shows" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shots_parentShotId_fkey" FOREIGN KEY ("parentShotId") REFERENCES "shots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shotId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'YTS',
    "leadName" TEXT,
    "dependencies" TEXT,
    "bidMds" REAL,
    "internalEta" DATETIME,
    "clientEta" DATETIME,
    "deliveredVersion" TEXT,
    "deliveredDate" DATETIME,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    CONSTRAINT "tasks_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "status_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statusName" TEXT NOT NULL,
    "statusOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "colorCode" TEXT NOT NULL DEFAULT '#6B7280',
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deptName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "status_options_statusName_key" ON "status_options"("statusName");

-- CreateIndex
CREATE UNIQUE INDEX "departments_deptName_key" ON "departments"("deptName");
-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userName" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReversed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");
-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN "fullEntityData" TEXT;
-- This is an empty migration.
-- AlterTable
ALTER TABLE "shots" ADD COLUMN "turnover" TEXT;
-- AlterTable
ALTER TABLE "shots" ADD COLUMN "episode" TEXT;
ALTER TABLE "shots" ADD COLUMN "sequence" TEXT;
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
-- This is an empty migration.
/*
  Warnings:

  - You are about to drop the `task_dependencies` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "task_dependencies";
PRAGMA foreign_keys=on;
-- CreateTable
CREATE TABLE "delivery_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleType" TEXT NOT NULL,
    "dateOption" TEXT NOT NULL,
    "specificDate" TEXT,
    "customFrom" TEXT,
    "customTo" TEXT,
    "scheduledTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sendDirectly" BOOLEAN NOT NULL DEFAULT true,
    "lastExecuted" DATETIME,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "delivery_schedules_isActive_scheduledTime_idx" ON "delivery_schedules"("isActive", "scheduledTime");
-- CreateTable
CREATE TABLE "schedule_execution_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "dateOption" TEXT NOT NULL,
    "dateRange" TEXT,
    "deliveryCount" INTEGER,
    "errorMessage" TEXT,
    "sendDirectly" BOOLEAN NOT NULL,
    CONSTRAINT "schedule_execution_logs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "delivery_schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_delivery_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleType" TEXT NOT NULL,
    "dateOption" TEXT NOT NULL,
    "specificDate" TEXT,
    "customFrom" TEXT,
    "customTo" TEXT,
    "scheduledTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sendDirectly" BOOLEAN NOT NULL DEFAULT true,
    "lastExecuted" DATETIME,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL
);
INSERT INTO "new_delivery_schedules" ("createdDate", "customFrom", "customTo", "dateOption", "id", "isActive", "lastExecuted", "scheduleType", "scheduledTime", "sendDirectly", "specificDate", "updatedDate") SELECT "createdDate", "customFrom", "customTo", "dateOption", "id", "isActive", "lastExecuted", "scheduleType", "scheduledTime", "sendDirectly", "specificDate", "updatedDate" FROM "delivery_schedules";
DROP TABLE "delivery_schedules";
ALTER TABLE "new_delivery_schedules" RENAME TO "delivery_schedules";
CREATE INDEX "delivery_schedules_isActive_scheduledTime_idx" ON "delivery_schedules"("isActive", "scheduledTime");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "schedule_execution_logs_scheduleId_executedAt_idx" ON "schedule_execution_logs"("scheduleId", "executedAt");
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "show_access" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "show_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "show_access_showId_fkey" FOREIGN KEY ("showId") REFERENCES "shows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tableColumns" TEXT,
    "filterState" TEXT,
    "sortState" TEXT,
    "theme" TEXT DEFAULT 'light',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key" ON "user_permissions"("userId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "show_access_userId_showId_key" ON "show_access"("userId", "showId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");
-- AlterTable
ALTER TABLE "shots" ADD COLUMN "frames" INTEGER;
ALTER TABLE "shots" ADD COLUMN "remark" TEXT;
