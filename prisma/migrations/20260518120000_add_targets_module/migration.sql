-- AlterEnum: Add TARGETS to PermissionModule
ALTER TYPE "PermissionModule" ADD VALUE 'TARGETS';

-- CreateEnum: TargetCategory
CREATE TYPE "TargetCategory" AS ENUM ('SPORTLICHE_ENTWICKLUNG', 'MITGLIEDERWACHSTUM', 'FINANZEN', 'AUSBILDUNG', 'MEDIEN_SOZIALES', 'GOVERNANCE');

-- CreateEnum: TargetStatus
CREATE TYPE "TargetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum: TargetPeriod
CREATE TYPE "TargetPeriod" AS ENUM ('SEASON', 'QUARTER', 'YEAR', 'CUSTOM');

-- CreateEnum: TargetMetricType
CREATE TYPE "TargetMetricType" AS ENUM ('PERCENTAGE', 'NUMERIC', 'CURRENCY', 'BOOLEAN');

-- CreateEnum: TargetDirection
CREATE TYPE "TargetDirection" AS ENUM ('INCREASE', 'DECREASE', 'MAINTAIN');

-- CreateTable: Target
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TargetCategory" NOT NULL DEFAULT 'SPORTLICHE_ENTWICKLUNG',
    "status" "TargetStatus" NOT NULL DEFAULT 'ACTIVE',
    "period" "TargetPeriod" NOT NULL DEFAULT 'SEASON',
    "periodLabel" TEXT,
    "moduleKey" TEXT,
    "sportCategory" TEXT,
    "ageGroupHint" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "nudgeJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TargetMetric
CREATE TABLE "TargetMetric" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TargetMetricType" NOT NULL DEFAULT 'PERCENTAGE',
    "direction" "TargetDirection" NOT NULL DEFAULT 'INCREASE',
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TargetDataPoint
CREATE TABLE "TargetDataPoint" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TargetDataPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Target_category_idx" ON "Target"("category");
CREATE INDEX "Target_status_idx" ON "Target"("status");
CREATE INDEX "Target_period_idx" ON "Target"("period");

CREATE INDEX "TargetMetric_targetId_idx" ON "TargetMetric"("targetId");
CREATE INDEX "TargetMetric_targetId_sortOrder_idx" ON "TargetMetric"("targetId", "sortOrder");

CREATE INDEX "TargetDataPoint_metricId_idx" ON "TargetDataPoint"("metricId");
CREATE INDEX "TargetDataPoint_measuredAt_idx" ON "TargetDataPoint"("measuredAt");

-- AddForeignKey
ALTER TABLE "TargetMetric" ADD CONSTRAINT "TargetMetric_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TargetDataPoint" ADD CONSTRAINT "TargetDataPoint_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "TargetMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
