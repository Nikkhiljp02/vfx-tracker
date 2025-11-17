-- CreateTable
CREATE TABLE "resource_members" (
    "id" TEXT NOT NULL,
    "empId" TEXT NOT NULL,
    "empName" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "reportingTo" TEXT,
    "department" TEXT NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'Day',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_allocations" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL,
    "manDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isLeave" BOOLEAN NOT NULL DEFAULT false,
    "isIdle" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_members_empId_key" ON "resource_members"("empId");

-- CreateIndex
CREATE INDEX "resource_members_department_isActive_empId_idx" ON "resource_members"("department", "isActive", "empId");

-- CreateIndex
CREATE INDEX "resource_members_empId_idx" ON "resource_members"("empId");

-- CreateIndex
CREATE INDEX "resource_members_department_idx" ON "resource_members"("department");

-- CreateIndex
CREATE INDEX "resource_allocations_resourceId_allocationDate_idx" ON "resource_allocations"("resourceId", "allocationDate");

-- CreateIndex
CREATE INDEX "resource_allocations_allocationDate_idx" ON "resource_allocations"("allocationDate");

-- CreateIndex
CREATE INDEX "resource_allocations_showName_shotName_idx" ON "resource_allocations"("showName", "shotName");

-- CreateIndex
CREATE INDEX "resource_allocations_resourceId_idx" ON "resource_allocations"("resourceId");

-- CreateIndex
CREATE INDEX "resource_allocations_showName_idx" ON "resource_allocations"("showName");

-- AddForeignKey
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resource_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
