-- ORG-ACCESS-01-C1: Post-Merge Scoped Assignment Deletion Safety
--
-- Fixes a data-integrity risk introduced in ORG-ACCESS-01:
-- The original FK used ON DELETE SET NULL, which would set orgUnitId to NULL
-- while leaving scopeMode unchanged when an OrgUnit is hard-deleted.
-- This creates malformed rows where orgUnitId=null + scopeMode!=null,
-- which could be misread as tenant-wide assignments.
--
-- Fix: change the FK to ON DELETE CASCADE so that permanently deleting
-- an OrgUnit also removes all UserRole rows scoped to that OrgUnit.
-- Tenant-wide assignments (orgUnitId IS NULL) are completely unaffected.

-- Drop the existing FK that uses SET NULL behavior
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_orgUnitId_fkey";

-- Re-add the FK with CASCADE delete so scoped rows are removed along with their OrgUnit
ALTER TABLE "UserRole"
  ADD CONSTRAINT "UserRole_orgUnitId_fkey"
  FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
