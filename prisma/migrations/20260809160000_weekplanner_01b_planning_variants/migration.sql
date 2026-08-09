-- WEEKPLANNER-01B: Multiple Planning Variants
--
-- Adds the smallest safe foundation for MULTIPLE named, tenant-defined
-- alternative Weekplanner variants per week (Standardplan remains
-- implicit — the existing canonical allocations already resolved by
-- WEEKPLANNER-01A. Only ALTERNATIVE plans are persisted here, as sparse
-- resource-allocation overrides — never a duplicate of the canonical
-- TrainingSession / Event(MATCH) / Event(TOURNAMENT) activity itself).
--
-- Changes:
--   1. Create WeekplannerActivityType enum.
--   2. Create WeekplannerAllocationGroup enum.
--   3. Create WeekplannerPlan table with foreign key and indexes.
--   4. Create WeekplannerPlanAllocation table with foreign keys and indexes.
--   5. Add partial unique index for plan name uniqueness among non-archived
--      plans within (tenantId, weekId) — mirrors the identical
--      TrainingPlan.name technique (see
--      20260727500000_training_plans_01_tenant_defined_plans/migration.sql).

-- =============================================================================
-- 1-2. Create enums
-- =============================================================================

-- CreateEnum
CREATE TYPE "WeekplannerActivityType" AS ENUM ('TRAINING', 'MATCH', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "WeekplannerAllocationGroup" AS ENUM ('PITCH_HALL', 'DRESSING_ROOM');

-- =============================================================================
-- 3. Create WeekplannerPlan table
-- =============================================================================

-- CreateTable
CREATE TABLE "WeekplannerPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WeekplannerPlan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeekplannerPlan" ADD CONSTRAINT "WeekplannerPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "WeekplannerPlan_tenantId_idx" ON "WeekplannerPlan"("tenantId");

-- CreateIndex
CREATE INDEX "WeekplannerPlan_tenantId_weekId_idx" ON "WeekplannerPlan"("tenantId", "weekId");

-- CreateIndex
CREATE INDEX "WeekplannerPlan_tenantId_weekId_archivedAt_idx" ON "WeekplannerPlan"("tenantId", "weekId", "archivedAt");

-- Plan name is unique (case-insensitive) among non-archived plans within
-- (tenantId, weekId). Prisma cannot express partial indexes natively, so
-- this is raw SQL.
CREATE UNIQUE INDEX "WeekplannerPlan_tenantId_weekId_name_unique"
    ON "WeekplannerPlan"(lower("name"), "tenantId", "weekId")
    WHERE ("archivedAt" IS NULL);

-- =============================================================================
-- 4. Create WeekplannerPlanAllocation table
-- =============================================================================

-- CreateTable
CREATE TABLE "WeekplannerPlanAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekplannerPlanId" TEXT NOT NULL,
    "activityType" "WeekplannerActivityType" NOT NULL,
    "activityId" TEXT NOT NULL,
    "allocationGroup" "WeekplannerAllocationGroup" NOT NULL,
    "participantId" TEXT NOT NULL DEFAULT '',
    "facilityResourceId" TEXT NOT NULL,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekplannerPlanAllocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeekplannerPlanAllocation" ADD CONSTRAINT "WeekplannerPlanAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekplannerPlanAllocation" ADD CONSTRAINT "WeekplannerPlanAllocation_weekplannerPlanId_fkey" FOREIGN KEY ("weekplannerPlanId") REFERENCES "WeekplannerPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekplannerPlanAllocation" ADD CONSTRAINT "WeekplannerPlanAllocation_facilityResourceId_fkey" FOREIGN KEY ("facilityResourceId") REFERENCES "FacilityResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "WeekplannerPlanAllocation_tenantId_idx" ON "WeekplannerPlanAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "WeekplannerPlanAllocation_weekplannerPlanId_idx" ON "WeekplannerPlanAllocation"("weekplannerPlanId");

-- CreateIndex
CREATE INDEX "WeekplannerPlanAllocation_weekplannerPlanId_activityType_ac_idx" ON "WeekplannerPlanAllocation"("weekplannerPlanId", "activityType", "activityId");

-- CreateIndex
CREATE INDEX "WeekplannerPlanAllocation_facilityResourceId_idx" ON "WeekplannerPlanAllocation"("facilityResourceId");

-- Prevent a duplicate override of the same resource for the same activity +
-- group + participant within one plan.
CREATE UNIQUE INDEX "WeekplannerPlanAllocation_weekplannerPlanId_activityType_ac_key" ON "WeekplannerPlanAllocation"("weekplannerPlanId", "activityType", "activityId", "allocationGroup", "participantId", "facilityResourceId");
