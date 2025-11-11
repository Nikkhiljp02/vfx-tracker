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
