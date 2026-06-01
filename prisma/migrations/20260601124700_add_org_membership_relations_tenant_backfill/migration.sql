-- Org Builder Foundation - Slice 1
-- Adds nullable User/Person relations for memberships after cleaning orphan references.
-- Also backfills existing org-builder records to the default fc-allschwil tenant.

-- Clean orphan references before adding FK constraints.
UPDATE "OrgUnitMembership" AS membership
SET "userId" = NULL
WHERE membership."userId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS app_user
    WHERE app_user."id" = membership."userId"
  );

UPDATE "OrgUnitMembership" AS membership
SET "personId" = NULL
WHERE membership."personId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Person" AS person
    WHERE person."id" = membership."personId"
  );

-- Soft tenant v1: assign existing org-builder data to fc-allschwil when that tenant exists.
UPDATE "OrgUnit"
SET "tenantId" = (
  SELECT tenant."id"
  FROM "Tenant" AS tenant
  WHERE tenant."key" = 'fc-allschwil'
)
WHERE "tenantId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Tenant" AS tenant
    WHERE tenant."key" = 'fc-allschwil'
  );

UPDATE "OrgUnitMembership"
SET "tenantId" = (
  SELECT tenant."id"
  FROM "Tenant" AS tenant
  WHERE tenant."key" = 'fc-allschwil'
)
WHERE "tenantId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Tenant" AS tenant
    WHERE tenant."key" = 'fc-allschwil'
  );

-- CreateIndex
CREATE INDEX "OrgUnitMembership_personId_idx" ON "OrgUnitMembership"("personId");

-- AddForeignKey
ALTER TABLE "OrgUnitMembership"
    ADD CONSTRAINT "OrgUnitMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnitMembership"
    ADD CONSTRAINT "OrgUnitMembership_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
