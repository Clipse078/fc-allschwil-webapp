-- Migration: 20260814150000_persons_01_02_c1_dedicated_assignment_model
--
-- PERSONS-01/02-C1: PersonAssignment hardening
--
-- Corrections to the initial PERSONS-01/02 migration (20260814140000):
--
-- 1. REVERT: OrgUnitMembership.teamId
--    The previous migration added teamId to OrgUnitMembership for person
--    function storage. This is reverted because OrgUnitMembership participates
--    in the org-unit visibility path (loadOrgUnitIds / canAccessOrgUnit /
--    canSeeEntity) and must not be contaminated with person function data.
--
-- 2. NEW: PersonAssignment table
--    Dedicated, auth-inert model for person → OrgUnit/Team/Function/Season
--    assignments. No userId; no connection to loadOrgUnitIds; no roleKey
--    validated against Role table; no RPERM side-effects by construction.
--
-- 3. HARDEN: Person.tenantId NOT NULL
--    Legacy Person records (tenantId IS NULL) are backfilled to the
--    fc-allschwil tenant — the only known tenant for all existing Person data.
--    The column is then made NOT NULL. All future Person creation must supply
--    the caller's activeTenantId.
--
-- 4. NEW: people.delete permission
--    Idempotent INSERT (ON CONFLICT DO NOTHING).
--
-- All changes are additive or deterministic-backfill-safe.
-- The previous migration's people.delete INSERT is idempotent; re-running
-- this one is safe.

-- ── 1. Revert OrgUnitMembership.teamId ──────────────────────────────────────

-- Drop indexes added in 20260814140000 for teamId
DROP INDEX IF EXISTS "OrgUnitMembership_teamId_idx";
DROP INDEX IF EXISTS "OrgUnitMembership_personId_status_idx";

-- Drop FK constraint
ALTER TABLE "OrgUnitMembership"
  DROP CONSTRAINT IF EXISTS "OrgUnitMembership_teamId_fkey";

-- Drop the column
ALTER TABLE "OrgUnitMembership"
  DROP COLUMN IF EXISTS "teamId";

-- ── 2. PersonAssignment table ────────────────────────────────────────────────

CREATE TABLE "PersonAssignment" (
  "id"          TEXT         NOT NULL,
  "tenantId"    TEXT         NOT NULL,
  "personId"    TEXT         NOT NULL,
  "orgUnitId"   TEXT         NOT NULL,
  "teamId"      TEXT,
  "seasonId"    TEXT,
  "functionKey" TEXT         NOT NULL,
  "status"      TEXT         NOT NULL DEFAULT 'ACTIVE',
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PersonAssignment_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "PersonAssignment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "PersonAssignment_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "PersonAssignment_orgUnitId_fkey"
    FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "PersonAssignment_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT "PersonAssignment_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PersonAssignment_tenantId_idx"             ON "PersonAssignment"("tenantId");
CREATE INDEX "PersonAssignment_personId_idx"             ON "PersonAssignment"("personId");
CREATE INDEX "PersonAssignment_orgUnitId_idx"            ON "PersonAssignment"("orgUnitId");
CREATE INDEX "PersonAssignment_teamId_idx"               ON "PersonAssignment"("teamId");
CREATE INDEX "PersonAssignment_seasonId_idx"             ON "PersonAssignment"("seasonId");
CREATE INDEX "PersonAssignment_tenantId_status_idx"      ON "PersonAssignment"("tenantId", "status");
CREATE INDEX "PersonAssignment_personId_status_idx"      ON "PersonAssignment"("personId", "status");
CREATE INDEX "PersonAssignment_tenantId_orgUnitId_status_idx"
  ON "PersonAssignment"("tenantId", "orgUnitId", "status");

-- ── 3. Person.tenantId NOT NULL ───────────────────────────────────────────────
--
-- Backfill: associate all null-tenantId Person records with fc-allschwil.
-- Rationale: no multi-tenant production data exists; all legacy Person records
-- (including the known "Michael" record) originated from the fc-allschwil
-- seed environment. This is a deterministic, one-tenant backfill.
-- No name matching, no email guessing, no auth mutation.

UPDATE "Person" p
SET    "tenantId" = t."id"
FROM   "Tenant" t
WHERE  p."tenantId" IS NULL
  AND  t."key" = 'fc-allschwil';

-- Harden: disallow future null tenantId on Person
ALTER TABLE "Person" ALTER COLUMN "tenantId" SET NOT NULL;

-- ── 4. Permission: people.delete (idempotent) ────────────────────────────────
INSERT INTO "Permission" ("id", "key", "name", "module", "scope", "grantableByAdmin", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'people.delete',
  'Permanently delete persons',
  'PEOPLE',
  'TENANT',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
