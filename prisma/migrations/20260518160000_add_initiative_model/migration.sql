-- CreateEnum: InitiativeStatus
CREATE TYPE "InitiativeStatus" AS ENUM (
  'PLANNED',
  'IN_PROGRESS',
  'ON_TRACK',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED'
);

-- CreateTable: Initiative
-- Includes governance fields from day one (consistent with Meeting and Target pattern).
-- slug is unique so it serves as a stable URL key and maps to legacy mock slugs.
-- progress is a nullable 0-100 integer; future: derive from linked TargetMetrics.
-- Phase 2: add links to Targets (replace Target.linkedInitiativeRefs JSONB with FK).
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "status" "InitiativeStatus" NOT NULL DEFAULT 'PLANNED',
    "owner" TEXT,
    "progress" INTEGER,
    "dueDate" TIMESTAMP(3),
    "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
    "requiresFourEyeReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Initiative_slug_key" ON "Initiative"("slug");
CREATE INDEX "Initiative_status_idx" ON "Initiative"("status");
CREATE INDEX "Initiative_reviewStage_idx" ON "Initiative"("reviewStage");
CREATE INDEX "Initiative_dueDate_idx" ON "Initiative"("dueDate");
