-- News CMS V2 + Shared Media Library
--
-- Changes (all additive, zero destructive operations):
--   1. NewsArticleStatus enum — add SCHEDULED value.
--   2. MediaAssetType enum   — new (IMAGE | VIDEO).
--   3. MediaAssetStatus enum — new (ACTIVE | ARCHIVED).
--   4. MediaAsset table      — new; tenant-scoped shared media library.
--   5. NewsArticle           — add heroMediaId, channels, scheduledAt,
--                              authorName, tags columns + FK to MediaAsset.
--   6. Tenant                — no schema change; mediaAssets relation is
--                              Prisma-side only; no column added.
--
-- Idempotency: all DDL uses IF NOT EXISTS / ADD VALUE IF NOT EXISTS guards.
-- Safe to re-run if applied partially out-of-band.

-- ── 1. Extend NewsArticleStatus enum ─────────────────────────────────────────
-- ADD VALUE IF NOT EXISTS is idempotent in PostgreSQL ≥ 9.6.
-- IN_REVIEW may already exist from legacy DBs or 20260608000000; SCHEDULED is
-- introduced here alongside the V2 media-library foundation.
ALTER TYPE "NewsArticleStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "NewsArticleStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- ── 2. MediaAssetType enum ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. MediaAssetStatus enum ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "MediaAssetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. MediaAsset table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id"              TEXT                NOT NULL,
    "tenantId"        TEXT                NOT NULL,
    "type"            "MediaAssetType"    NOT NULL DEFAULT 'IMAGE',
    "status"          "MediaAssetStatus"  NOT NULL DEFAULT 'ACTIVE',
    "filename"        TEXT                NOT NULL,
    "mimeType"        TEXT                NOT NULL,
    "sizeBytes"       INTEGER             NOT NULL,
    "url"             TEXT                NOT NULL,
    "altText"         TEXT,
    "caption"         TEXT,
    "width"           INTEGER,
    "height"          INTEGER,
    "durationSec"     INTEGER,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)        NOT NULL,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- Indexes on MediaAsset
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_idx"           ON "MediaAsset"("tenantId");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_type_idx"      ON "MediaAsset"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_status_idx"    ON "MediaAsset"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_createdAt_idx" ON "MediaAsset"("tenantId", "createdAt");

-- FK: MediaAsset.tenantId → Tenant.id
DO $$ BEGIN
  ALTER TABLE "MediaAsset"
    ADD CONSTRAINT "MediaAsset_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 5. NewsArticle — V2 column additions ─────────────────────────────────────
ALTER TABLE "NewsArticle"
  ADD COLUMN IF NOT EXISTS "heroMediaId"  TEXT,
  ADD COLUMN IF NOT EXISTS "channels"     JSONB,
  ADD COLUMN IF NOT EXISTS "scheduledAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "authorName"   TEXT,
  ADD COLUMN IF NOT EXISTS "tags"         JSONB;

-- Index: heroMediaId for FK lookups
CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_heroMediaId_idx"
  ON "NewsArticle"("tenantId", "heroMediaId");

-- FK: NewsArticle.heroMediaId → MediaAsset.id (SET NULL on delete — orphan-safe)
DO $$ BEGIN
  ALTER TABLE "NewsArticle"
    ADD CONSTRAINT "NewsArticle_heroMediaId_fkey"
    FOREIGN KEY ("heroMediaId") REFERENCES "MediaAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 6. News CMS V2.1 editorial workflow (deferred from 20260606202204) ────────
-- Prerequisites (NewsArticle, MediaAsset, scheduledAt) now exist on fresh DBs.
ALTER TABLE "NewsArticle"
  ADD COLUMN IF NOT EXISTS "authorPersonId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;

CREATE TABLE IF NOT EXISTS "NewsArticleMedia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "placement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticleMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NewsArticleMedia_articleId_idx"
  ON "NewsArticleMedia"("articleId");

CREATE INDEX IF NOT EXISTS "NewsArticleMedia_tenantId_idx"
  ON "NewsArticleMedia"("tenantId");

CREATE INDEX IF NOT EXISTS "NewsArticleMedia_articleId_sortOrder_idx"
  ON "NewsArticleMedia"("articleId", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticleMedia_articleId_mediaAssetId_key"
  ON "NewsArticleMedia"("articleId", "mediaAssetId");

CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_status_scheduledAt_idx"
  ON "NewsArticle"("tenantId", "status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_authorPersonId_idx"
  ON "NewsArticle"("tenantId", "authorPersonId");

DO $$ BEGIN
  ALTER TABLE "NewsArticle"
    ADD CONSTRAINT "NewsArticle_authorPersonId_fkey"
    FOREIGN KEY ("authorPersonId") REFERENCES "Person"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NewsArticleMedia"
    ADD CONSTRAINT "NewsArticleMedia_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NewsArticleMedia"
    ADD CONSTRAINT "NewsArticleMedia_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NewsArticleMedia"
    ADD CONSTRAINT "NewsArticleMedia_mediaAssetId_fkey"
    FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
