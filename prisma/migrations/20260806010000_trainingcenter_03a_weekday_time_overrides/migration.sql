-- TRAININGCENTER-03A: Make TrainingCenter usable
--
-- Adds optional per-weekday start/end time overrides to
-- TrainingSeriesRecurrenceDay so a recurring series can meet at different
-- times on different weekdays (e.g. Monday 17:00–18:00, Wednesday
-- 16:00–17:00), per the create/edit form introduced in this slice.
--
-- Additive only, no breaking changes:
--   - Both columns are nullable. NULL means "fall back to the parent
--     TrainingSeries.startsAt/endsAt for this weekday" — existing rows
--     (uniform time across all weekdays) resolve exactly as before.

-- AlterTable
ALTER TABLE "TrainingSeriesRecurrenceDay" ADD COLUMN "startsAt" TEXT,
ADD COLUMN "endsAt" TEXT;
