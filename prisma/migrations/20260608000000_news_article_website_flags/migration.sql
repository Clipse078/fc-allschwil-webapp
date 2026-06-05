-- Slice 4 — News Detail Endpoint
-- Adds website integration flags to Tenant and introduces the NewsArticle model.
--
-- Changes:
--   1. Tenant.websiteEnabled (BOOLEAN, default true)  — gates all /api/public/v1/website/* endpoints.
--   2. Tenant.approvedDataOnly (BOOLEAN, default false) — future editorial-approval gate.
--   3. NewsArticleStatus enum (DRAFT | PUBLISHED | ARCHIVED).
--   4. NewsArticle table — tenant-scoped, slug-unique per tenant, PUBLISHED-gated for public feeds.
--
-- Additive only: no destructive changes, no data loss, zero downtime safe.

-- 1. Tenant website flags
ALTER TABLE "Tenant" ADD COLUMN "websiteEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "approvedDataOnly" BOOLEAN NOT NULL DEFAULT false;

-- 2. NewsArticleStatus enum
CREATE TYPE "NewsArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- 3. NewsArticle table
CREATE TABLE "NewsArticle" (
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
CREATE UNIQUE INDEX "NewsArticle_tenantId_slug_key" ON "NewsArticle"("tenantId", "slug");

-- Indexes
CREATE INDEX "NewsArticle_tenantId_idx" ON "NewsArticle"("tenantId");
CREATE INDEX "NewsArticle_tenantId_status_idx" ON "NewsArticle"("tenantId", "status");
CREATE INDEX "NewsArticle_tenantId_status_publishedAt_idx" ON "NewsArticle"("tenantId", "status", "publishedAt");
CREATE INDEX "NewsArticle_slug_idx" ON "NewsArticle"("slug");

-- Foreign key: NewsArticle.tenantId → Tenant.id (cascade delete/update)
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
