-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "originalUnitPrice" DECIMAL(12,2),
ADD COLUMN     "priceDifference" DECIMAL(12,2),
ADD COLUMN     "priceNegotiatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "priceNegotiatedByMemberId" UUID;

-- CreateIndex
CREATE INDEX "SaleItem_organizationId_priceNegotiatedByMemberId_idx" ON "SaleItem"("organizationId", "priceNegotiatedByMemberId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_priceNegotiatedByMemberId_organizationId_fkey" FOREIGN KEY ("priceNegotiatedByMemberId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
