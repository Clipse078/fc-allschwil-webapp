-- ---------------------------------------------------------------------------
-- Migration: 20260626200000_homepage_section_approval_workflow
-- CMS V2 Slice 6 — Editorial Approval Workflow Foundation
--
-- Adds editorial approval workflow fields to HomepageSection.
-- All additions are safe, additive, non-destructive.
--
-- Backwards-compatibility guarantee:
--   approvalStatus defaults to 'NOT_REQUIRED' — all existing rows retain their
--   current public visibility without any manual action.
--   Sections with NOT_REQUIRED or APPROVED may be published/scheduled.
--   Sections with DRAFT, IN_REVIEW, or CHANGES_REQUESTED are blocked from
--   publishing. Since existing rows get NOT_REQUIRED, publishing is unaffected.
--
-- Approval status values:
--   NOT_REQUIRED       — approval process not used for this section (default)
--   DRAFT              — section is in editorial draft, review not yet requested
--   IN_REVIEW          — review has been requested, awaiting reviewer decision
--   APPROVED           — reviewer approved; publishing allowed
--   CHANGES_REQUESTED  — reviewer requested changes; publishing blocked
--
-- Reviewer relations:
--   reviewerUserId   — nullable FK to User (assigned reviewer; foundation-level)
--   approvedByUserId — nullable FK to User (actor of most recent approval)
--   rejectedByUserId — nullable FK to User (actor of most recent rejection)
--   All use ON DELETE SET NULL so user deletion does not cascade-delete sections.
--
-- Audit trail:
--   All approval state transitions are recorded in AuditLog via logAction().
--   No separate HomepageSectionApprovalHistory table is added — existing
--   AuditLog infrastructure (moduleKey="homepage", entityType="HomepageSection")
--   is sufficient for this foundation slice.
--
-- No existing columns are altered or removed.
-- No existing data is modified by this migration itself.
-- ---------------------------------------------------------------------------

-- Add approvalStatus with a safe default of 'NOT_REQUIRED'
-- so all existing rows are treated as not requiring approval.
ALTER TABLE "HomepageSection"
    ADD COLUMN "approvalStatus"    TEXT NOT NULL DEFAULT 'NOT_REQUIRED';

-- Add nullable reviewer user FK
ALTER TABLE "HomepageSection"
    ADD COLUMN "reviewerUserId"    TEXT;

-- Add nullable review timeline timestamps
ALTER TABLE "HomepageSection"
    ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);

ALTER TABLE "HomepageSection"
    ADD COLUMN "reviewedAt"        TIMESTAMP(3);

ALTER TABLE "HomepageSection"
    ADD COLUMN "approvedAt"        TIMESTAMP(3);

ALTER TABLE "HomepageSection"
    ADD COLUMN "rejectedAt"        TIMESTAMP(3);

-- Add nullable approval note (reviewer's note from most recent action)
ALTER TABLE "HomepageSection"
    ADD COLUMN "approvalNote"      TEXT;

-- Add nullable approvedBy and rejectedBy user FKs
ALTER TABLE "HomepageSection"
    ADD COLUMN "approvedByUserId"  TEXT;

ALTER TABLE "HomepageSection"
    ADD COLUMN "rejectedByUserId"  TEXT;

-- Foreign key constraints — ON DELETE SET NULL preserves sections when users are deleted
ALTER TABLE "HomepageSection"
    ADD CONSTRAINT "HomepageSection_reviewerUserId_fkey"
    FOREIGN KEY ("reviewerUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomepageSection"
    ADD CONSTRAINT "HomepageSection_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomepageSection"
    ADD CONSTRAINT "HomepageSection_rejectedByUserId_fkey"
    FOREIGN KEY ("rejectedByUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for efficient approval-status-scoped queries (review queue)
CREATE INDEX "HomepageSection_tenantId_approvalStatus_idx"
    ON "HomepageSection"("tenantId", "approvalStatus");
