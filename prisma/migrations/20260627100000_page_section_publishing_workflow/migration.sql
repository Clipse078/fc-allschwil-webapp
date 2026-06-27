-- CMS V2 Slice 9: Section Lifecycle — Publishing & Approval Workflow
--
-- Adds section-level publishing and approval workflow fields to WebsitePageSection.
-- Mirrors the HomepageSection workflow pattern for architectural consistency.
-- All columns are additive (no existing columns removed or altered).
-- Defaults preserve backwards compatibility for all pre-Slice-9 rows.

-- Publishing workflow fields
ALTER TABLE "WebsitePageSection" ADD COLUMN "publishStatus"      TEXT      NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "WebsitePageSection" ADD COLUMN "publishedAt"        TIMESTAMP(3);
ALTER TABLE "WebsitePageSection" ADD COLUMN "unpublishedAt"      TIMESTAMP(3);
ALTER TABLE "WebsitePageSection" ADD COLUMN "lastPublishedAt"    TIMESTAMP(3);
ALTER TABLE "WebsitePageSection" ADD COLUMN "scheduledPublishAt" TIMESTAMP(3);
ALTER TABLE "WebsitePageSection" ADD COLUMN "publishUntil"       TIMESTAMP(3);

-- Approval workflow fields
ALTER TABLE "WebsitePageSection" ADD COLUMN "approvalStatus"    TEXT      NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "WebsitePageSection" ADD COLUMN "reviewerUserId"    TEXT;
ALTER TABLE "WebsitePageSection" ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);
ALTER TABLE "WebsitePageSection" ADD COLUMN "reviewedAt"        TIMESTAMP(3);
ALTER TABLE "WebsitePageSection" ADD COLUMN "approvedAt"        TIMESTAMP(3);
ALTER TABLE "WebsitePageSection" ADD COLUMN "rejectedAt"        TIMESTAMP(3);
ALTER TABLE "WebsitePageSection" ADD COLUMN "approvalNote"      TEXT;
ALTER TABLE "WebsitePageSection" ADD COLUMN "approvedByUserId"  TEXT;
ALTER TABLE "WebsitePageSection" ADD COLUMN "rejectedByUserId"  TEXT;

-- Foreign key constraints (nullable — section can exist without reviewer/approver)
ALTER TABLE "WebsitePageSection" ADD CONSTRAINT "WebsitePageSection_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsitePageSection" ADD CONSTRAINT "WebsitePageSection_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsitePageSection" ADD CONSTRAINT "WebsitePageSection_rejectedByUserId_fkey"
  FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Performance indexes
CREATE INDEX "WebsitePageSection_tenantId_publishStatus_idx"  ON "WebsitePageSection"("tenantId", "publishStatus");
CREATE INDEX "WebsitePageSection_tenantId_approvalStatus_idx" ON "WebsitePageSection"("tenantId", "approvalStatus");
CREATE INDEX "WebsitePageSection_scheduledPublishAt_idx"      ON "WebsitePageSection"("scheduledPublishAt");
