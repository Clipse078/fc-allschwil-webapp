-- ============================================================
-- Migration: add_meetings_module
-- Standalone Meetings module — not coupled to Vereinsleitung.
-- A meeting may optionally belong to a Season, Team, or OrgUnit
-- (described via orgUnitLabel until the Organisation Builder adds
-- a real OrgUnit model).
-- ============================================================

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingParticipantRole" AS ENUM ('CHAIR', 'SECRETARY', 'MEMBER', 'GUEST', 'OBSERVER');

-- CreateEnum
CREATE TYPE "MeetingActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "tenantSlug" TEXT NOT NULL DEFAULT 'fc-allschwil',
    "seasonId" TEXT,
    "teamId" TEXT,
    "orgUnitLabel" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "onlineMeetingUrl" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "minutesBody" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "durationMin" INTEGER,
    "presenter" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "personId" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "MeetingParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "attended" BOOLEAN,
    "apologyNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingDecision" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAction" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedTo" TEXT,
    "assignedUserId" TEXT,
    "assignedPersonId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "MeetingActionStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meeting_tenantSlug_scheduledAt_idx" ON "Meeting"("tenantSlug", "scheduledAt");

-- CreateIndex
CREATE INDEX "Meeting_tenantSlug_status_idx" ON "Meeting"("tenantSlug", "status");

-- CreateIndex
CREATE INDEX "Meeting_seasonId_idx" ON "Meeting"("seasonId");

-- CreateIndex
CREATE INDEX "Meeting_teamId_idx" ON "Meeting"("teamId");

-- CreateIndex
CREATE INDEX "Meeting_orgUnitLabel_idx" ON "Meeting"("orgUnitLabel");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_scheduledAt_idx" ON "Meeting"("scheduledAt");

-- CreateIndex
CREATE INDEX "MeetingAgendaItem_meetingId_sortOrder_idx" ON "MeetingAgendaItem"("meetingId", "sortOrder");

-- CreateIndex
CREATE INDEX "MeetingParticipant_meetingId_role_idx" ON "MeetingParticipant"("meetingId", "role");

-- CreateIndex
CREATE INDEX "MeetingParticipant_meetingId_attended_idx" ON "MeetingParticipant"("meetingId", "attended");

-- CreateIndex
CREATE INDEX "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");

-- CreateIndex
CREATE INDEX "MeetingParticipant_personId_idx" ON "MeetingParticipant"("personId");

-- CreateIndex
CREATE INDEX "MeetingDecision_meetingId_sortOrder_idx" ON "MeetingDecision"("meetingId", "sortOrder");

-- CreateIndex
CREATE INDEX "MeetingAction_meetingId_sortOrder_idx" ON "MeetingAction"("meetingId", "sortOrder");

-- CreateIndex
CREATE INDEX "MeetingAction_meetingId_status_idx" ON "MeetingAction"("meetingId", "status");

-- CreateIndex
CREATE INDEX "MeetingAction_assignedUserId_idx" ON "MeetingAction"("assignedUserId");

-- CreateIndex
CREATE INDEX "MeetingAction_dueDate_status_idx" ON "MeetingAction"("dueDate", "status");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAction" ADD CONSTRAINT "MeetingAction_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
