-- CLUB-DIRECTORY-01 — Canonical external club/team directory
--
-- Replaces the MC-04B "Opponent domain foundation" (migration
-- 20260722233000_opponent_domain_foundation), which had no write path, no UI,
-- and no club/team split, and was never consumed by Matchcenter's actual
-- home/away rendering. Dropping these two tables is safe: nothing in the
-- codebase ever wrote to "Opponent" or "OpponentExternalMapping" (read-only
-- query-service + API routes only), so no production data exists to lose.
--
-- Adds the canonical ExternalClub / ExternalTeam directory plus their
-- provider-identity mapping tables. Additive for every other model — no
-- existing table besides the two dropped above is altered.

-- DropForeignKey
ALTER TABLE "Opponent" DROP CONSTRAINT "Opponent_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "OpponentExternalMapping" DROP CONSTRAINT "OpponentExternalMapping_opponentId_fkey";

-- DropForeignKey
ALTER TABLE "OpponentExternalMapping" DROP CONSTRAINT "OpponentExternalMapping_tenantId_fkey";

-- DropTable
DROP TABLE "Opponent";

-- DropTable
DROP TABLE "OpponentExternalMapping";

-- CreateTable
CREATE TABLE "ExternalClub" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "alternativeName" TEXT,
    "website" TEXT,
    "location" TEXT,
    "logoUrl" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalClub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalClubProviderMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalClubId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerClubId" INTEGER NOT NULL,
    "providerClubName" TEXT,
    "providerLogoUrl" TEXT,
    "providerWebsite" TEXT,
    "providerIsActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalClubProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalTeam" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalClubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "alternativeName" TEXT,
    "categoryLabel" TEXT,
    "logoUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalTeamProviderMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalTeamId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTeamId" INTEGER NOT NULL,
    "providerSeasonId" INTEGER NOT NULL DEFAULT 0,
    "providerTeamName" TEXT,
    "providerClubId" INTEGER,
    "providerOrganisationId" INTEGER,
    "providerLogoUrl" TEXT,
    "providerIsActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalTeamProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalClub_tenantId_idx" ON "ExternalClub"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalClub_tenantId_archivedAt_idx" ON "ExternalClub"("tenantId", "archivedAt");

-- CreateIndex
CREATE INDEX "ExternalClubProviderMapping_tenantId_provider_idx" ON "ExternalClubProviderMapping"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "ExternalClubProviderMapping_externalClubId_idx" ON "ExternalClubProviderMapping"("externalClubId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalClubProviderMapping_tenantId_provider_providerClubI_key" ON "ExternalClubProviderMapping"("tenantId", "provider", "providerClubId");

-- CreateIndex
CREATE INDEX "ExternalTeam_tenantId_idx" ON "ExternalTeam"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalTeam_tenantId_archivedAt_idx" ON "ExternalTeam"("tenantId", "archivedAt");

-- CreateIndex
CREATE INDEX "ExternalTeam_externalClubId_idx" ON "ExternalTeam"("externalClubId");

-- CreateIndex
CREATE INDEX "ExternalTeamProviderMapping_tenantId_provider_idx" ON "ExternalTeamProviderMapping"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "ExternalTeamProviderMapping_externalTeamId_idx" ON "ExternalTeamProviderMapping"("externalTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTeamProviderMapping_tenantId_provider_providerTeamI_key" ON "ExternalTeamProviderMapping"("tenantId", "provider", "providerTeamId", "providerSeasonId");

-- AddForeignKey
ALTER TABLE "ExternalClub" ADD CONSTRAINT "ExternalClub_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalClubProviderMapping" ADD CONSTRAINT "ExternalClubProviderMapping_externalClubId_fkey" FOREIGN KEY ("externalClubId") REFERENCES "ExternalClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalClubProviderMapping" ADD CONSTRAINT "ExternalClubProviderMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTeam" ADD CONSTRAINT "ExternalTeam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTeam" ADD CONSTRAINT "ExternalTeam_externalClubId_fkey" FOREIGN KEY ("externalClubId") REFERENCES "ExternalClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTeamProviderMapping" ADD CONSTRAINT "ExternalTeamProviderMapping_externalTeamId_fkey" FOREIGN KEY ("externalTeamId") REFERENCES "ExternalTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTeamProviderMapping" ADD CONSTRAINT "ExternalTeamProviderMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
