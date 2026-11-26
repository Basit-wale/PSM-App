-- Add optional regular branch staff assignment to sale items.
ALTER TABLE "SaleItem"
ADD COLUMN "assignedBranchStaffId" UUID;

-- Create regular branch staff records (independent of Manual Performance).
CREATE TABLE "BranchStaff" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BranchStaff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BranchStaff_organizationId_branchId_isActive_idx"
ON "BranchStaff"("organizationId", "branchId", "isActive");

CREATE UNIQUE INDEX "BranchStaff_id_organizationId_key"
ON "BranchStaff"("id", "organizationId");

CREATE INDEX "SaleItem_organizationId_assignedBranchStaffId_idx"
ON "SaleItem"("organizationId", "assignedBranchStaffId");

ALTER TABLE "BranchStaff"
ADD CONSTRAINT "BranchStaff_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BranchStaff"
ADD CONSTRAINT "BranchStaff_branchId_organizationId_fkey"
FOREIGN KEY ("branchId", "organizationId")
REFERENCES "Branch"("id", "organizationId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_assignedBranchStaffId_organizationId_fkey"
FOREIGN KEY ("assignedBranchStaffId", "organizationId")
REFERENCES "BranchStaff"("id", "organizationId")
ON DELETE RESTRICT ON UPDATE CASCADE;
