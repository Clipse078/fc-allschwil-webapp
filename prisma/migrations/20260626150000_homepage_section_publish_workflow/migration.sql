-- ---------------------------------------------------------------------------
-- Migration: 20260626150000_homepage_section_publish_workflow
-- CMS V2 Slice 5 — Publishing Workflow Foundation
--
-- Adds publishing workflow fields to HomepageSection.
-- All additions are safe, additive, non-destructive.
--
-- Backwards-compatibility guarantee:
--   publishStatus defaults to 'PUBLISHED' — all existing rows retain their
--   current public visibility without any manual action.
--
-- Design notes:
--   - publishStatus: TEXT "DRAFT" | "PUBLISHED", default "PUBLISHED" for BC.
--   - publishedAt: nullable timestamp of last publish action.
--   - unpublishedAt: nullable timestamp of last unpublish action.
--   - lastPublishedAt: nullable audit-trail copy of most recent publish time.
--     Retained across unpublish so the last-known publish time is always visible.
--   - scheduledPublishAt: nullable future publish date. Public API treats sections
--     with scheduledPublishAt <= now() as effectively published.
--   - No existing columns are altered or removed.
--   - No existing data is modified by this migration itself; default values
--     preserve current behaviour for all pre-existing rows.
-- ---------------------------------------------------------------------------

-- Add publishStatus with a safe default of 'PUBLISHED'
-- so all existing rows are treated as published immediately after migration.
ALTER TABLE "HomepageSection"
    ADD COLUMN "publishStatus"      TEXT NOT NULL DEFAULT 'PUBLISHED';

-- Add nullable publishing audit timestamps
ALTER TABLE "HomepageSection"
    ADD COLUMN "publishedAt"        TIMESTAMP(3);

ALTER TABLE "HomepageSection"
    ADD COLUMN "unpublishedAt"      TIMESTAMP(3);

ALTER TABLE "HomepageSection"
    ADD COLUMN "lastPublishedAt"    TIMESTAMP(3);

ALTER TABLE "HomepageSection"
    ADD COLUMN "scheduledPublishAt" TIMESTAMP(3);

-- Indexes for efficient publish-status-scoped queries
CREATE INDEX "HomepageSection_tenantId_publishStatus_idx"
    ON "HomepageSection"("tenantId", "publishStatus");

CREATE INDEX "HomepageSection_tenantId_isEnabled_publishStatus_idx"
    ON "HomepageSection"("tenantId", "isEnabled", "publishStatus");

CREATE INDEX "HomepageSection_scheduledPublishAt_idx"
    ON "HomepageSection"("scheduledPublishAt");
