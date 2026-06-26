-- Team Tenant Isolation
-- Adds nullable tenantId to Team for DB-level multi-tenant isolation.
-- Pattern: identical to Event.tenantId (20260604110000_event_tenant_isolation).
-- Nullable for backward compatibility; backfill covers all existing teams.
--
-- Backfill order:
--   1. Teams with orgUnitId: inherit tenantId from the linked OrgUnit.
--   2. Remaining null teams: assign the fc-allschwil tenant (single-tenant/demo-safe).
--      A guarded SELECT ensures the tenant exists and is ACTIVE before assigning.
--
-- Idempotency: all steps use IF NOT EXISTS / exception-safe guards so this
-- migration is safe to apply in environments where a prior (orphaned) migration
-- already created the column, FK, or index.

-- AlterTable: IF NOT EXISTS guard makes this idempotent.
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- Backfill step 1: inherit from OrgUnit.tenantId where orgUnitId is set
UPDATE "Team" t
SET "tenantId" = (
  SELECT ou."tenantId"
  FROM "OrgUnit" ou
  WHERE ou."id" = t."orgUnitId"
    AND ou."tenantId" IS NOT NULL
)
WHERE t."orgUnitId" IS NOT NULL
  AND t."tenantId" IS NULL;

-- Backfill step 2: assign remaining null teams to the fc-allschwil tenant
-- Guard: only runs if the tenant exists and is ACTIVE to prevent FK violation.
UPDATE "Team"
SET "tenantId" = (
  SELECT "id" FROM "Tenant" WHERE "key" = 'fc-allschwil' AND "status" = 'ACTIVE'
)
WHERE "tenantId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Tenant" WHERE "key" = 'fc-allschwil' AND "status" = 'ACTIVE'
  );

-- Unresolved-team guard report (no-op on success, informational for audits):
-- Any teams still with NULL tenantId after this migration indicate a data
-- environment where fc-allschwil tenant does not exist. This is safe —
-- those teams will simply be excluded from the public teams endpoint.
-- Run after deploy to verify: SELECT id, name FROM "Team" WHERE "tenantId" IS NULL;

-- AddForeignKey: exception-safe guard; no-op if constraint already exists.
DO $$ BEGIN
  ALTER TABLE "Team"
    ADD CONSTRAINT "Team_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- CreateIndex: IF NOT EXISTS guard makes this idempotent.
CREATE INDEX IF NOT EXISTS "Team_tenantId_idx" ON "Team"("tenantId");
