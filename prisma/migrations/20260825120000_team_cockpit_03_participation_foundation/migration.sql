-- TEAM-COCKPIT-03A — Participation Self-Service Foundation
--
-- Additive migration — does NOT modify or drop any existing table/column.
--
-- Creates:
--   ParticipationResponseStatus enum  (OPEN | YES | NO | MAYBE)
--   ParticipationResponseSource enum  (PLAYER | PARENT | TRAINER | STAFF)
--   ParticipationResponse table       — unified per-person-per-event RSVP
--
-- ARCHITECTURAL INVARIANTS:
--   - One ParticipationResponse model for Training, Match, and Tournament.
--   - Reuses AttendanceEventKind for event reference discrimination.
--   - TRAINING references TrainingSession.id (canonical occurrence).
--   - MATCH/TOURNAMENT reference Event.id (Event.type = MATCH | TOURNAMENT).
--   - Participation is distinct from AttendanceRecord (pre-event vs actual).
--   - Tenant isolation: all reads/writes must include tenantId guard.

-- CreateEnum
CREATE TYPE "ParticipationResponseStatus" AS ENUM ('OPEN', 'YES', 'NO', 'MAYBE');

-- CreateEnum
CREATE TYPE "ParticipationResponseSource" AS ENUM ('PLAYER', 'PARENT', 'TRAINER', 'STAFF');

-- CreateTable
CREATE TABLE "ParticipationResponse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "teamSeasonId" TEXT NOT NULL,
    "eventKind" "AttendanceEventKind" NOT NULL,
    "trainingSessionId" TEXT,
    "eventId" TEXT,
    "status" "ParticipationResponseStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "respondedAt" TIMESTAMP(3),
    "responseSource" "ParticipationResponseSource",
    "respondedByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationResponse_personId_trainingSessionId_key" ON "ParticipationResponse"("personId", "trainingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationResponse_personId_eventId_key" ON "ParticipationResponse"("personId", "eventId");

-- CreateIndex
CREATE INDEX "ParticipationResponse_tenantId_idx" ON "ParticipationResponse"("tenantId");

-- CreateIndex
CREATE INDEX "ParticipationResponse_tenantId_teamSeasonId_idx" ON "ParticipationResponse"("tenantId", "teamSeasonId");

-- CreateIndex
CREATE INDEX "ParticipationResponse_tenantId_personId_idx" ON "ParticipationResponse"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "ParticipationResponse_teamSeasonId_personId_idx" ON "ParticipationResponse"("teamSeasonId", "personId");

-- CreateIndex
CREATE INDEX "ParticipationResponse_teamSeasonId_eventKind_idx" ON "ParticipationResponse"("teamSeasonId", "eventKind");

-- CreateIndex
CREATE INDEX "ParticipationResponse_trainingSessionId_idx" ON "ParticipationResponse"("trainingSessionId");

-- CreateIndex
CREATE INDEX "ParticipationResponse_eventId_idx" ON "ParticipationResponse"("eventId");

-- CreateIndex
CREATE INDEX "ParticipationResponse_tenantId_status_idx" ON "ParticipationResponse"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "ParticipationResponse" ADD CONSTRAINT "ParticipationResponse_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationResponse" ADD CONSTRAINT "ParticipationResponse_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationResponse" ADD CONSTRAINT "ParticipationResponse_teamSeasonId_fkey"
    FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationResponse" ADD CONSTRAINT "ParticipationResponse_trainingSessionId_fkey"
    FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationResponse" ADD CONSTRAINT "ParticipationResponse_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationResponse" ADD CONSTRAINT "ParticipationResponse_respondedByUserId_fkey"
    FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationResponse" ADD CONSTRAINT "ParticipationResponse_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
