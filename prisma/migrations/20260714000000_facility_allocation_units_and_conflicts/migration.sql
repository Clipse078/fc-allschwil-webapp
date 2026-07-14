-- Phase 2A: Configurable Facilities & Allocation Units
--
-- Changes:
--   1. Add generic FacilityType values: HALL, ROOM
--   2. Add generic FacilityResourceType values: WHOLE_UNIT, PARTIAL_UNIT, SINGLE_ROOM
--   3. Add nullable FK columns to Event: facilityId, allocationUnitId
--   4. Create AllocationConflictRule table with conflict pair semantics
--
-- All changes are backward-compatible: new columns are nullable,
-- existing rows are unaffected, existing enum values are preserved.

-- AlterEnum: FacilityType — add generic categories
ALTER TYPE "FacilityType" ADD VALUE IF NOT EXISTS 'HALL';
ALTER TYPE "FacilityType" ADD VALUE IF NOT EXISTS 'ROOM';

-- AlterEnum: FacilityResourceType — add generic allocation-unit types
ALTER TYPE "FacilityResourceType" ADD VALUE IF NOT EXISTS 'WHOLE_UNIT';
ALTER TYPE "FacilityResourceType" ADD VALUE IF NOT EXISTS 'PARTIAL_UNIT';
ALTER TYPE "FacilityResourceType" ADD VALUE IF NOT EXISTS 'SINGLE_ROOM';

-- AlterTable: Event — add structured facility / allocation-unit references
ALTER TABLE "Event"
  ADD COLUMN "facilityId"       TEXT,
  ADD COLUMN "allocationUnitId" TEXT;

-- CreateTable: AllocationConflictRule
CREATE TABLE "AllocationConflictRule" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "facilityId"  TEXT NOT NULL,
    "resourceAId" TEXT NOT NULL,
    "resourceBId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationConflictRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AllocationConflictRule
CREATE UNIQUE INDEX "AllocationConflictRule_facilityId_resourceAId_resourceBId_key"
  ON "AllocationConflictRule"("facilityId", "resourceAId", "resourceBId");

CREATE INDEX "AllocationConflictRule_tenantId_idx"
  ON "AllocationConflictRule"("tenantId");

CREATE INDEX "AllocationConflictRule_facilityId_idx"
  ON "AllocationConflictRule"("facilityId");

CREATE INDEX "AllocationConflictRule_resourceAId_idx"
  ON "AllocationConflictRule"("resourceAId");

CREATE INDEX "AllocationConflictRule_resourceBId_idx"
  ON "AllocationConflictRule"("resourceBId");

-- CreateIndex: Event new FK columns
CREATE INDEX "Event_facilityId_idx"
  ON "Event"("facilityId");

CREATE INDEX "Event_allocationUnitId_idx"
  ON "Event"("allocationUnitId");

-- AddForeignKey: Event → Facility
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_facilityId_fkey"
  FOREIGN KEY ("facilityId")
  REFERENCES "Facility"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Event → FacilityResource (allocationUnit)
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_allocationUnitId_fkey"
  FOREIGN KEY ("allocationUnitId")
  REFERENCES "FacilityResource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: AllocationConflictRule → Tenant
ALTER TABLE "AllocationConflictRule"
  ADD CONSTRAINT "AllocationConflictRule_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AllocationConflictRule → Facility
ALTER TABLE "AllocationConflictRule"
  ADD CONSTRAINT "AllocationConflictRule_facilityId_fkey"
  FOREIGN KEY ("facilityId")
  REFERENCES "Facility"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AllocationConflictRule → FacilityResource (resourceA)
ALTER TABLE "AllocationConflictRule"
  ADD CONSTRAINT "AllocationConflictRule_resourceAId_fkey"
  FOREIGN KEY ("resourceAId")
  REFERENCES "FacilityResource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AllocationConflictRule → FacilityResource (resourceB)
ALTER TABLE "AllocationConflictRule"
  ADD CONSTRAINT "AllocationConflictRule_resourceBId_fkey"
  FOREIGN KEY ("resourceBId")
  REFERENCES "FacilityResource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
