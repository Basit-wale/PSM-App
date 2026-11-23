-- CreateTable
CREATE TABLE "StaffInvitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdByMemberId" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "MemberRole" NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffInvitationBranch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,

    CONSTRAINT "StaffInvitationBranch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffInvitation_organizationId_email_idx" ON "StaffInvitation"("organizationId", "email");

-- CreateIndex
CREATE INDEX "StaffInvitation_organizationId_expiresAt_idx" ON "StaffInvitation"("organizationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_id_organizationId_key" ON "StaffInvitation"("id", "organizationId");

-- CreateIndex
CREATE INDEX "StaffInvitationBranch_organizationId_branchId_idx" ON "StaffInvitationBranch"("organizationId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitationBranch_invitationId_branchId_key" ON "StaffInvitationBranch"("invitationId", "branchId");

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_createdByMemberId_organizationId_fkey" FOREIGN KEY ("createdByMemberId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitationBranch" ADD CONSTRAINT "StaffInvitationBranch_invitationId_organizationId_fkey" FOREIGN KEY ("invitationId", "organizationId") REFERENCES "StaffInvitation"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitationBranch" ADD CONSTRAINT "StaffInvitationBranch_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
