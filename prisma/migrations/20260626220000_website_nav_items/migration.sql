-- ---------------------------------------------------------------------------
-- Migration: 20260626220000_website_nav_items
-- CMS V2 Slice 7 — Navigation Management Foundation
--
-- Creates the WebsiteNavItem table for per-tenant website navigation management.
-- Supports multi-level hierarchy via self-referential parentId.
--
-- Design notes:
--   - area:           string enum "HEADER" | "FOOTER" | "UTILITY"
--   - linkType:       string enum "INTERNAL" | "EXTERNAL" | "CUSTOM"
--   - target:         string enum "SELF" | "BLANK"
--   - visibilityMode: string enum "ALWAYS" | "AUTHENTICATED" | "ANONYMOUS"
--   - parentId:       nullable self-FK for parent/child hierarchy; SetNull on parent delete
--   - sortOrder:      ascending integer within the same parent/area
--   - isVisible:      primary public API visibility gate
--   - No destructive changes to any existing tables.
--   - Additive-only migration.
-- ---------------------------------------------------------------------------

CREATE TABLE "WebsiteNavItem" (
    "id"             TEXT        NOT NULL,
    "tenantId"       TEXT        NOT NULL,
    "parentId"       TEXT,
    "area"           TEXT        NOT NULL,
    "label"          TEXT        NOT NULL,
    "linkType"       TEXT        NOT NULL DEFAULT 'INTERNAL',
    "href"           TEXT,
    "target"         TEXT        NOT NULL DEFAULT 'SELF',
    "sortOrder"      INTEGER     NOT NULL DEFAULT 0,
    "isVisible"      BOOLEAN     NOT NULL DEFAULT true,
    "visibilityMode" TEXT        NOT NULL DEFAULT 'ALWAYS',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteNavItem_pkey" PRIMARY KEY ("id")
);

-- Tenant cascade-delete foreign key
ALTER TABLE "WebsiteNavItem"
    ADD CONSTRAINT "WebsiteNavItem_tenantId_fkey"
    FOREIGN KEY ("tenantId")
    REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Self-referential parent FK (SetNull so deleting a parent orphans children at top level)
ALTER TABLE "WebsiteNavItem"
    ADD CONSTRAINT "WebsiteNavItem_parentId_fkey"
    FOREIGN KEY ("parentId")
    REFERENCES "WebsiteNavItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for efficient tenant-scoped queries
CREATE INDEX "WebsiteNavItem_tenantId_idx"
    ON "WebsiteNavItem"("tenantId");

CREATE INDEX "WebsiteNavItem_tenantId_area_idx"
    ON "WebsiteNavItem"("tenantId", "area");

CREATE INDEX "WebsiteNavItem_tenantId_area_parentId_idx"
    ON "WebsiteNavItem"("tenantId", "area", "parentId");

CREATE INDEX "WebsiteNavItem_tenantId_area_parentId_sortOrder_idx"
    ON "WebsiteNavItem"("tenantId", "area", "parentId", "sortOrder");

CREATE INDEX "WebsiteNavItem_tenantId_isVisible_idx"
    ON "WebsiteNavItem"("tenantId", "isVisible");

CREATE INDEX "WebsiteNavItem_parentId_idx"
    ON "WebsiteNavItem"("parentId");
