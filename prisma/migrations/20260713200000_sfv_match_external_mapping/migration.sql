-- Slice 3B: SFV Match Schedule Synchronization — Match External Mapping
--
-- This migration:
--   1. Adds "SFV" to the EventSource enum (additive, non-destructive).
--   2. Creates MatchExternalMapping: links a canonical Event (type=MATCH) to
--      an external provider match record (SFV matchId).
--
-- Architecture:
--   Event remains the canonical match entity. SFV contributes one mapping
--   row per external matchId + tenant combination. No SFV-specific columns
--   are added to Event itself.
--
--   SFV matchId (externalMatchId) is the ONLY programmatic integration key.
--   matchNumber is stored for display only and must never be used as identity.
--
--   homeTeamId / awayTeamId are nullable FKs to canonical Team records.
--   When null, the team is an external opponent not in the local Team table.
--   External opponents are never created as tenant-owned Teams during match sync.
--
-- The unique constraint prevents duplicate SFV match mappings per tenant.
-- This migration is non-destructive, additive, and fully reversible.
-- ---------------------------------------------------------------------------

-- 1. Add SFV to EventSource enum (Postgres: cannot run inside a transaction)
ALTER TYPE "EventSource" ADD VALUE IF NOT EXISTS 'SFV';

-- 2. Create MatchExternalMapping table
CREATE TABLE "MatchExternalMapping" (
    "id"                     TEXT         NOT NULL,
    "tenantId"               TEXT         NOT NULL,
    "eventId"                TEXT         NOT NULL,
    "provider"               TEXT         NOT NULL,
    "externalMatchId"        INTEGER      NOT NULL,
    "externalSeasonId"       INTEGER      NOT NULL,
    "matchNumber"            INTEGER,
    "providerHomeTeamId"     INTEGER      NOT NULL,
    "providerAwayTeamId"     INTEGER      NOT NULL,
    "providerHomeTeamName"   TEXT,
    "providerAwayTeamName"   TEXT,
    "homeTeamId"             TEXT,
    "awayTeamId"             TEXT,
    "providerMatchState"     INTEGER,
    "providerMatchStateName" TEXT,
    "scoreHome"              INTEGER,
    "scoreAway"              INTEGER,
    "providerLeagueId"       INTEGER,
    "providerLeagueName"     TEXT,
    "providerDivisionId"     INTEGER,
    "providerDivisionName"   TEXT,
    "providerRoundNbr"       INTEGER,
    "providerOrganisationId" INTEGER,
    "providerPlaygroundId"   INTEGER,
    "providerVenueName"      TEXT,
    "providerSeasonName"     TEXT,
    "lastSyncedAt"           TIMESTAMP(3) NOT NULL,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchExternalMapping_pkey" PRIMARY KEY ("id")
);

-- One mapping per canonical event (1:1 between Event and MatchExternalMapping)
CREATE UNIQUE INDEX "MatchExternalMapping_eventId_key"
    ON "MatchExternalMapping"("eventId");

-- Prevent duplicate SFV match mappings within the same tenant
CREATE UNIQUE INDEX "MatchExternalMapping_tenantId_provider_externalMatchId_key"
    ON "MatchExternalMapping"("tenantId", "provider", "externalMatchId");

-- Index for provider scope lookups (e.g. "all SFV mappings for tenant X")
CREATE INDEX "MatchExternalMapping_tenantId_provider_idx"
    ON "MatchExternalMapping"("tenantId", "provider");

-- Index for season scope lookups
CREATE INDEX "MatchExternalMapping_tenantId_provider_externalSeasonId_idx"
    ON "MatchExternalMapping"("tenantId", "provider", "externalSeasonId");

-- Index for reverse FK lookup from Event
CREATE INDEX "MatchExternalMapping_eventId_idx"
    ON "MatchExternalMapping"("eventId");

-- Indexes for team resolution
CREATE INDEX "MatchExternalMapping_homeTeamId_idx"
    ON "MatchExternalMapping"("homeTeamId");

CREATE INDEX "MatchExternalMapping_awayTeamId_idx"
    ON "MatchExternalMapping"("awayTeamId");

-- Foreign keys
ALTER TABLE "MatchExternalMapping"
    ADD CONSTRAINT "MatchExternalMapping_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchExternalMapping"
    ADD CONSTRAINT "MatchExternalMapping_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchExternalMapping"
    ADD CONSTRAINT "MatchExternalMapping_homeTeamId_fkey"
    FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatchExternalMapping"
    ADD CONSTRAINT "MatchExternalMapping_awayTeamId_fkey"
    FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
