-- TRAININGCENTER-03A-FIX: Reconcile stale generated TrainingSessions.
--
-- Adds an explicit RECURRENCE_REMOVED status to TrainingSessionStatus,
-- distinct from CANCELLED:
--
--   CANCELLED           — "this actual scheduled training was cancelled"
--                          (a genuine, manually-set operational status).
--   RECURRENCE_REMOVED  — "this generated occurrence is no longer part of
--                          the TrainingSeries recurrence definition"
--                          (a reconciliation-owned, purely mechanical status).
--
-- No data migration is needed: existing rows keep their current status,
-- and only future regeneration runs will start writing RECURRENCE_REMOVED
-- for occurrences whose date no longer satisfies their series' recurrence
-- rule (see lib/training/session-generation-service.ts).

-- AlterEnum: TrainingSessionStatus — add RECURRENCE_REMOVED
ALTER TYPE "TrainingSessionStatus" ADD VALUE 'RECURRENCE_REMOVED';
