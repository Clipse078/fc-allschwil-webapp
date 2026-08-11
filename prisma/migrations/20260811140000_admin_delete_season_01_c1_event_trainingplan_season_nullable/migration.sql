-- ADMIN-DELETE-SEASON-01-C1: Make Event.seasonId and TrainingPlan.seasonId nullable.
--
-- Previously both fields were required (NOT NULL) with a CASCADE FK to Season,
-- meaning deleting a Season would irrecoverably destroy all associated Events/Matches
-- and TrainingPlans. This migration decouples canonical event and training-plan
-- history from Season lifecycle: Season deletion now sets seasonId to NULL on
-- surviving records (SET NULL) rather than cascading the delete.
--
-- TeamSeason retains CASCADE (those join-table rows are intentionally cleaned up
-- when their Season is removed — the Team record itself is never touched).
--
-- EventImportRun.seasonId and OrgUnitMembership.seasonId were already nullable
-- with SET NULL and remain unchanged.
--
-- Changes:
--   Event.seasonId           NOT NULL → NULL, FK action: CASCADE → SET NULL
--   TrainingPlan.seasonId    NOT NULL → NULL, FK action: CASCADE → SET NULL

-- Drop old FK constraints
ALTER TABLE "Event" DROP CONSTRAINT "Event_seasonId_fkey";
ALTER TABLE "TrainingPlan" DROP CONSTRAINT "TrainingPlan_seasonId_fkey";

-- Make columns nullable
ALTER TABLE "Event" ALTER COLUMN "seasonId" DROP NOT NULL;
ALTER TABLE "TrainingPlan" ALTER COLUMN "seasonId" DROP NOT NULL;

-- Re-add FK constraints with SET NULL on delete
ALTER TABLE "Event" ADD CONSTRAINT "Event_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
