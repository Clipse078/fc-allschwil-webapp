-- WEEKPLANNER-01D: Alternative Time Overrides
--
-- Adds the smallest sparse persisted representation for an alternative
-- plan's per-activity start/end TIME override — never a duplicate of the
-- canonical TrainingSession/Event row, and never mutates it. Mirrors
-- WeekplannerPlanAllocation's architecture (see
-- 20260809160000_weekplanner_01b_planning_variants/migration.sql), but has
-- no FacilityResource foreign key since a time override targets no
-- resource.
--
-- Changes:
--   1. Create WeekplannerPlanActivityOverride table with foreign keys and
--      indexes, unique per (weekplannerPlanId, activityType, activityId).

-- CreateTable
CREATE TABLE "WeekplannerPlanActivityOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekplannerPlanId" TEXT NOT NULL,
    "activityType" "WeekplannerActivityType" NOT NULL,
    "activityId" TEXT NOT NULL,
    "overrideStartAt" TIMESTAMP(3),
    "overrideEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekplannerPlanActivityOverride_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeekplannerPlanActivityOverride" ADD CONSTRAINT "WeekplannerPlanActivityOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekplannerPlanActivityOverride" ADD CONSTRAINT "WeekplannerPlanActivityOverride_weekplannerPlanId_fkey" FOREIGN KEY ("weekplannerPlanId") REFERENCES "WeekplannerPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "WeekplannerPlanActivityOverride_tenantId_idx" ON "WeekplannerPlanActivityOverride"("tenantId");

-- CreateIndex
CREATE INDEX "WeekplannerPlanActivityOverride_weekplannerPlanId_idx" ON "WeekplannerPlanActivityOverride"("weekplannerPlanId");

-- One time-override row per activity, per plan.
CREATE UNIQUE INDEX "WeekplannerPlanActivityOverride_weekplannerPlanId_activityT_key" ON "WeekplannerPlanActivityOverride"("weekplannerPlanId", "activityType", "activityId");
