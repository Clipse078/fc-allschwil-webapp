-- ============================================================
-- Migration: add_targets_module
-- Standalone Targets module — replaces the static KPI page.
-- A Target tracks a measurable goal; TargetMetric holds the
-- measurement definition; TargetDataPoint holds time-series readings.
-- Designed for the SportClubEvo strategy nudging architecture.
-- ============================================================

-- Add TARGETS to PermissionModule enum
ALTER TYPE "PermissionModule" ADD VALUE 'TARGETS';

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ACHIEVED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TargetMetricType" AS ENUM ('NUMBER', 'PERCENTAGE', 'CURRENCY', 'BOOLEAN', 'RATIO', 'SCORE');

-- CreateEnum
CREATE TYPE "TargetPeriodType" AS ENUM ('ONCE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEASONAL', 'ANNUAL', 'MULTI_YEAR');

-- CreateEnum
CREATE TYPE "TargetDirection" AS ENUM ('INCREASE', 'DECREASE', 'MAINTAIN', 'ACHIEVE');

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "tenantSlug" TEXT NOT NULL DEFAULT 'fc-allschwil',
    "seasonId" TEXT,
    "teamId" TEXT,
    "orgUnitLabel" TEXT,
    "moduleKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TargetStatus" NOT NULL DEFAULT 'DRAFT',
    "metricType" "TargetMetricType",
    "direction" "TargetDirection",
    "targetValue" DOUBLE PRECISION,
    "unit" TEXT,
    "periodType" "TargetPeriodType",
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "targetCategory" TEXT,
    "sportCategory" TEXT,
    "ageGroupHint" TEXT,
    "suggestedTemplateKey" TEXT,
    "suggestedBySystem" BOOLEAN NOT NULL DEFAULT false,
    "recommendedRangeMin" DOUBLE PRECISION,
    "recommendedRangeMax" DOUBLE PRECISION,
    "recommendationConfidence" DOUBLE PRECISION,
    "benchmarkSource" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetMetric" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "metricType" "TargetMetricType" NOT NULL,
    "direction" "TargetDirection" NOT NULL DEFAULT 'INCREASE',
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetDataPoint" (
    "id" TEXT NOT NULL,
    "targetMetricId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TargetDataPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Target_tenantSlug_status_idx" ON "Target"("tenantSlug", "status");

-- CreateIndex
CREATE INDEX "Target_tenantSlug_moduleKey_idx" ON "Target"("tenantSlug", "moduleKey");

-- CreateIndex
CREATE INDEX "Target_tenantSlug_endsAt_idx" ON "Target"("tenantSlug", "endsAt");

-- CreateIndex
CREATE INDEX "Target_tenantSlug_targetCategory_idx" ON "Target"("tenantSlug", "targetCategory");

-- CreateIndex
CREATE INDEX "Target_seasonId_idx" ON "Target"("seasonId");

-- CreateIndex
CREATE INDEX "Target_teamId_idx" ON "Target"("teamId");

-- CreateIndex
CREATE INDEX "Target_orgUnitLabel_idx" ON "Target"("orgUnitLabel");

-- CreateIndex
CREATE INDEX "Target_status_idx" ON "Target"("status");

-- CreateIndex
CREATE INDEX "Target_moduleKey_idx" ON "Target"("moduleKey");

-- CreateIndex
CREATE INDEX "Target_suggestedBySystem_idx" ON "Target"("suggestedBySystem");

-- CreateIndex
CREATE INDEX "TargetMetric_targetId_sortOrder_idx" ON "TargetMetric"("targetId", "sortOrder");

-- CreateIndex
CREATE INDEX "TargetMetric_targetId_metricType_idx" ON "TargetMetric"("targetId", "metricType");

-- CreateIndex
CREATE INDEX "TargetDataPoint_targetMetricId_measuredAt_idx" ON "TargetDataPoint"("targetMetricId", "measuredAt");

-- CreateIndex
CREATE INDEX "TargetDataPoint_measuredAt_idx" ON "TargetDataPoint"("measuredAt");

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetMetric" ADD CONSTRAINT "TargetMetric_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetDataPoint" ADD CONSTRAINT "TargetDataPoint_targetMetricId_fkey" FOREIGN KEY ("targetMetricId") REFERENCES "TargetMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
