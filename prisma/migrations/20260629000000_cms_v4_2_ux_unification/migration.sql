-- ============================================================================
-- CMS V4.2 — Website Platform UX Unification
-- Migration: 20260629000000_cms_v4_2_ux_unification
--
-- ADDITIVE ONLY — no DROP TABLE, DROP COLUMN, TRUNCATE, DELETE, or
-- destructive ALTER COLUMN.  All new columns are nullable or carry safe
-- defaults so existing rows are unaffected.
--
-- Changes:
--   1. Add EXPIRED value to NewsArticleStatus enum
--   2. Add EXPIRED value to WebsitePageStatus enum
--   3. Add focusX / focusY (nullable Float) to MediaAsset
--   4. Add visibleFrom / visibleUntil (nullable DateTime) to WebsiteNavItem
--   5. CREATE TABLE WebsiteConfig (one-per-tenant, @unique tenantId)
--   6. CREATE TABLE WebsiteRedirect (tenant-scoped HTTP redirects)
-- ============================================================================

-- ── 1. NewsArticleStatus — add EXPIRED ───────────────────────────────────────
-- Postgres requires ALTER TYPE … ADD VALUE for enum additions.
-- IF NOT EXISTS guard makes this idempotent on re-run.

ALTER TYPE "NewsArticleStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- ── 2. WebsitePageStatus — add EXPIRED ──────────────────────────────────────

ALTER TYPE "WebsitePageStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- ── 3. MediaAsset — focal point fields ──────────────────────────────────────
-- Both columns are nullable: existing rows default to NULL (= no focal point).
-- Renderers fall back to centre (0.5, 0.5) when NULL.

ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "focusX" DOUBLE PRECISION;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "focusY" DOUBLE PRECISION;

-- ── 4. NewsArticle — rich text body (CMS V4.2) ──────────────────────────────
-- Nullable JSON column alongside the existing `content` (Markdown) for backward
-- compatibility. When richContent is non-null the editor and public API prefer it.

ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "richContent" JSONB;

-- ── 5. WebsiteNavItem — scheduling window ───────────────────────────────────
-- Both nullable: NULL means no scheduling restriction (always visible if
-- isVisible=true).

ALTER TABLE "WebsiteNavItem" ADD COLUMN IF NOT EXISTS "visibleFrom"  TIMESTAMP(3);
ALTER TABLE "WebsiteNavItem" ADD COLUMN IF NOT EXISTS "visibleUntil" TIMESTAMP(3);

-- ── 7. WebsiteConfig ────────────────────────────────────────────────────────
-- One record per tenant.  tenantId is UNIQUE.  All config fields are nullable.

CREATE TABLE IF NOT EXISTS "WebsiteConfig" (
    "id"               TEXT         NOT NULL,
    "tenantId"         TEXT         NOT NULL,

    -- General
    "siteName"         TEXT,
    "siteDescription"  TEXT,
    "siteUrl"          TEXT,
    "contactEmail"     TEXT,

    -- SEO
    "seoTitle"         TEXT,
    "seoDescription"   TEXT,
    "seoKeywords"      TEXT,
    "robotsIndex"      BOOLEAN      NOT NULL DEFAULT TRUE,
    "robotsFollow"     BOOLEAN      NOT NULL DEFAULT TRUE,
    "canonicalUrl"     TEXT,

    -- Social / OG
    "ogTitle"          TEXT,
    "ogDescription"    TEXT,
    "ogImageUrl"       TEXT,
    "twitterHandle"    TEXT,
    "twitterCard"      TEXT         DEFAULT 'summary_large_image',

    -- Analytics
    "googleAnalyticsId"  TEXT,
    "googleTagManagerId" TEXT,
    "facebookPixelId"    TEXT,
    "plausibleDomain"    TEXT,

    -- Technical
    "customHeadHtml"   TEXT,
    "customBodyHtml"   TEXT,
    "maintenanceMode"  BOOLEAN      NOT NULL DEFAULT FALSE,
    "maintenanceMsg"   TEXT,

    -- PWA
    "pwaEnabled"       BOOLEAN      NOT NULL DEFAULT FALSE,
    "pwaName"          TEXT,
    "pwaShortName"     TEXT,
    "pwaThemeColor"    TEXT,

    -- Cookie consent
    "cookieEnabled"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "cookieBannerText" TEXT,
    "cookiePolicyUrl"  TEXT,

    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteConfig_pkey" PRIMARY KEY ("id")
);

-- One-per-tenant invariant
CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteConfig_tenantId_key"
    ON "WebsiteConfig"("tenantId");

CREATE INDEX IF NOT EXISTS "WebsiteConfig_tenantId_idx"
    ON "WebsiteConfig"("tenantId");

-- FK: tenantId → Tenant.id (cascade delete/update)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebsiteConfig_tenantId_fkey'
  ) THEN
    ALTER TABLE "WebsiteConfig"
      ADD CONSTRAINT "WebsiteConfig_tenantId_fkey"
      FOREIGN KEY ("tenantId")
      REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 8. WebsiteRedirect ──────────────────────────────────────────────────────
-- Tenant-scoped HTTP redirects.
-- fromPath is unique per tenant (one redirect source per path per tenant).

CREATE TABLE IF NOT EXISTS "WebsiteRedirect" (
    "id"          TEXT         NOT NULL,
    "tenantId"    TEXT         NOT NULL,
    "fromPath"    TEXT         NOT NULL,
    "toPath"      TEXT         NOT NULL,
    "isPermanent" BOOLEAN      NOT NULL DEFAULT TRUE,
    "isActive"    BOOLEAN      NOT NULL DEFAULT TRUE,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteRedirect_pkey" PRIMARY KEY ("id")
);

-- One source path per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteRedirect_tenantId_fromPath_key"
    ON "WebsiteRedirect"("tenantId", "fromPath");

CREATE INDEX IF NOT EXISTS "WebsiteRedirect_tenantId_idx"
    ON "WebsiteRedirect"("tenantId");

CREATE INDEX IF NOT EXISTS "WebsiteRedirect_tenantId_isActive_idx"
    ON "WebsiteRedirect"("tenantId", "isActive");

-- FK: tenantId → Tenant.id (cascade delete/update)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebsiteRedirect_tenantId_fkey'
  ) THEN
    ALTER TABLE "WebsiteRedirect"
      ADD CONSTRAINT "WebsiteRedirect_tenantId_fkey"
      FOREIGN KEY ("tenantId")
      REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
