-- Slice 4 — News Detail Endpoint
-- Adds website integration flags to Tenant and introduces the NewsArticle model.
--
-- Changes:
--   1. Tenant.websiteEnabled (BOOLEAN, default true)  — gates all /api/public/v1/website/* endpoints.
--   2. Tenant.approvedDataOnly (BOOLEAN, default false) — future editorial-approval gate.
--   3. NewsArticleStatus enum (DRAFT | IN_REVIEW | PUBLISHED | ARCHIVED).
--   4. NewsArticle table — tenant-scoped, slug-unique per tenant, PUBLISHED-gated for public feeds.
--
-- Additive only: no destructive changes, no data loss, zero downtime safe.
--
-- Idempotency: all statements use IF NOT EXISTS guards. Safe to re-run if
-- parts were applied out-of-band (e.g. manual hotfix on STAGE DB).

-- 1. Tenant website flags
--    ADD COLUMN IF NOT EXISTS ensures no error if columns were added manually.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "websiteEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "approvedDataOnly" BOOLEAN NOT NULL DEFAULT false;

-- 1a. Correct defaults if columns existed with wrong defaults from an earlier out-of-band apply.
ALTER TABLE "Tenant" ALTER COLUMN "websiteEnabled" SET DEFAULT true;
ALTER TABLE "Tenant" ALTER COLUMN "approvedDataOnly" SET DEFAULT false;

-- 1b. Enable website integration for the fc-allschwil tenant.
--     Required so /api/public/v1/website/news routes serve data instead of 403.
--     Only updates if it is currently false (safe no-op if already true).
UPDATE "Tenant" SET "websiteEnabled" = true WHERE key = 'fc-allschwil' AND "websiteEnabled" = false;

-- 2. NewsArticleStatus enum
--    Uses DO block for CREATE TYPE to allow idempotent re-runs.
--    IN_REVIEW is included here so fresh bootstrap does not depend on the
--    earlier (misordered) 20260606202204 migration.
DO $$ BEGIN
  CREATE TYPE "NewsArticleStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'PUBLISHED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL; -- enum already exists, no-op
END $$;

-- 3. NewsArticle table
CREATE TABLE IF NOT EXISTS "NewsArticle" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "excerpt"     TEXT,
    "content"     TEXT NOT NULL,
    "imageUrl"    TEXT,
    "status"      "NewsArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: slug is unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticle_tenantId_slug_key" ON "NewsArticle"("tenantId", "slug");

-- Indexes
CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_idx" ON "NewsArticle"("tenantId");
CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_status_idx" ON "NewsArticle"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_status_publishedAt_idx" ON "NewsArticle"("tenantId", "status", "publishedAt");
CREATE INDEX IF NOT EXISTS "NewsArticle_slug_idx" ON "NewsArticle"("slug");

-- Foreign key: NewsArticle.tenantId → Tenant.id (cascade delete/update)
--    DO block allows idempotent re-runs if constraint already exists.
DO $$ BEGIN
  ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists, no-op
END $$;
