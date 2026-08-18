-- PERSON-UX-05: Player Development Assessment Foundation
-- Additive migration only. No destructive changes. No existing data affected.
-- Existing Persons simply have zero assessments.

-- DevelopmentCriterion: tenant-owned configurable criterion for assessments.
-- Multi-sport: no hardcoded sport enums.
CREATE TABLE "DevelopmentCriterion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentCriterion_pkey" PRIMARY KEY ("id")
);

-- DevelopmentAssessment: historical snapshot owned by Person + Season.
-- TeamSeason is optional context. Assessment history is permanent.
CREATE TABLE "DevelopmentAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamSeasonId" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "assessorUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentAssessment_pkey" PRIMARY KEY ("id")
);

-- DevelopmentAssessmentRating: per-criterion rating (0–100) within an assessment.
-- Snapshots criterion name + category for historical stability.
CREATE TABLE "DevelopmentAssessmentRating" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "normalizedScore" INTEGER NOT NULL,
    "criterionNameSnapshot" TEXT NOT NULL,
    "criterionCategorySnapshot" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentAssessmentRating_pkey" PRIMARY KEY ("id")
);

-- Indexes for DevelopmentCriterion
CREATE INDEX "DevelopmentCriterion_tenantId_isActive_sortOrder_idx" ON "DevelopmentCriterion"("tenantId", "isActive", "sortOrder");
CREATE INDEX "DevelopmentCriterion_tenantId_idx" ON "DevelopmentCriterion"("tenantId");

-- Indexes for DevelopmentAssessment
CREATE INDEX "DevelopmentAssessment_tenantId_personId_assessedAt_idx" ON "DevelopmentAssessment"("tenantId", "personId", "assessedAt");
CREATE INDEX "DevelopmentAssessment_tenantId_seasonId_idx" ON "DevelopmentAssessment"("tenantId", "seasonId");
CREATE INDEX "DevelopmentAssessment_personId_seasonId_idx" ON "DevelopmentAssessment"("personId", "seasonId");
CREATE INDEX "DevelopmentAssessment_teamSeasonId_idx" ON "DevelopmentAssessment"("teamSeasonId");

-- Unique + indexes for DevelopmentAssessmentRating
CREATE UNIQUE INDEX "DevelopmentAssessmentRating_assessmentId_criterionId_key" ON "DevelopmentAssessmentRating"("assessmentId", "criterionId");
CREATE INDEX "DevelopmentAssessmentRating_assessmentId_idx" ON "DevelopmentAssessmentRating"("assessmentId");
CREATE INDEX "DevelopmentAssessmentRating_criterionId_idx" ON "DevelopmentAssessmentRating"("criterionId");

-- Foreign keys for DevelopmentCriterion
ALTER TABLE "DevelopmentCriterion" ADD CONSTRAINT "DevelopmentCriterion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for DevelopmentAssessment
ALTER TABLE "DevelopmentAssessment" ADD CONSTRAINT "DevelopmentAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevelopmentAssessment" ADD CONSTRAINT "DevelopmentAssessment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentAssessment" ADD CONSTRAINT "DevelopmentAssessment_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentAssessment" ADD CONSTRAINT "DevelopmentAssessment_teamSeasonId_fkey" FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DevelopmentAssessment" ADD CONSTRAINT "DevelopmentAssessment_assessorUserId_fkey" FOREIGN KEY ("assessorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for DevelopmentAssessmentRating
ALTER TABLE "DevelopmentAssessmentRating" ADD CONSTRAINT "DevelopmentAssessmentRating_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "DevelopmentAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevelopmentAssessmentRating" ADD CONSTRAINT "DevelopmentAssessmentRating_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "DevelopmentCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
