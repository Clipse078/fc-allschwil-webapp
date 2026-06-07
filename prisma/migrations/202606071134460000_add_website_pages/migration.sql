-- Website Pages Foundation — Slice 1
--
-- Introduces tenant-managed website pages with full editorial workflow.
-- Mirrors the NewsArticle pattern but for semi-static pages.
--
-- Changes (additive only, no destructive operations):
--   1. WebsitePageStatus enum  — DRAFT | IN_REVIEW | SCHEDULED | PUBLISHED | ARCHIVED
--   2. WebsitePage table       — tenant-scoped, slug-unique per tenant
--
-- Workflow support (same as NewsArticle):
--   - approvedDataOnly = false → direct publish/unpublish
--   - approvedDataOnly = true  → DRAFT → IN_REVIEW → PUBLISHED (via reviewer)
--
-- Public API: GET /api/public/v1/website/pages/[slug]
--   Only PUBLISHED pages are returned. Internal fields (tenantId, reviewNotes, etc.)
--   are never exposed publicly.
--
-- Idempotency: uses DO blocks and IF NOT EXISTS guards for safe re-runs.

-- ── 1. WebsitePageStatus enum ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "WebsitePageStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. WebsitePage table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WebsitePage" (
    "id"             TEXT                 NOT NULL,
    "tenantId"       TEXT                 NOT NULL,
    "slug"           TEXT                 NOT NULL,
    "title"          TEXT                 NOT NULL,
    "body"           TEXT                 NOT NULL DEFAULT '',
    "status"         "WebsitePageStatus"  NOT NULL DEFAULT 'DRAFT',
    "seoTitle"       TEXT,
    "seoDescription" TEXT,
    "scheduledAt"    TIMESTAMP(3),
    "publishedAt"    TIMESTAMP(3),
    "authorPersonId" TEXT,
    "reviewNotes"    TEXT,
    "createdAt"      TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)         NOT NULL,
    CONSTRAINT "WebsitePage_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: slug is unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "WebsitePage_tenantId_slug_key"
  ON "WebsitePage"("tenantId", "slug");

-- Indexes (mirrors NewsArticle index pattern)
CREATE INDEX IF NOT EXISTS "WebsitePage_tenantId_idx"
  ON "WebsitePage"("tenantId");

CREATE INDEX IF NOT EXISTS "WebsitePage_tenantId_status_idx"
  ON "WebsitePage"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "WebsitePage_tenantId_status_publishedAt_idx"
  ON "WebsitePage"("tenantId", "status", "publishedAt");

CREATE INDEX IF NOT EXISTS "WebsitePage_tenantId_status_scheduledAt_idx"
  ON "WebsitePage"("tenantId", "status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "WebsitePage_tenantId_authorPersonId_idx"
  ON "WebsitePage"("tenantId", "authorPersonId");

CREATE INDEX IF NOT EXISTS "WebsitePage_slug_idx"
  ON "WebsitePage"("slug");

-- FK: WebsitePage.tenantId → Tenant.id (cascade delete/update)
DO $$ BEGIN
  ALTER TABLE "WebsitePage"
    ADD CONSTRAINT "WebsitePage_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK: WebsitePage.authorPersonId → Person.id (set null on delete — orphan-safe)
DO $$ BEGIN
  ALTER TABLE "WebsitePage"
    ADD CONSTRAINT "WebsitePage_authorPersonId_fkey"
    FOREIGN KEY ("authorPersonId") REFERENCES "Person"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
