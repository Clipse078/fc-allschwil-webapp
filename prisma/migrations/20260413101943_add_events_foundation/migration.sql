-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MATCH', 'TOURNAMENT', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('CLUBCORNER_FVNWS', 'MANUAL', 'CSV_EXCEL_IMPORT');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'POSTPONED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "PermissionModule" ADD VALUE 'EVENTS';

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT,
    "type" "EventType" NOT NULL,
    "source" "EventSource" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "externalSource" TEXT,
    "externalSourceId" TEXT,
    "importBatchKey" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "opponentName" TEXT,
    "organizerName" TEXT,
    "competitionLabel" TEXT,
    "homeAway" TEXT,
    "resultLabel" TEXT,
    "meetingTime" TIMESTAMP(3),
    "websiteVisible" BOOLEAN NOT NULL DEFAULT true,
    "infoboardVisible" BOOLEAN NOT NULL DEFAULT false,
    "homepageVisible" BOOLEAN NOT NULL DEFAULT false,
    "wochenplanVisible" BOOLEAN NOT NULL DEFAULT false,
    "trainingsplanVisible" BOOLEAN NOT NULL DEFAULT false,
    "teamPageVisible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_seasonId_type_idx" ON "Event"("seasonId", "type");

-- CreateIndex
CREATE INDEX "Event_teamId_type_idx" ON "Event"("teamId", "type");

-- CreateIndex
CREATE INDEX "Event_startAt_idx" ON "Event"("startAt");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_source_idx" ON "Event"("source");

-- CreateIndex
CREATE INDEX "Event_websiteVisible_idx" ON "Event"("websiteVisible");

-- CreateIndex
CREATE INDEX "Event_infoboardVisible_idx" ON "Event"("infoboardVisible");

-- CreateIndex
CREATE INDEX "Event_wochenplanVisible_idx" ON "Event"("wochenplanVisible");

-- CreateIndex
CREATE INDEX "Event_trainingsplanVisible_idx" ON "Event"("trainingsplanVisible");

-- CreateIndex
CREATE INDEX "Event_teamPageVisible_idx" ON "Event"("teamPageVisible");

-- CreateIndex
CREATE INDEX "Event_externalSource_externalSourceId_idx" ON "Event"("externalSource", "externalSourceId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
