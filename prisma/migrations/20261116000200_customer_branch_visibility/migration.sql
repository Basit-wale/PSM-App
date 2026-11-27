

-- CreateTable
CREATE TABLE "CustomerBranch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerBranch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerBranch_organizationId_branchId_idx" ON "CustomerBranch"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "CustomerBranch_organizationId_customerId_idx" ON "CustomerBranch"("organizationId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerBranch_customerId_branchId_key" ON "CustomerBranch"("customerId", "branchId");

-- AddForeignKey
ALTER TABLE "CustomerBranch" ADD CONSTRAINT "CustomerBranch_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBranch" ADD CONSTRAINT "CustomerBranch_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

