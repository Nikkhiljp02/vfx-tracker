-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "loginAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" DATETIME,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "location" TEXT,
    "loginSuccess" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" TEXT,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspicionFlags" TEXT
);

-- CreateTable
CREATE TABLE "resource_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empId" TEXT NOT NULL,
    "empName" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "reportingTo" TEXT,
    "department" TEXT NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'Day',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "resource_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "allocationDate" DATETIME NOT NULL,
    "manDays" REAL NOT NULL,
    "isLeave" BOOLEAN NOT NULL DEFAULT false,
    "isIdle" BOOLEAN NOT NULL DEFAULT false,
    "isWeekendWorking" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    CONSTRAINT "resource_allocations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resource_members" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "award_sheets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "customFields" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "viewType" TEXT NOT NULL DEFAULT 'resource',
    "filters" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isQuickFilter" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "shotTag" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "leadName" TEXT,
    "status" TEXT NOT NULL,
    "feedbackNotes" TEXT,
    "feedbackDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "loggedOutAt" DATETIME,
    "loggedOutBy" TEXT,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("createdAt", "expires", "id", "sessionToken", "userId") SELECT "createdAt", "expires", "id", "sessionToken", "userId" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE INDEX "sessions_userId_isActive_idx" ON "sessions"("userId", "isActive");
CREATE INDEX "sessions_sessionToken_idx" ON "sessions"("sessionToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "login_history_userId_loginAt_idx" ON "login_history"("userId", "loginAt");

-- CreateIndex
CREATE INDEX "login_history_isSuspicious_idx" ON "login_history"("isSuspicious");

-- CreateIndex
CREATE INDEX "login_history_loginSuccess_idx" ON "login_history"("loginSuccess");

-- CreateIndex
CREATE UNIQUE INDEX "resource_members_empId_key" ON "resource_members"("empId");

-- CreateIndex
CREATE INDEX "resource_members_department_idx" ON "resource_members"("department");

-- CreateIndex
CREATE INDEX "resource_members_isActive_idx" ON "resource_members"("isActive");

-- CreateIndex
CREATE INDEX "resource_members_empId_idx" ON "resource_members"("empId");

-- CreateIndex
CREATE INDEX "resource_allocations_resourceId_idx" ON "resource_allocations"("resourceId");

-- CreateIndex
CREATE INDEX "resource_allocations_allocationDate_idx" ON "resource_allocations"("allocationDate");

-- CreateIndex
CREATE INDEX "resource_allocations_showName_idx" ON "resource_allocations"("showName");

-- CreateIndex
CREATE INDEX "resource_allocations_shotName_idx" ON "resource_allocations"("shotName");

-- CreateIndex
CREATE INDEX "resource_allocations_resourceId_allocationDate_idx" ON "resource_allocations"("resourceId", "allocationDate");

-- CreateIndex
CREATE INDEX "award_sheets_showName_idx" ON "award_sheets"("showName");

-- CreateIndex
CREATE INDEX "award_sheets_shotName_idx" ON "award_sheets"("shotName");

-- CreateIndex
CREATE UNIQUE INDEX "award_sheets_showName_shotName_key" ON "award_sheets"("showName", "shotName");

-- CreateIndex
CREATE INDEX "saved_views_createdBy_idx" ON "saved_views"("createdBy");

-- CreateIndex
CREATE INDEX "saved_views_viewType_isPublic_idx" ON "saved_views"("viewType", "isPublic");

-- CreateIndex
CREATE INDEX "saved_views_viewType_isQuickFilter_idx" ON "saved_views"("viewType", "isQuickFilter");

-- CreateIndex
CREATE INDEX "feedbacks_showName_idx" ON "feedbacks"("showName");

-- CreateIndex
CREATE INDEX "feedbacks_shotName_idx" ON "feedbacks"("shotName");

-- CreateIndex
CREATE INDEX "feedbacks_department_idx" ON "feedbacks"("department");

-- CreateIndex
CREATE INDEX "feedbacks_status_idx" ON "feedbacks"("status");

-- CreateIndex
CREATE INDEX "feedbacks_leadName_idx" ON "feedbacks"("leadName");

-- CreateIndex
CREATE INDEX "feedbacks_feedbackDate_idx" ON "feedbacks"("feedbackDate");

-- CreateIndex
CREATE INDEX "feedbacks_shotTag_idx" ON "feedbacks"("shotTag");

-- CreateIndex
CREATE INDEX "delivery_schedules_scheduleType_idx" ON "delivery_schedules"("scheduleType");

-- CreateIndex
CREATE INDEX "departments_isActive_idx" ON "departments"("isActive");

-- CreateIndex
CREATE INDEX "shots_showId_idx" ON "shots"("showId");

-- CreateIndex
CREATE INDEX "shots_shotName_idx" ON "shots"("shotName");

-- CreateIndex
CREATE INDEX "shots_shotTag_idx" ON "shots"("shotTag");

-- CreateIndex
CREATE INDEX "shots_episode_idx" ON "shots"("episode");

-- CreateIndex
CREATE INDEX "shots_sequence_idx" ON "shots"("sequence");

-- CreateIndex
CREATE INDEX "shots_turnover_idx" ON "shots"("turnover");

-- CreateIndex
CREATE INDEX "shots_createdDate_idx" ON "shots"("createdDate" DESC);

-- CreateIndex
CREATE INDEX "shots_showId_shotName_idx" ON "shots"("showId", "shotName");

-- CreateIndex
CREATE INDEX "shows_status_idx" ON "shows"("status");

-- CreateIndex
CREATE INDEX "shows_showName_idx" ON "shows"("showName");

-- CreateIndex
CREATE INDEX "shows_createdDate_idx" ON "shows"("createdDate" DESC);

-- CreateIndex
CREATE INDEX "status_options_isActive_statusOrder_idx" ON "status_options"("isActive", "statusOrder");

-- CreateIndex
CREATE INDEX "tasks_shotId_idx" ON "tasks"("shotId");

-- CreateIndex
CREATE INDEX "tasks_department_idx" ON "tasks"("department");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_leadName_idx" ON "tasks"("leadName");

-- CreateIndex
CREATE INDEX "tasks_isInternal_idx" ON "tasks"("isInternal");

-- CreateIndex
CREATE INDEX "tasks_internalEta_idx" ON "tasks"("internalEta");

-- CreateIndex
CREATE INDEX "tasks_clientEta_idx" ON "tasks"("clientEta");

-- CreateIndex
CREATE INDEX "tasks_shotId_department_idx" ON "tasks"("shotId", "department");

-- CreateIndex
CREATE INDEX "tasks_status_department_idx" ON "tasks"("status", "department");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");
