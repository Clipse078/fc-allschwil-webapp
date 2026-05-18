-- AlterEnum: Add MEETINGS, INITIATIVES, TARGETS to WorkflowDomain
ALTER TYPE "WorkflowDomain" ADD VALUE 'MEETINGS';
ALTER TYPE "WorkflowDomain" ADD VALUE 'INITIATIVES';
ALTER TYPE "WorkflowDomain" ADD VALUE 'TARGETS';

-- AlterTable: Add governance fields to Target (consistent with Event.reviewStage pattern)
ALTER TABLE "Target"
  ADD COLUMN "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "requiresFourEyeReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Target_reviewStage_idx" ON "Target"("reviewStage");
