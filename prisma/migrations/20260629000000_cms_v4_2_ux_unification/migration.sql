-- CMS V4.2: Website Platform UX Unification
--
-- This migration adds:
--   1. NewsArticle.contentJson (Json?)         — TipTap rich-text body, replaces markdown
--   2. NewsArticle.seoTitle / seoDescription   — per-article SEO overrides
--   3. WebsiteNavItem nav-builder enhancements — icon, megaMenu, description, badge, schedule fields
--   4. WebsiteConfig model                     — tenant-level website configuration (SEO, social, analytics,
--                                                 robots, sitemap, favicon, PWA, cookie banner)
--   5. WebsiteRedirect model                   — URL redirect rules (301/302)

-- ── 1. NewsArticle enrichments ────────────────────────────────────────────────

ALTER TABLE "NewsArticle"
  ADD COLUMN "contentJson"    JSONB,
  ADD COLUMN "seoTitle"       TEXT,
  ADD COLUMN "seoDescription" TEXT;

-- ── 1b. MediaAsset focus point fields ─────────────────────────────────────────

ALTER TABLE "MediaAsset"
  ADD COLUMN "focusX" DOUBLE PRECISION,
  ADD COLUMN "focusY" DOUBLE PRECISION;

-- ── 2. WebsiteNavItem navigation builder fields ───────────────────────────────

ALTER TABLE "WebsiteNavItem"
  ADD COLUMN "icon"         TEXT,
  ADD COLUMN "megaMenu"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "description"  TEXT,
  ADD COLUMN "badge"        TEXT,
  ADD COLUMN "scheduleFrom" TIMESTAMP(3),
  ADD COLUMN "scheduleTo"   TIMESTAMP(3);

-- ── 3. WebsiteConfig ──────────────────────────────────────────────────────────

CREATE TABLE "WebsiteConfig" (
    "id"                   TEXT NOT NULL,
    "tenantId"             TEXT NOT NULL,
    "seoSiteTitle"         TEXT,
    "seoTitleTemplate"     TEXT,
    "seoDefaultDescription" TEXT,
    "seoDefaultKeywords"   TEXT,
    "seoCanonicalBase"     TEXT,
    "ogTitle"              TEXT,
    "ogDescription"        TEXT,
    "ogImageUrl"           TEXT,
    "twitterSite"          TEXT,
    "twitterCardType"      TEXT,
    "googleAnalyticsId"    TEXT,
    "googleTagManagerId"   TEXT,
    "robotsTxt"            TEXT,
    "sitemapEnabled"       BOOLEAN NOT NULL DEFAULT true,
    "faviconUrl"           TEXT,
    "pwaEnabled"           BOOLEAN NOT NULL DEFAULT false,
    "pwaName"              TEXT,
    "pwaShortName"         TEXT,
    "pwaThemeColor"        TEXT,
    "pwaBgColor"           TEXT,
    "cookieBannerEnabled"  BOOLEAN NOT NULL DEFAULT false,
    "cookieBannerText"     TEXT,
    "cookieBannerLinkUrl"  TEXT,
    "cookieBannerLinkText" TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteConfig_tenantId_key" ON "WebsiteConfig"("tenantId");

ALTER TABLE "WebsiteConfig"
  ADD CONSTRAINT "WebsiteConfig_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. WebsiteRedirect ────────────────────────────────────────────────────────

CREATE TABLE "WebsiteRedirect" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "fromPath"   TEXT NOT NULL,
    "toPath"     TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteRedirect_tenantId_fromPath_key"
  ON "WebsiteRedirect"("tenantId", "fromPath");

CREATE INDEX "WebsiteRedirect_tenantId_idx"
  ON "WebsiteRedirect"("tenantId");

CREATE INDEX "WebsiteRedirect_tenantId_isActive_idx"
  ON "WebsiteRedirect"("tenantId", "isActive");

ALTER TABLE "WebsiteRedirect"
  ADD CONSTRAINT "WebsiteRedirect_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
