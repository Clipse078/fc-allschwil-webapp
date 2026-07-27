-- COMPETITION-01: Canonical Competition Foundation
--
-- Introduces Competition as a first-class canonical domain entity independent
-- of any single provider (SFV, manual, future providers).
--
-- Changes:
--   1. Add COMPETITIONS to PermissionModule enum.
--   2. Create CompetitionType enum.
--   3. Create CompetitionGender enum.
--   4. Create Competition table.
--   5. Create TeamSeasonCompetition join table.
--   6. Add lastCompetitionSyncAt to TenantSfvConfig.

-- AlterEnum: add COMPETITIONS to PermissionModule
ALTER TYPE "PermissionModule" ADD VALUE 'COMPETITIONS';

-- CreateEnum: CompetitionType
CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'CUP', 'TOURNAMENT_SERIES', 'OTHER');

-- CreateEnum: CompetitionGender
CREATE TYPE "CompetitionGender" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- CreateTable: Competition
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalCompetitionId" INTEGER,
    "externalSeasonId" INTEGER,
    "officialName" TEXT NOT NULL,
    "shortName" TEXT,
    "groupName" TEXT,
    "competitionType" "CompetitionType" NOT NULL DEFAULT 'LEAGUE',
    "gender" "CompetitionGender",
    "ageCategory" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamSeasonCompetition
CREATE TABLE "TeamSeasonCompetition" (
    "id" TEXT NOT NULL,
    "teamSeasonId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSeasonCompetition_pkey" PRIMARY KEY ("id")
);

-- AlterTable: TenantSfvConfig — add lastCompetitionSyncAt
ALTER TABLE "TenantSfvConfig" ADD COLUMN "lastCompetitionSyncAt" TIMESTAMP(3);

-- CreateIndex: Competition unique constraint (tenant + provider + external IDs)
CREATE UNIQUE INDEX "Competition_tenantId_provider_externalCompetitionId_externalSeasonId_key" ON "Competition"("tenantId", "provider", "externalCompetitionId", "externalSeasonId");

-- CreateIndex: Competition lookup indexes
CREATE INDEX "Competition_tenantId_idx" ON "Competition"("tenantId");
CREATE INDEX "Competition_tenantId_provider_idx" ON "Competition"("tenantId", "provider");
CREATE INDEX "Competition_tenantId_isArchived_idx" ON "Competition"("tenantId", "isArchived");
CREATE INDEX "Competition_tenantId_provider_externalSeasonId_idx" ON "Competition"("tenantId", "provider", "externalSeasonId");

-- CreateIndex: TeamSeasonCompetition unique constraint
CREATE UNIQUE INDEX "TeamSeasonCompetition_teamSeasonId_competitionId_key" ON "TeamSeasonCompetition"("teamSeasonId", "competitionId");

-- CreateIndex: TeamSeasonCompetition lookup indexes
CREATE INDEX "TeamSeasonCompetition_teamSeasonId_idx" ON "TeamSeasonCompetition"("teamSeasonId");
CREATE INDEX "TeamSeasonCompetition_competitionId_idx" ON "TeamSeasonCompetition"("competitionId");
CREATE INDEX "TeamSeasonCompetition_teamSeasonId_isPrimary_idx" ON "TeamSeasonCompetition"("teamSeasonId", "isPrimary");

-- AddForeignKey: Competition → Tenant
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TeamSeasonCompetition → TeamSeason
ALTER TABLE "TeamSeasonCompetition" ADD CONSTRAINT "TeamSeasonCompetition_teamSeasonId_fkey" FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TeamSeasonCompetition → Competition
ALTER TABLE "TeamSeasonCompetition" ADD CONSTRAINT "TeamSeasonCompetition_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
