-- TOURNAMENTCENTER-01B — Multi-Team Participation + Team Dressing-Room Allocations
--
-- Event(type=TOURNAMENT) remains the single canonical tournament entity.
-- TOURNAMENTCENTER-01 modelled a tournament with AT MOST one Team
-- (Event.teamId) and tournament-level pitchCode/homeDressingRoomCode/
-- awayDressingRoomCode string fields — a two-side MatchCenter shape that
-- cannot represent a genuine multi-team tournament (4+ participating
-- teams, tenant-owned Teams and Club-Directory ExternalTeams together).
--
-- This migration is purely additive:
--   1. CREATE TournamentParticipant           (Event <-> Team | ExternalTeam | manual fallback)
--   2. CREATE TournamentResourceAllocation    (Event <-> FacilityResource, Spielfeld/Halle)
--   3. CREATE TournamentParticipantAllocation (TournamentParticipant <-> FacilityResource, Garderobe)
--   4. BACKFILL existing TOURNAMENT Event rows into the new tables so no
--      existing tournament data is lost.
--
-- No existing column is dropped, renamed, or repurposed. Event.pitchCode /
-- homeDressingRoomCode / awayDressingRoomCode remain untouched (still the
-- canonical allocation model for Event type=MATCH) and are simply no
-- longer written for new/edited tournaments going forward — see
-- lib/tournaments/tournament-service.ts and lib/tournaments/*-service.ts.
--
-- Safety characteristics:
--   - All DDL uses IF NOT EXISTS / DO-exception guards for idempotency.
--   - Backfill INSERTs are guarded with NOT EXISTS to stay idempotent if
--     this migration is ever re-run against a partially-migrated database.
--   - No existing rows are modified or deleted.
--   - Every backfill join (Team in 4a, FacilityResource in 4b/4c) requires
--     an exact tenantId match against the source Event — a legacy
--     Event.teamId/pitchCode/homeDressingRoomCode referencing a
--     different tenant's row (or a null-tenant row) is simply skipped,
--     never backfilled cross-tenant.
-- ---------------------------------------------------------------------------

-- 1. CREATE TournamentParticipant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TournamentParticipant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT,
    "externalTeamId" TEXT,
    "manualLabel" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TournamentParticipant_tenantId_idx" ON "TournamentParticipant"("tenantId");
CREATE INDEX IF NOT EXISTS "TournamentParticipant_eventId_idx" ON "TournamentParticipant"("eventId");
CREATE INDEX IF NOT EXISTS "TournamentParticipant_teamId_idx" ON "TournamentParticipant"("teamId");
CREATE INDEX IF NOT EXISTS "TournamentParticipant_externalTeamId_idx" ON "TournamentParticipant"("externalTeamId");
CREATE INDEX IF NOT EXISTS "TournamentParticipant_tenantId_eventId_idx" ON "TournamentParticipant"("tenantId", "eventId");

-- Prevent the same canonical Team/ExternalTeam being added twice to the same tournament.
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentParticipant_eventId_teamId_key" ON "TournamentParticipant"("eventId", "teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentParticipant_eventId_externalTeamId_key" ON "TournamentParticipant"("eventId", "externalTeamId");

DO $$ BEGIN
  ALTER TABLE "TournamentParticipant"
    ADD CONSTRAINT "TournamentParticipant_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TournamentParticipant"
    ADD CONSTRAINT "TournamentParticipant_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TournamentParticipant"
    ADD CONSTRAINT "TournamentParticipant_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TournamentParticipant"
    ADD CONSTRAINT "TournamentParticipant_externalTeamId_fkey"
    FOREIGN KEY ("externalTeamId") REFERENCES "ExternalTeam"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. CREATE TournamentResourceAllocation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TournamentResourceAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "facilityResourceId" TEXT NOT NULL,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentResourceAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TournamentResourceAllocation_tenantId_idx" ON "TournamentResourceAllocation"("tenantId");
CREATE INDEX IF NOT EXISTS "TournamentResourceAllocation_eventId_idx" ON "TournamentResourceAllocation"("eventId");
CREATE INDEX IF NOT EXISTS "TournamentResourceAllocation_facilityResourceId_idx" ON "TournamentResourceAllocation"("facilityResourceId");
CREATE INDEX IF NOT EXISTS "TournamentResourceAllocation_tenantId_eventId_idx" ON "TournamentResourceAllocation"("tenantId", "eventId");

-- Prevent duplicate allocation of the same resource to the same tournament.
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentResourceAllocation_eventId_facilityResourceId_key" ON "TournamentResourceAllocation"("eventId", "facilityResourceId");

DO $$ BEGIN
  ALTER TABLE "TournamentResourceAllocation"
    ADD CONSTRAINT "TournamentResourceAllocation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TournamentResourceAllocation"
    ADD CONSTRAINT "TournamentResourceAllocation_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TournamentResourceAllocation"
    ADD CONSTRAINT "TournamentResourceAllocation_facilityResourceId_fkey"
    FOREIGN KEY ("facilityResourceId") REFERENCES "FacilityResource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. CREATE TournamentParticipantAllocation
-- ---------------------------------------------------------------------------
-- Deliberately NOT unique on facilityResourceId alone — multiple
-- participants (teams) MAY share the same dressing room when facility
-- rules allow it.
CREATE TABLE IF NOT EXISTS "TournamentParticipantAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tournamentParticipantId" TEXT NOT NULL,
    "facilityResourceId" TEXT NOT NULL,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentParticipantAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TournamentParticipantAllocation_tenantId_idx" ON "TournamentParticipantAllocation"("tenantId");
CREATE INDEX IF NOT EXISTS "TournamentParticipantAllocation_tournamentParticipantId_idx" ON "TournamentParticipantAllocation"("tournamentParticipantId");
CREATE INDEX IF NOT EXISTS "TournamentParticipantAllocation_facilityResourceId_idx" ON "TournamentParticipantAllocation"("facilityResourceId");
CREATE INDEX IF NOT EXISTS "TournamentParticipantAllocation_tenantId_tournamentParticip_idx" ON "TournamentParticipantAllocation"("tenantId", "tournamentParticipantId");

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentParticipantAllocation_tournamentParticipantId_fac_key" ON "TournamentParticipantAllocation"("tournamentParticipantId", "facilityResourceId");

DO $$ BEGIN
  ALTER TABLE "TournamentParticipantAllocation"
    ADD CONSTRAINT "TournamentParticipantAllocation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TournamentParticipantAllocation"
    ADD CONSTRAINT "TournamentParticipantAllocation_tournamentParticipantId_fkey"
    FOREIGN KEY ("tournamentParticipantId") REFERENCES "TournamentParticipant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TournamentParticipantAllocation"
    ADD CONSTRAINT "TournamentParticipantAllocation_facilityResourceId_fkey"
    FOREIGN KEY ("facilityResourceId") REFERENCES "FacilityResource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. BACKFILL existing TOURNAMENT Event rows
-- ---------------------------------------------------------------------------
-- 4a. One TournamentParticipant per pre-existing single-Team tournament.
--     Skipped when Event.tenantId is null (cannot determine the owning
--     tenant for the new tenant-scoped row) — matches the existing
--     tenant-isolation convention used by lib/tournaments/queries.ts.
--
--     Tenant-safe Team match (TOURNAMENTCENTER-01-C1 hardening): joins
--     back to "Team" and requires t."tenantId" = e."tenantId", mirroring
--     the exact tenant semantics already enforced by
--     lib/tournaments/participant-service.ts::addTournamentParticipant()
--     for every NEW participant (Team.tenantId is nullable/backward-compat
--     per schema.prisma, so a plain SQL equality join already excludes
--     both null-tenant and cross-tenant Team rows — no explicit NULL
--     branch is added, keeping this consistent with the strict equality
--     the application itself requires). Event.teamId has never been
--     tenant-validated by every historical write path (see
--     app/api/events/route.ts), so this prevents a rare pre-existing
--     data inconsistency from being backfilled into a new, structurally
--     tenant-scoped table. An Event whose legacy teamId fails this check
--     is simply left without a backfilled participant — its own
--     tenantId/pitchCode/dressing-room columns are untouched, and the
--     correct participant can still be added later via the validated
--     TournamentCenter UI.
INSERT INTO "TournamentParticipant" (
    "id", "tenantId", "eventId", "teamId", "displayOrder", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::TEXT,
    e."tenantId",
    e."id",
    e."teamId",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Event" e
JOIN "Team" t ON t."id" = e."teamId" AND t."tenantId" = e."tenantId"
WHERE e."type" = 'TOURNAMENT'
  AND e."teamId" IS NOT NULL
  AND e."tenantId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "TournamentParticipant" tp
      WHERE tp."eventId" = e."id" AND tp."teamId" = e."teamId"
  );

-- 4b. One TournamentResourceAllocation per pre-existing tournament pitch
--     code, resolved against the tenant's own FacilityResource directory
--     (FacilityResource.code uses the exact same static codes, e.g.
--     "STADION", "KUNSTRASEN_2" — see prisma/seed.ts). Tournaments whose
--     pitchCode does not resolve to a configured FacilityResource are left
--     unallocated rather than guessed at.
INSERT INTO "TournamentResourceAllocation" (
    "id", "tenantId", "eventId", "facilityResourceId", "displayOrder", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::TEXT,
    e."tenantId",
    e."id",
    fr."id",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Event" e
JOIN "FacilityResource" fr ON fr."tenantId" = e."tenantId" AND fr."code" = e."pitchCode"
WHERE e."type" = 'TOURNAMENT'
  AND e."pitchCode" IS NOT NULL
  AND e."tenantId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "TournamentResourceAllocation" tra
      WHERE tra."eventId" = e."id" AND tra."facilityResourceId" = fr."id"
  );

-- 4c. One TournamentParticipantAllocation (Garderobe) for the single
--     backfilled participant of each pre-existing tournament that had a
--     homeDressingRoomCode. There is no clean multi-team target for the
--     legacy awayDressingRoomCode (a multi-team tournament has no single
--     "away" side), so it is intentionally NOT backfilled here — see the
--     TOURNAMENTCENTER-01B implementation notes for this documented
--     limitation.
INSERT INTO "TournamentParticipantAllocation" (
    "id", "tenantId", "tournamentParticipantId", "facilityResourceId", "displayOrder", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::TEXT,
    e."tenantId",
    tp."id",
    fr."id",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Event" e
JOIN "TournamentParticipant" tp ON tp."eventId" = e."id" AND tp."teamId" = e."teamId"
JOIN "FacilityResource" fr ON fr."tenantId" = e."tenantId" AND fr."code" = e."homeDressingRoomCode"
WHERE e."type" = 'TOURNAMENT'
  AND e."homeDressingRoomCode" IS NOT NULL
  AND e."teamId" IS NOT NULL
  AND e."tenantId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "TournamentParticipantAllocation" tpa
      WHERE tpa."tournamentParticipantId" = tp."id" AND tpa."facilityResourceId" = fr."id"
  );
