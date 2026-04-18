-- CreateEnum
CREATE TYPE "EventImportRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "EventImportRun" (
    "id" TEXT NOT NULL,
    "source" "EventSource" NOT NULL,
    "status" "EventImportRunStatus" NOT NULL DEFAULT 'PENDING',
    "type" "EventType",
    "seasonId" TEXT,
    "teamId" TEXT,
    "importBatchKey" TEXT NOT NULL,
    "fileName" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "rowsDetected" INTEGER NOT NULL DEFAULT 0,
    "rowsCreated" INTEGER NOT NULL DEFAULT 0,
    "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "errorMessage" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventImportRun_importBatchKey_key" ON "EventImportRun"("importBatchKey");

-- CreateIndex
CREATE INDEX "EventImportRun_source_status_idx" ON "EventImportRun"("source", "status");

-- CreateIndex
CREATE INDEX "EventImportRun_type_idx" ON "EventImportRun"("type");

-- CreateIndex
CREATE INDEX "EventImportRun_seasonId_idx" ON "EventImportRun"("seasonId");

-- CreateIndex
CREATE INDEX "EventImportRun_teamId_idx" ON "EventImportRun"("teamId");

-- CreateIndex
CREATE INDEX "EventImportRun_createdAt_idx" ON "EventImportRun"("createdAt");

-- CreateIndex
CREATE INDEX "Event_importBatchKey_idx" ON "Event"("importBatchKey");

-- AddForeignKey
ALTER TABLE "EventImportRun" ADD CONSTRAINT "EventImportRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventImportRun" ADD CONSTRAINT "EventImportRun_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
