-- SECURITY-GO-LIVE-01K-A: canonical tenant ownership for strategic records.
--
-- Backfill policy:
--   * candidate ownership comes only from the creating user's existing
--     User.tenantId provenance and TenantMembership relationships;
--   * exactly one distinct candidate is required;
--   * zero or multiple candidates fail the migration before NOT NULL/FKs.
--
-- No fallback/default tenant is permitted.

ALTER TABLE "Meeting" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Initiative" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Target" ADD COLUMN "tenantId" TEXT;

WITH candidates AS (
  SELECT m.id, u."tenantId"
  FROM "Meeting" m
  JOIN "User" u ON u.id = m."createdByUserId"
  WHERE u."tenantId" IS NOT NULL
  UNION
  SELECT m.id, tm."tenantId"
  FROM "Meeting" m
  JOIN "TenantMembership" tm ON tm."userId" = m."createdByUserId"
),
deterministic AS (
  SELECT id, MIN("tenantId") AS "tenantId"
  FROM candidates
  GROUP BY id
  HAVING COUNT(DISTINCT "tenantId") = 1
)
UPDATE "Meeting" m
SET "tenantId" = d."tenantId"
FROM deterministic d
WHERE m.id = d.id;

WITH candidates AS (
  SELECT i.id, u."tenantId"
  FROM "Initiative" i
  JOIN "User" u ON u.id = i."createdByUserId"
  WHERE u."tenantId" IS NOT NULL
  UNION
  SELECT i.id, tm."tenantId"
  FROM "Initiative" i
  JOIN "TenantMembership" tm ON tm."userId" = i."createdByUserId"
),
deterministic AS (
  SELECT id, MIN("tenantId") AS "tenantId"
  FROM candidates
  GROUP BY id
  HAVING COUNT(DISTINCT "tenantId") = 1
)
UPDATE "Initiative" i
SET "tenantId" = d."tenantId"
FROM deterministic d
WHERE i.id = d.id;

WITH candidates AS (
  SELECT t.id, u."tenantId"
  FROM "Target" t
  JOIN "User" u ON u.id = t."createdByUserId"
  WHERE u."tenantId" IS NOT NULL
  UNION
  SELECT t.id, tm."tenantId"
  FROM "Target" t
  JOIN "TenantMembership" tm ON tm."userId" = t."createdByUserId"
),
deterministic AS (
  SELECT id, MIN("tenantId") AS "tenantId"
  FROM candidates
  GROUP BY id
  HAVING COUNT(DISTINCT "tenantId") = 1
)
UPDATE "Target" t
SET "tenantId" = d."tenantId"
FROM deterministic d
WHERE t.id = d.id;

DO $$
DECLARE
  unresolved_meetings INTEGER;
  unresolved_initiatives INTEGER;
  unresolved_targets INTEGER;
BEGIN
  SELECT COUNT(*) INTO unresolved_meetings FROM "Meeting" WHERE "tenantId" IS NULL;
  SELECT COUNT(*) INTO unresolved_initiatives FROM "Initiative" WHERE "tenantId" IS NULL;
  SELECT COUNT(*) INTO unresolved_targets FROM "Target" WHERE "tenantId" IS NULL;

  IF unresolved_meetings <> 0
     OR unresolved_initiatives <> 0
     OR unresolved_targets <> 0 THEN
    RAISE EXCEPTION
      'SECURITY-GO-LIVE-01K-A blocked: nondeterministic ownership (Meeting %, Initiative %, Target %)',
      unresolved_meetings, unresolved_initiatives, unresolved_targets;
  END IF;
END $$;

ALTER TABLE "Meeting" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Initiative" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Target" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX "Meeting_tenantId_idx" ON "Meeting"("tenantId");
CREATE INDEX "Initiative_tenantId_idx" ON "Initiative"("tenantId");
CREATE INDEX "Target_tenantId_idx" ON "Target"("tenantId");

DROP INDEX "Meeting_slug_key";
DROP INDEX "Initiative_slug_key";
CREATE UNIQUE INDEX "Meeting_tenantId_slug_key" ON "Meeting"("tenantId", "slug");
CREATE UNIQUE INDEX "Initiative_tenantId_slug_key" ON "Initiative"("tenantId", "slug");

ALTER TABLE "Meeting"
  ADD CONSTRAINT "Meeting_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Initiative"
  ADD CONSTRAINT "Initiative_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Target"
  ADD CONSTRAINT "Target_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
