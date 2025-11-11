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
