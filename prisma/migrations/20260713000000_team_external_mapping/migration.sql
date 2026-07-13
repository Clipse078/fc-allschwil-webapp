-- Slice: SFV Team Sync — External Provider Mapping
--
-- Adds TeamExternalMapping: links a canonical Team to an external provider
-- record (e.g. SFV / ClubCorner) with provider-specific metadata and sync
-- timestamps.
--
-- Architecture:
--   Team remains the canonical entity owned by Organisation Builder.
--   SFV (and future providers) contribute one mapping row per external
--   team + season + tenant combination. No SFV-specific columns are added
--   to Team itself.
--
-- Unique constraint prevents duplicate mappings for the same provider team
-- within the same tenant and season.
--
-- This migration is non-destructive and fully reversible.
-- ---------------------------------------------------------------------------

CREATE TABLE "TeamExternalMapping" (
    "id"                     TEXT         NOT NULL,
    "tenantId"               TEXT         NOT NULL,
    "teamId"                 TEXT         NOT NULL,
    "provider"               TEXT         NOT NULL,
    "externalTeamId"         INTEGER      NOT NULL,
    "externalSeasonId"       INTEGER      NOT NULL,
    "providerTeamName"       TEXT,
    "providerLeagueId"       INTEGER,
    "providerLeagueName"     TEXT,
    "providerOrganisationId" INTEGER,
    "providerIsActive"       BOOLEAN      NOT NULL DEFAULT true,
    "lastSyncedAt"           TIMESTAMP(3) NOT NULL,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamExternalMapping_pkey" PRIMARY KEY ("id")
);

-- Prevent duplicate provider mappings within the same tenant + season
CREATE UNIQUE INDEX "TeamExternalMapping_tenantId_provider_externalTeamId_externalSeasonId_key"
    ON "TeamExternalMapping"("tenantId", "provider", "externalTeamId", "externalSeasonId");

-- Index for provider scope lookups (e.g. "all SFV mappings for tenant X")
CREATE INDEX "TeamExternalMapping_tenantId_provider_idx"
    ON "TeamExternalMapping"("tenantId", "provider");

-- Index for reverse lookup: all provider mappings for a Team
CREATE INDEX "TeamExternalMapping_teamId_idx"
    ON "TeamExternalMapping"("teamId");

-- Index for active-state filtering
CREATE INDEX "TeamExternalMapping_providerIsActive_idx"
    ON "TeamExternalMapping"("providerIsActive");

-- Foreign keys
ALTER TABLE "TeamExternalMapping"
    ADD CONSTRAINT "TeamExternalMapping_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamExternalMapping"
    ADD CONSTRAINT "TeamExternalMapping_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
