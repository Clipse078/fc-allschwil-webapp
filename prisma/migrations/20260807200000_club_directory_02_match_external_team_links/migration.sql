-- CLUB-DIRECTORY-02: canonical Club Directory identity on MatchExternalMapping
--
-- Adds homeExternalTeamId / awayExternalTeamId so Matchcenter can resolve the
-- canonical ExternalClub-Directory ExternalTeam (name + logo/provider
-- metadata) for external opponents instead of relying only on the
-- provider-reported display name (providerHomeTeamName / providerAwayTeamName).
--
-- Both columns are nullable and SET NULL on delete: they are populated by the
-- best-effort discovery flow in lib/club-directory/discovery-service.ts during
-- SFV schedule sync, never required for Event/MatchExternalMapping creation,
-- and never touch homeTeamId/awayTeamId (the existing tenant-owned Team FKs,
-- reserved exclusively for club-owned participants).

-- AlterTable
ALTER TABLE "MatchExternalMapping" ADD COLUMN     "awayExternalTeamId" TEXT,
ADD COLUMN     "homeExternalTeamId" TEXT;

-- CreateIndex
CREATE INDEX "MatchExternalMapping_homeExternalTeamId_idx" ON "MatchExternalMapping"("homeExternalTeamId");

-- CreateIndex
CREATE INDEX "MatchExternalMapping_awayExternalTeamId_idx" ON "MatchExternalMapping"("awayExternalTeamId");

-- AddForeignKey
ALTER TABLE "MatchExternalMapping" ADD CONSTRAINT "MatchExternalMapping_homeExternalTeamId_fkey" FOREIGN KEY ("homeExternalTeamId") REFERENCES "ExternalTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchExternalMapping" ADD CONSTRAINT "MatchExternalMapping_awayExternalTeamId_fkey" FOREIGN KEY ("awayExternalTeamId") REFERENCES "ExternalTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
