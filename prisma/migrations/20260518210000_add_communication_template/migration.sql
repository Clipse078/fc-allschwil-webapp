-- CreateEnum: CommunicationTemplateCategory
CREATE TYPE "CommunicationTemplateCategory" AS ENUM (
  'MATCH_INVITATION',
  'MEETING_FOLLOWUP',
  'INITIATIVE_UPDATE',
  'TARGET_PROGRESS',
  'TOURNAMENT_REMINDER',
  'GOVERNANCE_FOLLOWUP',
  'SPONSOR_OUTREACH',
  'PARENT_COMMUNICATION',
  'GENERAL'
);

-- CreateEnum: CommunicationTemplateStatus
CREATE TYPE "CommunicationTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable: CommunicationTemplate
-- Layer 1 of the Communication Foundation: stores and versions templates.
-- No sending infrastructure — rendering/delivery are separate layers.
CREATE TABLE "CommunicationTemplate" (
    "id"                  TEXT NOT NULL,
    "slug"                TEXT NOT NULL,
    "title"               TEXT NOT NULL,
    "category"            "CommunicationTemplateCategory" NOT NULL DEFAULT 'GENERAL',
    "status"              "CommunicationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "subject"             TEXT NOT NULL,
    "bodyMarkdown"        TEXT NOT NULL,
    "moduleKey"           TEXT,
    "variableRefs"        JSONB,
    "reviewStage"         "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
    "requiresFourEyeReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByUserId"    TEXT,
    "reviewedAt"          TIMESTAMP(3),
    "visibilityScope"     "VisibilityScope" NOT NULL DEFAULT 'ORGANISATION',
    "createdByUserId"     TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_slug_key" ON "CommunicationTemplate"("slug");
CREATE INDEX "CommunicationTemplate_category_idx"   ON "CommunicationTemplate"("category");
CREATE INDEX "CommunicationTemplate_status_idx"     ON "CommunicationTemplate"("status");
CREATE INDEX "CommunicationTemplate_moduleKey_idx"  ON "CommunicationTemplate"("moduleKey");
CREATE INDEX "CommunicationTemplate_reviewStage_idx" ON "CommunicationTemplate"("reviewStage");
