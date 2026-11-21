-- Add staff attribution and stock snapshots to sale items.
ALTER TABLE "SaleItem"
ADD COLUMN "assignedMemberId" UUID,
ADD COLUMN "assignedMemberName" TEXT,
ADD COLUMN "stockBefore" DECIMAL(12,3),
ADD COLUMN "stockAfter" DECIMAL(12,3);

CREATE INDEX "SaleItem_organizationId_assignedMemberId_idx"
ON "SaleItem"("organizationId", "assignedMemberId");

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_assignedMemberId_organizationId_fkey"
FOREIGN KEY ("assignedMemberId", "organizationId")
REFERENCES "OrganizationMember"("id", "organizationId")
ON DELETE RESTRICT
ON UPDATE CASCADE;