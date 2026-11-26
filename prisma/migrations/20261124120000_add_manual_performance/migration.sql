
-- CreateTable
CREATE TABLE "ManualBranch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ManualBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualStaff" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ManualStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualPerformanceEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ManualPerformanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualBranch_organizationId_isActive_idx" ON "ManualBranch"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ManualBranch_id_organizationId_key" ON "ManualBranch"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ManualStaff_organizationId_branchId_isActive_idx" ON "ManualStaff"("organizationId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ManualStaff_id_branchId_organizationId_key" ON "ManualStaff"("id", "branchId", "organizationId");

-- CreateIndex
CREATE INDEX "ManualPerformanceEntry_organizationId_workDate_idx" ON "ManualPerformanceEntry"("organizationId", "workDate");

-- CreateIndex
CREATE INDEX "ManualPerformanceEntry_organizationId_branchId_workDate_idx" ON "ManualPerformanceEntry"("organizationId", "branchId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "ManualPerformanceEntry_staffId_workDate_key" ON "ManualPerformanceEntry"("staffId", "workDate");

-- AddForeignKey
ALTER TABLE "ManualBranch" ADD CONSTRAINT "ManualBranch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualStaff" ADD CONSTRAINT "ManualStaff_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "ManualBranch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPerformanceEntry" ADD CONSTRAINT "ManualPerformanceEntry_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "ManualBranch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPerformanceEntry" ADD CONSTRAINT "ManualPerformanceEntry_staffId_branchId_organizationId_fkey" FOREIGN KEY ("staffId", "branchId", "organizationId") REFERENCES "ManualStaff"("id", "branchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
