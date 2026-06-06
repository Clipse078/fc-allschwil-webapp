-- News CMS V2.1 — Gallery + Review Workflow
--
-- NOTE: The STAGE DB already contains a NewsArticleMedia table (from migration
-- 20260606202204_news_cms_v2_1_editorial_workflow applied by a previous agent)
-- with columns: id, tenantId, articleId, mediaAssetId, sortOrder, caption, placement.
-- The NewsArticle table already has: reviewStage, reviewNotes, authorPersonId.
--
-- This migration is idempotent — all statements use IF NOT EXISTS / IF EXISTS guards.
-- It documents the expected state and ensures any missing pieces are applied.

-- 1. NewsArticle review workflow fields (idempotent: already exist on STAGE)
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "authorPersonId" TEXT;

-- FK for authorPersonId (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NewsArticle_authorPersonId_fkey'
  ) THEN
    ALTER TABLE "NewsArticle"
      ADD CONSTRAINT "NewsArticle_authorPersonId_fkey"
      FOREIGN KEY ("authorPersonId")
      REFERENCES "Person"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. NewsArticleMedia gallery join table (idempotent: already exists on STAGE)
CREATE TABLE IF NOT EXISTS "NewsArticleMedia" (
    "id"           TEXT             NOT NULL,
    "tenantId"     TEXT             NOT NULL,
    "articleId"    TEXT             NOT NULL,
    "mediaAssetId" TEXT             NOT NULL,
    "sortOrder"    INTEGER          NOT NULL DEFAULT 0,
    "caption"      TEXT,
    "placement"    TEXT,
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsArticleMedia_pkey" PRIMARY KEY ("id")
);

-- Unique constraint (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticleMedia_articleId_mediaAssetId_key"
    ON "NewsArticleMedia"("articleId", "mediaAssetId");

-- Performance index (idempotent)
CREATE INDEX IF NOT EXISTS "NewsArticleMedia_articleId_sortOrder_idx"
    ON "NewsArticleMedia"("articleId", "sortOrder");
CREATE INDEX IF NOT EXISTS "NewsArticleMedia_tenantId_idx"
    ON "NewsArticleMedia"("tenantId");

-- Foreign keys (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'NewsArticleMedia_tenantId_fkey') THEN
    ALTER TABLE "NewsArticleMedia" ADD CONSTRAINT "NewsArticleMedia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'NewsArticleMedia_articleId_fkey') THEN
    ALTER TABLE "NewsArticleMedia" ADD CONSTRAINT "NewsArticleMedia_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'NewsArticleMedia_mediaAssetId_fkey') THEN
    ALTER TABLE "NewsArticleMedia" ADD CONSTRAINT "NewsArticleMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Index on NewsArticle.reviewStage (idempotent)
CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_reviewStage_idx"
    ON "NewsArticle"("tenantId", "reviewStage");
