-- TEAM-COCKPIT-PREMIUM-01K: team-level public photo URL (visual identity).
-- Survives season rollover. Distinct from private TeamDocument storage.

ALTER TABLE "Team" ADD COLUMN "photoUrl" TEXT;
