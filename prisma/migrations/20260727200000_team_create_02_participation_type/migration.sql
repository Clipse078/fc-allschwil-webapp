-- Migration: TEAM-CREATE-02 — ParticipationType enum + TeamSeason.participationType
--
-- Adds a canonical ParticipationType enum and a participationType column to TeamSeason.
-- Default: TRAINING — safe default that covers all existing rows (training-oriented or
-- non-competitive) without requiring immediate data backfill from administrators.
--
-- Non-breaking: all existing TeamSeason rows receive the default value.
-- No data loss. No table rebuilds.

-- CreateEnum
CREATE TYPE "ParticipationType" AS ENUM (
  'COMPETITION',
  'TRAINING',
  'DEVELOPMENT',
  'RECREATIONAL',
  'OTHER'
);

-- AlterTable
ALTER TABLE "TeamSeason" ADD COLUMN "participationType" "ParticipationType" NOT NULL DEFAULT 'TRAINING';

-- CreateIndex
CREATE INDEX "TeamSeason_participationType_idx" ON "TeamSeason"("participationType");
