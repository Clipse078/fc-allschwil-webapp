-- Migration: 20260814140000_persons_01_02_tenant_scoping_assignments
--
-- PERSONS-01: Canonical Person tenant scoping + imageUrl
-- PERSONS-02: OrgUnitMembership teamId for team-specific person assignments
--
-- Changes:
--
--   Person.tenantId (nullable String)
--     — Canonical tenant scoping for persons created via the Persons module.
--     — Nullable for backward-compat: pre-existing Person records retain
--       null tenantId; queries fall back to including them.
--     — FK to Tenant(id) with onDelete: SetNull (deleting tenant un-links
--       persons but does not delete them).
--
--   Person.imageUrl (nullable String)
--     — Optional profile photo URL. Populated by future image-upload slice.
--     — Null for all existing and new persons until explicitly set.
--
--   OrgUnitMembership.teamId (nullable String)
--     — Optional Team reference for team-specific person assignments.
--     — Null = OrgUnit-level assignment only (e.g. Vereinsleitung role).
--     — FK to Team(id) with onDelete: SetNull.
--
-- Indexes:
--   Person: (tenantId), (tenantId, isActive), (tenantId, lastName, firstName)
--   OrgUnitMembership: (teamId), (personId, status)
--
-- All additive — no existing data or constraints altered.

-- ── Person: tenant scoping ───────────────────────────────────────────────────
ALTER TABLE "Person" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Person" ADD COLUMN "imageUrl"  TEXT;

ALTER TABLE "Person"
  ADD CONSTRAINT "Person_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Person_tenantId_idx"                    ON "Person"("tenantId");
CREATE INDEX "Person_tenantId_isActive_idx"           ON "Person"("tenantId", "isActive");
CREATE INDEX "Person_tenantId_lastName_firstName_idx" ON "Person"("tenantId", "lastName", "firstName");

-- ── OrgUnitMembership: team assignment ───────────────────────────────────────
ALTER TABLE "OrgUnitMembership" ADD COLUMN "teamId" TEXT;

ALTER TABLE "OrgUnitMembership"
  ADD CONSTRAINT "OrgUnitMembership_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "OrgUnitMembership_teamId_idx"         ON "OrgUnitMembership"("teamId");
CREATE INDEX "OrgUnitMembership_personId_status_idx" ON "OrgUnitMembership"("personId", "status");

-- ── Permission: people.delete ────────────────────────────────────────────────
-- PERSONS-01: canonical permanent-deletion permission.
-- grantableByAdmin = true — consistent with other .delete permissions.
-- module = 'PEOPLE', scope = 'TENANT'.
-- Uses ON CONFLICT DO NOTHING to be idempotent if re-run.
INSERT INTO "Permission" ("id", "key", "name", "module", "scope", "grantableByAdmin")
VALUES (
  gen_random_uuid()::text,
  'people.delete',
  'Permanently delete persons',
  'PEOPLE',
  'TENANT',
  true
)
ON CONFLICT ("key") DO NOTHING;
