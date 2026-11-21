
-- Create service categories
CREATE TABLE "ServiceCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- Add categoryId as nullable temporarily
ALTER TABLE "Service"
ADD COLUMN "categoryId" UUID;

-- Create a General category for every organization with existing services
INSERT INTO "ServiceCategory" (
    "id",
    "organizationId",
    "name",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    "organizationId",
    'General',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Service"
GROUP BY "organizationId";

-- Assign existing services to their organization's General category
UPDATE "Service" AS s
SET "categoryId" = c."id"
FROM "ServiceCategory" AS c
WHERE s."organizationId" = c."organizationId"
AND c."name" = 'General';

-- Make categoryId mandatory after existing records are assigned
ALTER TABLE "Service"
ALTER COLUMN "categoryId" SET NOT NULL;

-- Category indexes
CREATE UNIQUE INDEX "ServiceCategory_organizationId_name_key"
ON "ServiceCategory"("organizationId", "name");

CREATE UNIQUE INDEX "ServiceCategory_id_organizationId_key"
ON "ServiceCategory"("id", "organizationId");

CREATE INDEX "ServiceCategory_organizationId_isActive_idx"
ON "ServiceCategory"("organizationId", "isActive");

-- Service category index
CREATE INDEX "Service_organizationId_categoryId_idx"
ON "Service"("organizationId", "categoryId");

-- Foreign keys
ALTER TABLE "ServiceCategory"
ADD CONSTRAINT "ServiceCategory_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Service"
ADD CONSTRAINT "Service_categoryId_organizationId_fkey"
FOREIGN KEY ("categoryId", "organizationId")
REFERENCES "ServiceCategory"("id", "organizationId")
ON DELETE RESTRICT ON UPDATE CASCADE;
