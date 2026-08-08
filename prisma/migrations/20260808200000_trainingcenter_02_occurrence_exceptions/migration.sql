-- TRAININGCENTER-02: Canonical Training Exceptions & Operational Completion
--
-- Adds the smallest occurrence-override model needed to edit/reschedule a
-- single generated TrainingSession (date/time) and to override its
-- Spielfeld/Halle + Garderobe allocation, without ever mutating the parent
-- TrainingSeries recurrence definition or the canonical TrainingSession
-- identity (trainingSeriesId, date).
--
-- Changes:
--   1. Add nullable schedule-override columns to TrainingSession
--      (overrideDate / overrideStartAt / overrideEndAt). These are
--      additive, always nullable, and never touched by
--      session-generation-service.ts regeneration/reconciliation.
--   2. Create TrainingSessionAllocation — occurrence-level mirror of
--      TrainingAllocation, scoped to a single TrainingSession instead of
--      the recurring TrainingSeries.

-- =============================================================================
-- 1. TrainingSession: occurrence-level schedule override columns
-- =============================================================================

ALTER TABLE "TrainingSession"
    ADD COLUMN "overrideDate"    TIMESTAMP(3),
    ADD COLUMN "overrideStartAt" TIMESTAMP(3),
    ADD COLUMN "overrideEndAt"   TIMESTAMP(3);

-- =============================================================================
-- 2. Create TrainingSessionAllocation table
-- =============================================================================

CREATE TABLE "TrainingSessionAllocation" (
    "id"                 TEXT         NOT NULL,
    "tenantId"           TEXT         NOT NULL,
    "trainingSessionId"  TEXT         NOT NULL,
    "facilityResourceId" TEXT         NOT NULL,
    "notes"              TEXT,
    "displayOrder"       INTEGER      NOT NULL DEFAULT 0,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSessionAllocation_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- 3. Uniqueness: at most one override allocation per (trainingSessionId, facilityResourceId)
-- =============================================================================

ALTER TABLE "TrainingSessionAllocation"
    ADD CONSTRAINT "TrainingSessionAllocation_trainingSessionId_facilityResour_key"
    UNIQUE ("trainingSessionId", "facilityResourceId");

-- =============================================================================
-- 4. Foreign keys
-- =============================================================================

ALTER TABLE "TrainingSessionAllocation"
    ADD CONSTRAINT "TrainingSessionAllocation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingSessionAllocation"
    ADD CONSTRAINT "TrainingSessionAllocation_trainingSessionId_fkey"
    FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingSessionAllocation"
    ADD CONSTRAINT "TrainingSessionAllocation_facilityResourceId_fkey"
    FOREIGN KEY ("facilityResourceId") REFERENCES "FacilityResource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- 5. Indexes
-- =============================================================================

CREATE INDEX "TrainingSessionAllocation_tenantId_idx"
    ON "TrainingSessionAllocation"("tenantId");

CREATE INDEX "TrainingSessionAllocation_trainingSessionId_idx"
    ON "TrainingSessionAllocation"("trainingSessionId");

CREATE INDEX "TrainingSessionAllocation_facilityResourceId_idx"
    ON "TrainingSessionAllocation"("facilityResourceId");

CREATE INDEX "TrainingSessionAllocation_tenantId_trainingSessionId_idx"
    ON "TrainingSessionAllocation"("tenantId", "trainingSessionId");
