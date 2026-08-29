-- WOCHENPLAN-2.0-01H-E2 — resource occupancy persistence on WeekplannerPlanAllocation.
--
-- Adds optional before/after buffer minutes per sparse plan allocation row.
-- Defaults 0/0 preserve backward compatibility for all existing rows.

ALTER TABLE "WeekplannerPlanAllocation"
  ADD COLUMN "occupancyBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "occupancyAfterMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WeekplannerPlanAllocation"
  ADD CONSTRAINT "WeekplannerPlanAllocation_occupancyBeforeMinutes_non_negative"
    CHECK ("occupancyBeforeMinutes" >= 0);

ALTER TABLE "WeekplannerPlanAllocation"
  ADD CONSTRAINT "WeekplannerPlanAllocation_occupancyAfterMinutes_non_negative"
    CHECK ("occupancyAfterMinutes" >= 0);
