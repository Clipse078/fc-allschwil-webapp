-- Website News CMS MVP — additive migration
--
-- Changes (all additive, no data loss, zero-downtime safe):
--   1. NewsArticleStatus enum: add IN_REVIEW, APPROVED values
--   2. NewsArticle: add authorName column
--   3. MediaAssetType enum: new
--   4. MediaAsset table: new reusable tenant-scoped media library
--
-- Idempotency: uses IF NOT EXISTS / DO-EXCEPTION guards throughout.

-- 1. Extend NewsArticleStatus enum with review-workflow values
--    ALTER TYPE … ADD VALUE is idempotent via IF NOT EXISTS (Postgres 9.6+).
ALTER TYPE "NewsArticleStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "NewsArticleStatus" ADD VALUE IF NOT EXISTS 'APPROVED';

-- 2. authorName on NewsArticle
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "authorName" TEXT;

-- 3. MediaAssetType enum
DO $$ BEGIN
  CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'VIDEO', 'EMBED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. MediaAsset table
CREATE TABLE IF NOT EXISTS "MediaAsset" (
  "id"         TEXT         NOT NULL,
  "tenantId"   TEXT         NOT NULL,
  "type"       "MediaAssetType" NOT NULL,
  "url"        TEXT         NOT NULL,
  "storageKey" TEXT,
  "mimeType"   TEXT,
  "fileName"   TEXT,
  "altText"    TEXT,
  "caption"    TEXT,
  "size"       INTEGER,
  "width"      INTEGER,
  "height"     INTEGER,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_idx"      ON "MediaAsset"("tenantId");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_type_idx" ON "MediaAsset"("tenantId", "type");

-- FK: MediaAsset → Tenant (cascade)
DO $$ BEGIN
  ALTER TABLE "MediaAsset"
    ADD CONSTRAINT "MediaAsset_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
