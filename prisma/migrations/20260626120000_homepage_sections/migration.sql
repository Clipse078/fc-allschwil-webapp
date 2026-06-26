-- ---------------------------------------------------------------------------
-- Migration: 20260626120000_homepage_sections
-- CMS V2 Slice 2 — Homepage Builder Foundation
--
-- Creates the HomepageSection table for per-tenant configurable homepage
-- layout sections. Each row represents one logical homepage block.
--
-- Design notes:
--   - sortOrder: controls display order (ascending, 0-based integers).
--   - isEnabled: gates public API visibility.
--   - config: free-form JSONB for type-specific parameters.
--   - All data is tenant-scoped via tenantId with cascade delete.
--   - No destructive changes to existing tables.
-- ---------------------------------------------------------------------------

CREATE TABLE "HomepageSection" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config"    JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- Tenant cascade-delete foreign key
ALTER TABLE "HomepageSection"
    ADD CONSTRAINT "HomepageSection_tenantId_fkey"
    FOREIGN KEY ("tenantId")
    REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for efficient tenant-scoped queries
CREATE INDEX "HomepageSection_tenantId_idx"             ON "HomepageSection"("tenantId");
CREATE INDEX "HomepageSection_tenantId_isEnabled_idx"   ON "HomepageSection"("tenantId", "isEnabled");
CREATE INDEX "HomepageSection_tenantId_sortOrder_idx"   ON "HomepageSection"("tenantId", "sortOrder");
CREATE INDEX "HomepageSection_tenantId_isEnabled_sortOrder_idx"
    ON "HomepageSection"("tenantId", "isEnabled", "sortOrder");
