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
