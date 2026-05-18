-- CreateEnum: MeetingAgendaItemStatus
CREATE TYPE "MeetingAgendaItemStatus" AS ENUM ('OPEN', 'DISCUSSED', 'SKIPPED');

-- CreateEnum: MeetingDecisionStatus
CREATE TYPE "MeetingDecisionStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'SUPERSEDED');

-- CreateEnum: MeetingActionStatus
CREATE TYPE "MeetingActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum: MeetingParticipantStatus
CREATE TYPE "MeetingParticipantStatus" AS ENUM ('INVITED', 'PRESENT', 'ABSENT', 'EXCUSED');

-- CreateTable: MeetingAgendaItem
CREATE TABLE "MeetingAgendaItem" (
    "id"              TEXT NOT NULL,
    "meetingId"       TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "notes"           TEXT,
    "owner"           TEXT,
    "durationMin"     INTEGER,
    "orderIndex"      INTEGER NOT NULL DEFAULT 0,
    "status"          "MeetingAgendaItemStatus" NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MeetingDecision
CREATE TABLE "MeetingDecision" (
    "id"              TEXT NOT NULL,
    "meetingId"       TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "status"          "MeetingDecisionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "owner"           TEXT,
    "orderIndex"      INTEGER NOT NULL DEFAULT 0,
    "linkedRefs"      JSONB,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MeetingAction
CREATE TABLE "MeetingAction" (
    "id"              TEXT NOT NULL,
    "meetingId"       TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "owner"           TEXT,
    "dueDate"         TIMESTAMP(3),
    "status"          "MeetingActionStatus" NOT NULL DEFAULT 'OPEN',
    "linkedRefs"      JSONB,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MeetingParticipant
CREATE TABLE "MeetingParticipant" (
    "id"        TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "role"      TEXT,
    "status"    "MeetingParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "userId"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingAgendaItem_meetingId_orderIndex_idx" ON "MeetingAgendaItem"("meetingId", "orderIndex");
CREATE INDEX "MeetingDecision_meetingId_orderIndex_idx"  ON "MeetingDecision"("meetingId", "orderIndex");
CREATE INDEX "MeetingAction_meetingId_idx"               ON "MeetingAction"("meetingId");
CREATE INDEX "MeetingAction_meetingId_status_idx"        ON "MeetingAction"("meetingId", "status");
CREATE INDEX "MeetingParticipant_meetingId_idx"          ON "MeetingParticipant"("meetingId");
CREATE INDEX "MeetingParticipant_meetingId_userId_idx"   ON "MeetingParticipant"("meetingId", "userId");

-- AddForeignKey (CASCADE — sub-entities are deleted with their meeting)
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingAction" ADD CONSTRAINT "MeetingAction_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
