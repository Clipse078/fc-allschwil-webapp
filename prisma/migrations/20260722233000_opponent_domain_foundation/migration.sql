-- MC-04B — Opponent domain foundation
--
-- Additive only:
-- - creates tenant-scoped reusable opponents;
-- - creates provider-qualified opponent mappings;
-- - does not alter Event, Team, MatchExternalMapping, or existing data;
-- - does not backfill records.
--
-- externalSeasonId uses 0 as the explicit seasonless sentinel because
-- PostgreSQL unique constraints permit multiple NULL values.

CREATE TABLE "Opponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "officialName" TEXT NOT NULL,
    "shortName" TEXT,
    "websiteName" TEXT,
    "infoboardName" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpponentExternalMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalTeamId" INTEGER NOT NULL,
    "externalSeasonId" INTEGER NOT NULL DEFAULT 0,
    "providerTeamName" TEXT,
    "providerOrganisationId" INTEGER,
    "providerLogoUrl" TEXT,
    "providerIsActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentExternalMapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Opponent_tenantId_idx"
ON "Opponent"("tenantId");

CREATE INDEX "Opponent_tenantId_archivedAt_idx"
ON "Opponent"("tenantId", "archivedAt");

CREATE UNIQUE INDEX "OpponentExternalMapping_tenantId_provider_externalTeamId_externalSeasonId_key"
ON "OpponentExternalMapping"(
    "tenantId",
    "provider",
    "externalTeamId",
    "externalSeasonId"
);

CREATE INDEX "OpponentExternalMapping_tenantId_provider_idx"
ON "OpponentExternalMapping"("tenantId", "provider");

CREATE INDEX "OpponentExternalMapping_opponentId_idx"
ON "OpponentExternalMapping"("opponentId");

ALTER TABLE "Opponent"
ADD CONSTRAINT "Opponent_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "OpponentExternalMapping"
ADD CONSTRAINT "OpponentExternalMapping_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "OpponentExternalMapping"
ADD CONSTRAINT "OpponentExternalMapping_opponentId_fkey"
FOREIGN KEY ("opponentId")
REFERENCES "Opponent"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;