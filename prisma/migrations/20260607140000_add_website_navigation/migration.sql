-- Website Navigation Management — Slice 2
--
-- Adds tenant-managed website navigation groups and items.
-- Additive only — no destructive changes.
--
-- Changes:
--   1. WebsiteNavKey enum        — MAIN | FOOTER
--   2. WebsiteNavItemType enum   — PAGE | CUSTOM_URL | EXTERNAL_URL
--   3. WebsiteNavigation table   — one record per (tenantId, key)
--   4. WebsiteNavigationItem table — ordered items per navigation group
--
-- Auto-creation of MAIN and FOOTER groups is handled by the query layer
-- (upsert on first access — no seed required).
--
-- Idempotency: all DDL uses IF NOT EXISTS / DO $$ BEGIN ... EXCEPTION guards.

-- ── 1. WebsiteNavKey enum ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "WebsiteNavKey" AS ENUM ('MAIN', 'FOOTER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. WebsiteNavItemType enum ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "WebsiteNavItemType" AS ENUM ('PAGE', 'CUSTOM_URL', 'EXTERNAL_URL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. WebsiteNavigation table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WebsiteNavigation" (
    "id"        TEXT               NOT NULL,
    "tenantId"  TEXT               NOT NULL,
    "key"       "WebsiteNavKey"    NOT NULL,
    "label"     TEXT               NOT NULL,
    "createdAt" TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)       NOT NULL,
    CONSTRAINT "WebsiteNavigation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteNavigation_tenantId_key_key"
  ON "WebsiteNavigation"("tenantId", "key");

CREATE INDEX IF NOT EXISTS "WebsiteNavigation_tenantId_idx"
  ON "WebsiteNavigation"("tenantId");

-- FK: WebsiteNavigation.tenantId → Tenant.id
DO $$ BEGIN
  ALTER TABLE "WebsiteNavigation"
    ADD CONSTRAINT "WebsiteNavigation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. WebsiteNavigationItem table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WebsiteNavigationItem" (
    "id"           TEXT                  NOT NULL,
    "tenantId"     TEXT                  NOT NULL,
    "navigationId" TEXT                  NOT NULL,
    "label"        TEXT                  NOT NULL,
    "itemType"     "WebsiteNavItemType"  NOT NULL DEFAULT 'CUSTOM_URL',
    "url"          TEXT,
    "pageId"       TEXT,
    "sortOrder"    INTEGER               NOT NULL DEFAULT 0,
    "parentId"     TEXT,
    "isVisible"    BOOLEAN               NOT NULL DEFAULT true,
    "opensInNewTab" BOOLEAN              NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)          NOT NULL,
    CONSTRAINT "WebsiteNavigationItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebsiteNavigationItem_tenantId_idx"
  ON "WebsiteNavigationItem"("tenantId");

CREATE INDEX IF NOT EXISTS "WebsiteNavigationItem_navigationId_idx"
  ON "WebsiteNavigationItem"("navigationId");

CREATE INDEX IF NOT EXISTS "WebsiteNavigationItem_navigationId_sortOrder_idx"
  ON "WebsiteNavigationItem"("navigationId", "sortOrder");

CREATE INDEX IF NOT EXISTS "WebsiteNavigationItem_tenantId_pageId_idx"
  ON "WebsiteNavigationItem"("tenantId", "pageId");

CREATE INDEX IF NOT EXISTS "WebsiteNavigationItem_parentId_idx"
  ON "WebsiteNavigationItem"("parentId");

-- FK: WebsiteNavigationItem.tenantId → Tenant.id
DO $$ BEGIN
  ALTER TABLE "WebsiteNavigationItem"
    ADD CONSTRAINT "WebsiteNavigationItem_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK: WebsiteNavigationItem.navigationId → WebsiteNavigation.id
DO $$ BEGIN
  ALTER TABLE "WebsiteNavigationItem"
    ADD CONSTRAINT "WebsiteNavigationItem_navigationId_fkey"
    FOREIGN KEY ("navigationId") REFERENCES "WebsiteNavigation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK: WebsiteNavigationItem.pageId → WebsitePage.id (set null on delete)
DO $$ BEGIN
  ALTER TABLE "WebsiteNavigationItem"
    ADD CONSTRAINT "WebsiteNavigationItem_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "WebsitePage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK: WebsiteNavigationItem.parentId → WebsiteNavigationItem.id (self-ref, set null)
DO $$ BEGIN
  ALTER TABLE "WebsiteNavigationItem"
    ADD CONSTRAINT "WebsiteNavigationItem_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "WebsiteNavigationItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
