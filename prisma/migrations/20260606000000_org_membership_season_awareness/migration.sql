-- Phase A — Season-Aware Memberships
-- Additive only: no destructive changes, no data loss, zero downtime safe.
--
-- Adds optional seasonId FK and notes field to OrgUnitMembership.
-- This allows memberships to be scoped to a specific season for history tracking.

-- Add seasonId column (nullable, no default)
ALTER TABLE "OrgUnitMembership" ADD COLUMN "seasonId" TEXT;

-- Add notes column (nullable text)
ALTER TABLE "OrgUnitMembership" ADD COLUMN "notes" TEXT;

-- Add FK constraint from OrgUnitMembership.seasonId → Season.id
ALTER TABLE "OrgUnitMembership"
  ADD CONSTRAINT "OrgUnitMembership_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for efficient lookup by season and composite tenant+unit+status queries
CREATE INDEX "OrgUnitMembership_seasonId_idx" ON "OrgUnitMembership"("seasonId");
CREATE INDEX "OrgUnitMembership_tenantId_orgUnitId_status_idx" ON "OrgUnitMembership"("tenantId", "orgUnitId", "status");
