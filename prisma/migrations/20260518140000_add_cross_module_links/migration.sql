-- AlterTable: Add cross-module linking fields to Target
-- Phase 1: JSON refs (slug + title). Phase 2 will migrate to proper FK relations
-- once Meeting and Initiative are promoted to DB-backed models.
ALTER TABLE "Target"
  ADD COLUMN "linkedInitiativeRefs" JSONB,
  ADD COLUMN "linkedMeetingRefs" JSONB;
