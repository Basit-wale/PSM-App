-- CreateEnum
CREATE TYPE "SmsCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "SmsCampaign" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "branchId" UUID,
    "createdByMemberId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "SmsCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsRecipient" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "customerId" UUID,
    "phone" TEXT NOT NULL,
    "status" "SmsRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SmsRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsCampaign_organizationId_createdAt_idx" ON "SmsCampaign"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsCampaign_branchId_createdAt_idx" ON "SmsCampaign"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsCampaign_createdByMemberId_idx" ON "SmsCampaign"("createdByMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsCampaign_id_organizationId_key" ON "SmsCampaign"("id", "organizationId");

-- CreateIndex
CREATE INDEX "SmsRecipient_organizationId_campaignId_status_idx" ON "SmsRecipient"("organizationId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "SmsRecipient_customerId_idx" ON "SmsRecipient"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsRecipient_campaignId_phone_key" ON "SmsRecipient"("campaignId", "phone");

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_createdByMemberId_organizationId_fkey" FOREIGN KEY ("createdByMemberId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsRecipient" ADD CONSTRAINT "SmsRecipient_campaignId_organizationId_fkey" FOREIGN KEY ("campaignId", "organizationId") REFERENCES "SmsCampaign"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsRecipient" ADD CONSTRAINT "SmsRecipient_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
