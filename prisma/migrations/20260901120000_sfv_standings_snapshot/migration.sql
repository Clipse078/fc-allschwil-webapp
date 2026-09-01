-- STANDINGS-AVAILABILITY-06: durable canonical SFV standings snapshot
CREATE TABLE "SfvStandingsSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalSeasonId" INTEGER NOT NULL,
    "externalTeamId" INTEGER NOT NULL,
    "providerLeagueId" INTEGER NOT NULL,
    "standingsTable" JSONB NOT NULL,
    "sfvLeagueId" INTEGER NOT NULL,
    "sfvDivisionId" INTEGER NOT NULL,
    "sfvGroupId" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SfvStandingsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SfvStandingsSnapshot_tenantId_externalSeasonId_externalTeamId_providerLeagueId_key" ON "SfvStandingsSnapshot"("tenantId", "externalSeasonId", "externalTeamId", "providerLeagueId");

CREATE INDEX "SfvStandingsSnapshot_tenantId_idx" ON "SfvStandingsSnapshot"("tenantId");

ALTER TABLE "SfvStandingsSnapshot" ADD CONSTRAINT "SfvStandingsSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
