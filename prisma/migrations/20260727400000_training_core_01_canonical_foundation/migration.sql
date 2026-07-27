-- TRAINING-CORE-01: Canonical Training Foundation
--
-- Introduces TrainingSeries as the canonical recurring training identity used
-- by every SportClubEvo training-related module.
--
-- Architecture:
--   Organisation → Team → TeamSeason → TrainingSeries
--
-- Changes:
--   1. Add TRAININGS to PermissionModule enum.
--   2. Create TrainingSeriesStatus enum.
--   3. Create Weekday enum.
--   4. Create TrainingSeries table.
--   5. Create TrainingSeriesRecurrenceDay table.

-- AlterEnum: add TRAININGS to PermissionModule
ALTER TYPE "PermissionModule" ADD VALUE 'TRAININGS';

-- CreateEnum: TrainingSeriesStatus
CREATE TYPE "TrainingSeriesStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum: Weekday
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable: TrainingSeries
CREATE TABLE "TrainingSeries" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "teamSeasonId" TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "status"       "TrainingSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt"     TEXT NOT NULL,
    "endsAt"       TEXT NOT NULL,
    "timezone"     TEXT NOT NULL DEFAULT 'UTC',
    "validFrom"    TIMESTAMP(3),
    "validUntil"   TIMESTAMP(3),
    "archivedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TrainingSeriesRecurrenceDay
CREATE TABLE "TrainingSeriesRecurrenceDay" (
    "id"               TEXT NOT NULL,
    "trainingSeriesId" TEXT NOT NULL,
    "weekday"          "Weekday" NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSeriesRecurrenceDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: TrainingSeries — title unique within TeamSeason
CREATE UNIQUE INDEX "TrainingSeries_teamSeasonId_title_key" ON "TrainingSeries"("teamSeasonId", "title");

-- CreateIndex: TrainingSeries lookup indexes
CREATE INDEX "TrainingSeries_tenantId_idx" ON "TrainingSeries"("tenantId");
CREATE INDEX "TrainingSeries_teamSeasonId_idx" ON "TrainingSeries"("teamSeasonId");
CREATE INDEX "TrainingSeries_tenantId_status_idx" ON "TrainingSeries"("tenantId", "status");
CREATE INDEX "TrainingSeries_teamSeasonId_status_idx" ON "TrainingSeries"("teamSeasonId", "status");

-- CreateIndex: TrainingSeriesRecurrenceDay — one row per weekday per series
CREATE UNIQUE INDEX "TrainingSeriesRecurrenceDay_trainingSeriesId_weekday_key" ON "TrainingSeriesRecurrenceDay"("trainingSeriesId", "weekday");

-- CreateIndex: TrainingSeriesRecurrenceDay lookup index
CREATE INDEX "TrainingSeriesRecurrenceDay_trainingSeriesId_idx" ON "TrainingSeriesRecurrenceDay"("trainingSeriesId");

-- AddForeignKey: TrainingSeries → Tenant
ALTER TABLE "TrainingSeries" ADD CONSTRAINT "TrainingSeries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TrainingSeries → TeamSeason
ALTER TABLE "TrainingSeries" ADD CONSTRAINT "TrainingSeries_teamSeasonId_fkey" FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TrainingSeriesRecurrenceDay → TrainingSeries
ALTER TABLE "TrainingSeriesRecurrenceDay" ADD CONSTRAINT "TrainingSeriesRecurrenceDay_trainingSeriesId_fkey" FOREIGN KEY ("trainingSeriesId") REFERENCES "TrainingSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
