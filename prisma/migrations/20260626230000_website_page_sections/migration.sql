-- ---------------------------------------------------------------------------
-- Migration: 20260626230000_website_page_sections
-- CMS V2 Slice 8 — Website Pages V2 / Page Builder Foundation
--
-- Creates the WebsitePageSection table for per-page block-based content sections.
-- Each WebsitePage can have an ordered set of typed sections using the shared
-- CMS block registry (lib/homepage/block-registry.ts).
--
-- Design notes:
--   - type:      block type key matching the shared block registry
--   - sortOrder: ascending integer within the same page
--   - isEnabled: primary public API visibility gate (page must also be PUBLISHED)
--   - config:    JSON blob for type-specific configuration; validated at app layer
--   - Publishing strategy: sections inherit the parent page's publish state;
--     isEnabled is the only section-level gate in this foundation slice.
--     Full section-level publish/approval workflow is deferred to a future slice.
--   - No destructive changes to any existing tables.
--   - Additive-only migration.
-- ---------------------------------------------------------------------------

CREATE TABLE "WebsitePageSection" (
    "id"        TEXT        NOT NULL,
    "tenantId"  TEXT        NOT NULL,
    "pageId"    TEXT        NOT NULL,
    "type"      TEXT        NOT NULL,
    "label"     TEXT        NOT NULL,
    "sortOrder" INTEGER     NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN     NOT NULL DEFAULT true,
    "config"    JSONB       NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsitePageSection_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "WebsitePageSection"
    ADD CONSTRAINT "WebsitePageSection_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsitePageSection"
    ADD CONSTRAINT "WebsitePageSection_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "WebsitePage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "WebsitePageSection_tenantId_idx"              ON "WebsitePageSection"("tenantId");
CREATE INDEX "WebsitePageSection_tenantId_pageId_idx"       ON "WebsitePageSection"("tenantId", "pageId");
CREATE INDEX "WebsitePageSection_tenantId_pageId_sortOrder_idx"
    ON "WebsitePageSection"("tenantId", "pageId", "sortOrder");
CREATE INDEX "WebsitePageSection_tenantId_pageId_isEnabled_idx"
    ON "WebsitePageSection"("tenantId", "pageId", "isEnabled");
