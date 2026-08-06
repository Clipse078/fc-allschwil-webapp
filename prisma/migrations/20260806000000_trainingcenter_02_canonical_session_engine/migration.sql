-- TRAININGCENTER-02: Canonical Training Session Engine (Foundation)
--
-- Introduces TrainingSession — the canonical, dated occurrence generated
-- from a recurring TrainingSeries.
--
-- Architecture:
--   TrainingSeries → TrainingSession (generated) → many consumers
--
-- Changes:
--   1. Create TrainingSessionStatus enum.
--   2. Create TrainingSession table.
--   3. Foreign keys to Tenant, TrainingSeries, TeamSeason.
--   4. Uniqueness: one generated session per (trainingSeriesId, date).

-- CreateEnum: TrainingSessionStatus
CREATE TYPE "TrainingSessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'POSTPONED', 'MOVED');

-- CreateTable: TrainingSession
CREATE TABLE "TrainingSession" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "trainingSeriesId" TEXT NOT NULL,
    "teamSeasonId"     TEXT NOT NULL,
    "date"             TIMESTAMP(3) NOT NULL,
    "weekday"          "Weekday" NOT NULL,
    "startAt"          TIMESTAMP(3) NOT NULL,
    "endAt"            TIMESTAMP(3) NOT NULL,
    "timezone"         TEXT NOT NULL,
    "status"           "TrainingSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: TrainingSession — one generated session per series per date
CREATE UNIQUE INDEX "TrainingSession_trainingSeriesId_date_key" ON "TrainingSession"("trainingSeriesId", "date");

-- CreateIndex: TrainingSession lookup indexes
CREATE INDEX "TrainingSession_tenantId_idx" ON "TrainingSession"("tenantId");
CREATE INDEX "TrainingSession_trainingSeriesId_idx" ON "TrainingSession"("trainingSeriesId");
CREATE INDEX "TrainingSession_teamSeasonId_idx" ON "TrainingSession"("teamSeasonId");
CREATE INDEX "TrainingSession_tenantId_date_idx" ON "TrainingSession"("tenantId", "date");
CREATE INDEX "TrainingSession_teamSeasonId_date_idx" ON "TrainingSession"("teamSeasonId", "date");
CREATE INDEX "TrainingSession_tenantId_status_idx" ON "TrainingSession"("tenantId", "status");

-- AddForeignKey: TrainingSession → Tenant
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TrainingSession → TrainingSeries
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainingSeriesId_fkey" FOREIGN KEY ("trainingSeriesId") REFERENCES "TrainingSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TrainingSession → TeamSeason
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_teamSeasonId_fkey" FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
