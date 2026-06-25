-- Org Builder Foundation v1: add archivedAt timestamp to OrgUnit
-- Safe additive DDL: new nullable column, no data transformation required.
-- Backfill: existing ARCHIVED units get archivedAt = updatedAt as a safe approximation.

ALTER TABLE "OrgUnit" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Backfill: set archivedAt for any existing archived units using updatedAt as proxy.
UPDATE "OrgUnit" SET "archivedAt" = "updatedAt" WHERE status = 'ARCHIVED' AND "archivedAt" IS NULL;
