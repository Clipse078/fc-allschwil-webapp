-- TEAM-COCKPIT-02B — Canonical Attendance Foundation
--
-- Additive migration — does NOT modify or drop any existing table/column.
--
-- Creates:
--   AttendanceEventKind enum  (TRAINING | MATCH | TOURNAMENT)
--   AttendanceStatus enum     (OPEN | PRESENT | ABSENT | EXCUSED | INJURED)
--   AttendanceRecord table    — unified per-person-per-event attendance
--
-- ARCHITECTURAL INVARIANTS:
--   - One AttendanceRecord model for Training, Match, and Tournament.
--   - TRAINING references TrainingSession.id (canonical occurrence).
--   - MATCH/TOURNAMENT reference Event.id (Event.type = MATCH | TOURNAMENT).
--   - Attendance is explicit — never inferred from event occurrence.
--   - No automatic backfill of historical events.
--   - Tenant isolation: all reads/writes must include tenantId guard.

-- CreateEnum
CREATE TYPE "AttendanceEventKind" AS ENUM ('TRAINING', 'MATCH', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('OPEN', 'PRESENT', 'ABSENT', 'EXCUSED', 'INJURED');

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "teamSeasonId" TEXT NOT NULL,
    "eventKind" "AttendanceEventKind" NOT NULL,
    "trainingSessionId" TEXT,
    "eventId" TEXT,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "recordedByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_personId_trainingSessionId_key" ON "AttendanceRecord"("personId", "trainingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_personId_eventId_key" ON "AttendanceRecord"("personId", "eventId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_idx" ON "AttendanceRecord"("tenantId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_teamSeasonId_idx" ON "AttendanceRecord"("tenantId", "teamSeasonId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_personId_idx" ON "AttendanceRecord"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_teamSeasonId_personId_idx" ON "AttendanceRecord"("teamSeasonId", "personId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_teamSeasonId_eventKind_idx" ON "AttendanceRecord"("teamSeasonId", "eventKind");

-- CreateIndex
CREATE INDEX "AttendanceRecord_trainingSessionId_idx" ON "AttendanceRecord"("trainingSessionId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_eventId_idx" ON "AttendanceRecord"("eventId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_status_idx" ON "AttendanceRecord"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_teamSeasonId_fkey"
    FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_trainingSessionId_fkey"
    FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_recordedByUserId_fkey"
    FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
