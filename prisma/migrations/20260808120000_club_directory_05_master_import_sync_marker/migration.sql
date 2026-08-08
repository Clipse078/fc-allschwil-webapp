-- CLUB-DIRECTORY-05
-- Adds a completion timestamp for the SFV club master import (broadest
-- reliable club pre-population from SFV ranking data), mirroring the
-- existing lastTeamSyncAt / lastScheduleSyncAt / lastMatchDetailSyncAt /
-- lastCompetitionSyncAt columns. No other schema change is required: this
-- slice reuses ExternalClub / ExternalClubProviderMapping as-is.
-- AlterTable
ALTER TABLE "TenantSfvConfig"
ADD COLUMN "lastClubMasterImportAt" TIMESTAMP(3);
