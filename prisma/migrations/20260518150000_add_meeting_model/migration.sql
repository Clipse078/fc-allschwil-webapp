-- CreateEnum: MeetingStatus
CREATE TYPE "MeetingStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- CreateTable: Meeting
-- Includes governance fields from day one (consistent with Target pattern).
-- slug is unique so it serves as a stable URL key.
-- Phase 2: add agenda items, decisions, participants as related models.
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "attendeeCount" INTEGER,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PLANNED',
    "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
    "requiresFourEyeReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_slug_key" ON "Meeting"("slug");
CREATE INDEX "Meeting_meetingDate_idx" ON "Meeting"("meetingDate");
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");
CREATE INDEX "Meeting_reviewStage_idx" ON "Meeting"("reviewStage");
