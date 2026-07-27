-- TRAINING-PLANS-01: Tenant-Defined Training Plans
--
-- Introduces TrainingPlan and TrainingPlanAssignment as the configuration
-- layer that connects canonical TrainingSeries to tenant-defined weekly plans.
--
-- Architecture:
--   TeamSeason → TrainingSeries → TrainingPlanAssignment → TrainingPlan
--
-- Changes:
--   1. Drop TrainingSeries title uniqueness per TeamSeason (corrective).
--   2. Create TrainingPlanStatus enum.
--   3. Create MissingAssignmentBehavior enum.
--   4. Create TrainingPlanAssignmentStatus enum.
--   5. Create TrainingPlan table with foreign keys and indexes.
--   6. Create TrainingPlanAssignment table with foreign keys and indexes.
--   7. Add partial unique index for one non-archived default plan per tenant+season.
--   8. Add partial unique index for plan name uniqueness among non-archived plans.

-- =============================================================================
-- 1. Drop TrainingSeries title uniqueness per TeamSeason (TRAINING-PLANS-01 corrective)
--
-- The strict per-TeamSeason title uniqueness introduced by TRAINING-CORE-01 is
-- removed here because it blocks valid operational scenarios (e.g. two parallel
-- training groups sharing the same display title within a TeamSeason).
-- Title validation (non-empty, trimmed, max length) is retained at service layer.
-- =============================================================================
DROP INDEX IF EXISTS "TrainingSeries_teamSeasonId_title_key";

-- =============================================================================
-- 2. Create enums
-- =============================================================================

-- CreateEnum: TrainingPlanStatus
CREATE TYPE "TrainingPlanStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum: MissingAssignmentBehavior
CREATE TYPE "MissingAssignmentBehavior" AS ENUM ('FALLBACK_TO_DEFAULT', 'NOT_SCHEDULED');

-- CreateEnum: TrainingPlanAssignmentStatus
CREATE TYPE "TrainingPlanAssignmentStatus" AS ENUM ('SCHEDULED', 'NOT_SCHEDULED');

-- =============================================================================
-- 3. Create TrainingPlan table
-- =============================================================================

CREATE TABLE "TrainingPlan" (
    "id"                        TEXT NOT NULL,
    "tenantId"                  TEXT NOT NULL,
    "seasonId"                  TEXT NOT NULL,
    "name"                      TEXT NOT NULL,
    "description"               TEXT,
    "status"                    "TrainingPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault"                 BOOLEAN NOT NULL DEFAULT false,
    "displayOrder"              INTEGER NOT NULL DEFAULT 0,
    "missingAssignmentBehavior" "MissingAssignmentBehavior" NOT NULL DEFAULT 'FALLBACK_TO_DEFAULT',
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                 TIMESTAMP(3) NOT NULL,
    "archivedAt"                TIMESTAMP(3),

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "TrainingPlan"
    ADD CONSTRAINT "TrainingPlan_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingPlan"
    ADD CONSTRAINT "TrainingPlan_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Standard indexes
CREATE INDEX "TrainingPlan_tenantId_idx"                ON "TrainingPlan"("tenantId");
CREATE INDEX "TrainingPlan_tenantId_seasonId_idx"       ON "TrainingPlan"("tenantId", "seasonId");
CREATE INDEX "TrainingPlan_tenantId_seasonId_status_idx" ON "TrainingPlan"("tenantId", "seasonId", "status");
CREATE INDEX "TrainingPlan_tenantId_isDefault_idx"      ON "TrainingPlan"("tenantId", "isDefault");

-- =============================================================================
-- 4. Partial unique indexes for TrainingPlan
--
-- 4a. At most one non-archived default plan per (tenantId, seasonId).
--     Prisma cannot express partial indexes natively, so this is raw SQL.
-- =============================================================================

CREATE UNIQUE INDEX "TrainingPlan_tenantId_seasonId_isDefault_unique"
    ON "TrainingPlan"("tenantId", "seasonId")
    WHERE ("isDefault" = true AND "archivedAt" IS NULL);

-- 4b. Plan name is unique among non-archived plans within (tenantId, seasonId).
--     Case-insensitive comparison is enforced at service layer (lower(name)).
--     The DB index stores the case-normalised name for uniqueness enforcement.

CREATE UNIQUE INDEX "TrainingPlan_tenantId_seasonId_name_unique"
    ON "TrainingPlan"(lower("name"), "tenantId", "seasonId")
    WHERE ("archivedAt" IS NULL);

-- =============================================================================
-- 5. Create TrainingPlanAssignment table
-- =============================================================================

CREATE TABLE "TrainingPlanAssignment" (
    "id"                TEXT NOT NULL,
    "tenantId"          TEXT NOT NULL,
    "trainingPlanId"    TEXT NOT NULL,
    "trainingSeriesId"  TEXT NOT NULL,
    "startTimeOverride" TEXT,
    "endTimeOverride"   TEXT,
    "timezoneOverride"  TEXT,
    "status"            "TrainingPlanAssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- Uniqueness: at most one assignment per plan+series
ALTER TABLE "TrainingPlanAssignment"
    ADD CONSTRAINT "TrainingPlanAssignment_trainingPlanId_trainingSeriesId_key"
    UNIQUE ("trainingPlanId", "trainingSeriesId");

-- Foreign keys
ALTER TABLE "TrainingPlanAssignment"
    ADD CONSTRAINT "TrainingPlanAssignment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingPlanAssignment"
    ADD CONSTRAINT "TrainingPlanAssignment_trainingPlanId_fkey"
    FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingPlanAssignment"
    ADD CONSTRAINT "TrainingPlanAssignment_trainingSeriesId_fkey"
    FOREIGN KEY ("trainingSeriesId") REFERENCES "TrainingSeries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "TrainingPlanAssignment_tenantId_idx"            ON "TrainingPlanAssignment"("tenantId");
CREATE INDEX "TrainingPlanAssignment_trainingPlanId_idx"      ON "TrainingPlanAssignment"("trainingPlanId");
CREATE INDEX "TrainingPlanAssignment_trainingSeriesId_idx"    ON "TrainingPlanAssignment"("trainingSeriesId");
CREATE INDEX "TrainingPlanAssignment_tenantId_planId_idx"     ON "TrainingPlanAssignment"("tenantId", "trainingPlanId");
