-- ORG-ACCESS-01: OrgUnit-Scoped Role Assignments Foundation
--
-- Extends UserRole to support optional OrgUnit scope for tenant role assignments.
-- All changes are additive and backward compatible.
-- Existing UserRole rows (orgUnitId IS NULL) represent tenant-wide assignments
-- and continue to work unchanged.
--
-- Scope semantics enforced at service layer:
--   orgUnitId = null  → tenant-wide assignment (existing behavior)
--   orgUnitId set + scopeMode = THIS_ORG_UNIT → exact OrgUnit only
--   orgUnitId set + scopeMode = THIS_ORG_UNIT_AND_DESCENDANTS → OrgUnit + all descendants
--
-- Uniqueness strategy (two partial indexes replace the old @@unique([userId, roleId])):
--   1. (userId, roleId) WHERE orgUnitId IS NULL — exactly one tenant-wide row per (user, role)
--   2. (userId, roleId, orgUnitId) WHERE orgUnitId IS NOT NULL — exactly one scoped row per (user, role, orgUnit)
-- PostgreSQL treats NULLs as distinct in standard UNIQUE constraints, so partial
-- indexes are required to enforce the no-duplicate semantics for the null case.

-- CreateEnum: OrgUnit scope mode
CREATE TYPE "OrgUnitScopeMode" AS ENUM ('THIS_ORG_UNIT', 'THIS_ORG_UNIT_AND_DESCENDANTS');

-- AlterTable: UserRole — add orgUnitId and scopeMode columns (both nullable)
ALTER TABLE "UserRole"
  ADD COLUMN "orgUnitId" TEXT,
  ADD COLUMN "scopeMode" "OrgUnitScopeMode";

-- Drop the existing unique constraint on (userId, roleId)
-- It is replaced by two partial unique indexes below.
DROP INDEX "UserRole_userId_roleId_key";

-- Partial unique index 1: one tenant-wide assignment per (user, role)
CREATE UNIQUE INDEX "UserRole_userId_roleId_no_scope_key"
  ON "UserRole"("userId", "roleId")
  WHERE "orgUnitId" IS NULL;

-- Partial unique index 2: one scoped assignment per (user, role, orgUnit)
CREATE UNIQUE INDEX "UserRole_userId_roleId_scoped_key"
  ON "UserRole"("userId", "roleId", "orgUnitId")
  WHERE "orgUnitId" IS NOT NULL;

-- Standard index for lookups by orgUnitId
CREATE INDEX "UserRole_orgUnitId_idx" ON "UserRole"("orgUnitId");

-- Composite index for tenant + user lookups (permission resolver hot path)
CREATE INDEX "UserRole_userId_tenantId_idx" ON "UserRole"("userId", "tenantId");

-- AddForeignKey: UserRole.orgUnitId → OrgUnit.id
-- SetNull on delete: if an OrgUnit is deleted, the assignment loses its scope
-- (callers should treat a row with orgUnitId=null + scopeMode set as tenant-wide).
-- Note: cleanup of orphaned scopeMode is handled at service layer.
ALTER TABLE "UserRole"
  ADD CONSTRAINT "UserRole_orgUnitId_fkey"
  FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
