-- AlterTable
ALTER TABLE "TenantSfvConfig"
ADD COLUMN "lastTeamSyncAt" TIMESTAMP(3),
ADD COLUMN "lastScheduleSyncAt" TIMESTAMP(3),
ADD COLUMN "lastMatchDetailSyncAt" TIMESTAMP(3);