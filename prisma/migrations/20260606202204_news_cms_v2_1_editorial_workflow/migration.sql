-- News CMS V2.1 editorial workflow (conditional / deferred)
--
-- This migration was generated before NewsArticleStatus, NewsArticle, MediaAsset,
-- and scheduledAt were introduced in later migrations. On a completely empty
-- database those prerequisites do not exist yet, so the news-specific DDL is
-- applied only when the objects are already present (legacy / out-of-band DBs).
-- Fresh bootstrap applies the same schema idempotently in
-- 20260609000000_news_cms_v2_media_library after prerequisites are created.

-- Drop redundant composite indexes (independent of news CMS prerequisites)
DROP INDEX IF EXISTS "Facility_tenantId_status_idx";
DROP INDEX IF EXISTS "FacilityResource_tenantId_status_idx";
DROP INDEX IF EXISTS "TargetGroup_tenantId_idx";

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NewsArticleStatus') THEN
    ALTER TYPE "NewsArticleStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public."NewsArticle"') IS NOT NULL THEN
    ALTER TABLE "NewsArticle"
      ADD COLUMN IF NOT EXISTS "authorPersonId" TEXT,
      ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;
  END IF;
END $$;

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

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'NewsArticle'
      AND column_name = 'scheduledAt'
  ) THEN
    CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_status_scheduledAt_idx"
      ON "NewsArticle"("tenantId", "status", "scheduledAt");
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public."NewsArticle"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_authorPersonId_idx"
      ON "NewsArticle"("tenantId", "authorPersonId");
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public."NewsArticle"') IS NOT NULL
     AND to_regclass('public."Person"') IS NOT NULL THEN
    ALTER TABLE "NewsArticle"
      ADD CONSTRAINT "NewsArticle_authorPersonId_fkey"
      FOREIGN KEY ("authorPersonId") REFERENCES "Person"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public."NewsArticleMedia"') IS NOT NULL
     AND to_regclass('public."Tenant"') IS NOT NULL THEN
    ALTER TABLE "NewsArticleMedia"
      ADD CONSTRAINT "NewsArticleMedia_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public."NewsArticleMedia"') IS NOT NULL
     AND to_regclass('public."NewsArticle"') IS NOT NULL THEN
    ALTER TABLE "NewsArticleMedia"
      ADD CONSTRAINT "NewsArticleMedia_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public."NewsArticleMedia"') IS NOT NULL
     AND to_regclass('public."MediaAsset"') IS NOT NULL THEN
    ALTER TABLE "NewsArticleMedia"
      ADD CONSTRAINT "NewsArticleMedia_mediaAssetId_fkey"
      FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
