-- TEAM-PUBLIC-NEXT-EVENT-01B
-- Add tenant-neutral, seasonal controls for the public team page next-event position.

-- AlterTable
ALTER TABLE "TeamSeason"
  ADD COLUMN "showNextMatch" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showNextTournament" BOOLEAN NOT NULL DEFAULT false;
