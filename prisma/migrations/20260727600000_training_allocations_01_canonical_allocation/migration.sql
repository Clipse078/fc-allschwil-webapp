-- TRAINING-ALLOCATIONS-01: Canonical Training Resource Allocation
--
-- Introduces TrainingAllocation — the single source of truth for which
-- FacilityResources are allocated to a canonical TrainingSeries.
--
-- Architecture:
--   TrainingSeries → TrainingAllocation → FacilityResource
--
-- Changes:
--   1. Create TrainingAllocation table with foreign keys and indexes.
--   2. Add trainingAllocations back-relation to FacilityResource (no DDL change,
--      handled entirely via back-relation in schema).

-- =============================================================================
-- 1. Create TrainingAllocation table
-- =============================================================================

CREATE TABLE "TrainingAllocation" (
    "id"                 TEXT         NOT NULL,
    "tenantId"           TEXT         NOT NULL,
    "trainingSeriesId"   TEXT         NOT NULL,
    "facilityResourceId" TEXT         NOT NULL,
    "notes"              TEXT,
    "displayOrder"       INTEGER      NOT NULL DEFAULT 0,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingAllocation_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- 2. Uniqueness: at most one allocation per (trainingSeriesId, facilityResourceId)
-- =============================================================================

ALTER TABLE "TrainingAllocation"
    ADD CONSTRAINT "TrainingAllocation_trainingSeriesId_facilityResourceId_key"
    UNIQUE ("trainingSeriesId", "facilityResourceId");

-- =============================================================================
-- 3. Foreign keys
-- =============================================================================

ALTER TABLE "TrainingAllocation"
    ADD CONSTRAINT "TrainingAllocation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingAllocation"
    ADD CONSTRAINT "TrainingAllocation_trainingSeriesId_fkey"
    FOREIGN KEY ("trainingSeriesId") REFERENCES "TrainingSeries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingAllocation"
    ADD CONSTRAINT "TrainingAllocation_facilityResourceId_fkey"
    FOREIGN KEY ("facilityResourceId") REFERENCES "FacilityResource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- 4. Indexes
-- =============================================================================

CREATE INDEX "TrainingAllocation_tenantId_idx"
    ON "TrainingAllocation"("tenantId");

CREATE INDEX "TrainingAllocation_trainingSeriesId_idx"
    ON "TrainingAllocation"("trainingSeriesId");

CREATE INDEX "TrainingAllocation_facilityResourceId_idx"
    ON "TrainingAllocation"("facilityResourceId");

CREATE INDEX "TrainingAllocation_tenantId_trainingSeriesId_idx"
    ON "TrainingAllocation"("tenantId", "trainingSeriesId");
