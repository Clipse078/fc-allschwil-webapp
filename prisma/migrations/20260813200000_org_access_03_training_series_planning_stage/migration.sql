-- ORG-ACCESS-03: Add planning workflow stage fields to TrainingSeries.
--
-- planningStage tracks the planning lifecycle separate from the lifecycle
-- status (ACTIVE/INACTIVE/ARCHIVED). Reuses the existing ReviewWorkflowStage
-- enum (DRAFT/SUBMITTED/APPROVED/REJECTED/PUBLISHED).
--
-- Existing rows (created before ORG-ACCESS-03 by tenant-wide coordinators)
-- are set to 'APPROVED' to preserve their coordinator-authoritative status.
-- New rows start as DRAFT (scoped user creation) or APPROVED (coordinator).

ALTER TABLE "TrainingSeries"
  ADD COLUMN "planningStage"         "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "planningSubmittedAt"   TIMESTAMP(3),
  ADD COLUMN "planningSubmittedById" TEXT,
  ADD COLUMN "planningValidatedAt"   TIMESTAMP(3),
  ADD COLUMN "planningValidatedById" TEXT,
  ADD COLUMN "createdByUserId"       TEXT;

-- Existing coordinator-created rows become APPROVED (authoritative/validated).
-- This does NOT bulk-rewrite business data — it sets a new administrative
-- workflow field to reflect the already-authoritative nature of records
-- created before OrgUnit-scoped write access existed.
UPDATE "TrainingSeries" SET "planningStage" = 'APPROVED';

-- Index for efficient planning-stage queries.
CREATE INDEX "TrainingSeries_planningStage_idx" ON "TrainingSeries"("planningStage");
