-- Migration: News CMS V2 + Shared Media Library Foundation
-- Phases 1–10: MediaAsset, NewsContentBlock, NewsArticle extensions

-- ── New enums ────────────────────────────────────────────────────────────────

CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');
CREATE TYPE "MediaAssetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'BLOB', 'S3', 'R2');
CREATE TYPE "NewsContentBlockType" AS ENUM ('TEXT', 'IMAGE', 'GALLERY', 'VIDEO', 'QUOTE', 'DIVIDER', 'CTA');
CREATE TYPE "NewsChannel" AS ENUM ('WEBSITE', 'MOBILE_APP', 'INFOBOARD', 'NEWSLETTER');

-- Phase 10: Extend NewsArticleStatus with four-eye states
ALTER TYPE "NewsArticleStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "NewsArticleStatus" ADD VALUE IF NOT EXISTS 'APPROVED';

-- ── MediaAsset ───────────────────────────────────────────────────────────────

CREATE TABLE "MediaAsset" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "type"            "MediaAssetType" NOT NULL,
    "status"          "MediaAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "name"            TEXT NOT NULL,
    "altText"         TEXT,
    "fileName"        TEXT NOT NULL,
    "mimeType"        TEXT NOT NULL,
    "fileSize"        INTEGER NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'BLOB',
    "storageKey"      TEXT NOT NULL,
    "storagePath"     TEXT NOT NULL,
    "focalX"          INTEGER,
    "focalY"          INTEGER,
    "createdById"     TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MediaAsset_tenantId_idx" ON "MediaAsset"("tenantId");
CREATE INDEX "MediaAsset_tenantId_type_idx" ON "MediaAsset"("tenantId", "type");
CREATE INDEX "MediaAsset_tenantId_status_idx" ON "MediaAsset"("tenantId", "status");
CREATE INDEX "MediaAsset_createdById_idx" ON "MediaAsset"("createdById");

ALTER TABLE "MediaAsset"
    ADD CONSTRAINT "MediaAsset_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAsset"
    ADD CONSTRAINT "MediaAsset_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── NewsContentBlock ─────────────────────────────────────────────────────────

CREATE TABLE "NewsContentBlock" (
    "id"        TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type"      "NewsContentBlockType" NOT NULL,
    "data"      JSONB NOT NULL,
    "mediaId"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsContentBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsContentBlock_articleId_idx" ON "NewsContentBlock"("articleId");
CREATE INDEX "NewsContentBlock_articleId_sortOrder_idx" ON "NewsContentBlock"("articleId", "sortOrder");
CREATE INDEX "NewsContentBlock_mediaId_idx" ON "NewsContentBlock"("mediaId");

ALTER TABLE "NewsContentBlock"
    ADD CONSTRAINT "NewsContentBlock_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NewsContentBlock"
    ADD CONSTRAINT "NewsContentBlock_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── NewsArticle extensions ────────────────────────────────────────────────────

-- Phase 3: Hero image via Media Library
ALTER TABLE "NewsArticle" ADD COLUMN "heroMediaId" TEXT;

-- Phase 8: Author display name
ALTER TABLE "NewsArticle" ADD COLUMN "authorName" TEXT;

-- Phase 9: Publishing channels (JSON array of NewsChannel values)
ALTER TABLE "NewsArticle" ADD COLUMN "channels" JSONB;

-- Phase 10: Created-by user FK for audit trail
ALTER TABLE "NewsArticle" ADD COLUMN "createdById" TEXT;

CREATE INDEX "NewsArticle_heroMediaId_idx" ON "NewsArticle"("heroMediaId");

ALTER TABLE "NewsArticle"
    ADD CONSTRAINT "NewsArticle_heroMediaId_fkey"
    FOREIGN KEY ("heroMediaId") REFERENCES "MediaAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NewsArticle"
    ADD CONSTRAINT "NewsArticle_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── User → Media relations (back-references already handled by FK) ────────────
-- No additional DDL needed; Prisma relations are virtual.
