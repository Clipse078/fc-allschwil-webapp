-- Website Feed v1 — Slice 2: Sponsor + News Feed Data Foundation
-- Additive only: no destructive changes, no data loss, zero downtime safe.
--
-- Changes:
--   1. New enums: PublishStatus, SponsorTier
--   2. Tenant: add websiteEnabled, websiteDomain, approvedDataOnly
--   3. New table: Sponsor (tenant-scoped)
--   4. New table: NewsArticle (tenant-scoped)

-- 1. Enums

CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "SponsorTier" AS ENUM ('PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'PARTNER', 'OTHER');

-- 2. Tenant website config fields

ALTER TABLE "Tenant" ADD COLUMN "websiteEnabled"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "websiteDomain"    TEXT;
ALTER TABLE "Tenant" ADD COLUMN "approvedDataOnly" BOOLEAN NOT NULL DEFAULT true;

-- 3. Sponsor table

CREATE TABLE "Sponsor" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "logoUrl"       TEXT,
    "websiteUrl"    TEXT,
    "tier"          "SponsorTier" NOT NULL DEFAULT 'OTHER',
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Sponsor_tenantId_publishStatus_isActive_idx"
    ON "Sponsor"("tenantId", "publishStatus", "isActive");

CREATE INDEX "Sponsor_tenantId_tier_sortOrder_idx"
    ON "Sponsor"("tenantId", "tier", "sortOrder");

ALTER TABLE "Sponsor"
    ADD CONSTRAINT "Sponsor_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. NewsArticle table

CREATE TABLE "NewsArticle" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "slug"          TEXT NOT NULL,
    "excerpt"       TEXT,
    "body"          TEXT,
    "imageUrl"      TEXT,
    "publishedAt"   TIMESTAMP(3),
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsArticle_tenantId_slug_key"
    ON "NewsArticle"("tenantId", "slug");

CREATE INDEX "NewsArticle_tenantId_publishStatus_publishedAt_idx"
    ON "NewsArticle"("tenantId", "publishStatus", "publishedAt");

ALTER TABLE "NewsArticle"
    ADD CONSTRAINT "NewsArticle_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
