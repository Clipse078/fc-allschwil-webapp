-- WEEKPLANNER-01E: Operational Plan Activation Foundation
--
-- Adds the smallest persisted concept of which WeekplannerPlan (if any) is
-- OPERATIONALLY active for a tenant+week — consumed later by
-- Infoboard/Website publication (not wired in this slice). Standardplan
-- remains implicit: no row is ever created for it; "no active alternative
-- plan" IS the Standardplan operationally active state.
--
-- Changes:
--   1. Add WeekplannerPlan.isActive (default false).
--   2. Add supporting index for (tenantId, weekId, isActive) lookups.
--   3. Add partial unique index enforcing at most ONE active, non-archived
--      WeekplannerPlan per (tenantId, weekId) — mirrors the identical
--      TrainingPlan.isDefault technique (see
--      20260727500000_training_plans_01_tenant_defined_plans/migration.sql).

-- =============================================================================
-- 1. Add isActive column
-- =============================================================================

ALTER TABLE "WeekplannerPlan" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

-- =============================================================================
-- 2. Supporting index
-- =============================================================================

CREATE INDEX "WeekplannerPlan_tenantId_weekId_isActive_idx" ON "WeekplannerPlan"("tenantId", "weekId", "isActive");

-- =============================================================================
-- 3. Partial unique index — at most one active, non-archived plan per
--    (tenantId, weekId). Prisma cannot express partial indexes natively, so
--    this is raw SQL.
-- =============================================================================

CREATE UNIQUE INDEX "WeekplannerPlan_tenantId_weekId_isActive_unique"
    ON "WeekplannerPlan"("tenantId", "weekId")
    WHERE ("isActive" = true AND "archivedAt" IS NULL);
