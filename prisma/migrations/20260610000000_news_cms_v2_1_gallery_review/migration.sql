-- News CMS V2.1 — Gallery + Review Workflow
-- Adds:
--   1. reviewStage + reviewNotes fields to NewsArticle
--   2. NewsArticleMedia join table for article gallery

-- 1. NewsArticle review workflow fields
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;

-- 2. NewsArticleMedia gallery join table
CREATE TABLE IF NOT EXISTS "NewsArticleMedia" (
    "id"            TEXT        NOT NULL,
    "newsArticleId" TEXT        NOT NULL,
    "mediaAssetId"  TEXT        NOT NULL,
    "caption"       TEXT,
    "orderIndex"    INTEGER     NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsArticleMedia_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: each asset can appear at most once per article
CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticleMedia_newsArticleId_mediaAssetId_key"
    ON "NewsArticleMedia"("newsArticleId", "mediaAssetId");

-- Performance index for ordered gallery fetch
CREATE INDEX IF NOT EXISTS "NewsArticleMedia_newsArticleId_orderIndex_idx"
    ON "NewsArticleMedia"("newsArticleId", "orderIndex");

-- Foreign keys
ALTER TABLE "NewsArticleMedia"
    DROP CONSTRAINT IF EXISTS "NewsArticleMedia_newsArticleId_fkey";
ALTER TABLE "NewsArticleMedia"
    ADD CONSTRAINT "NewsArticleMedia_newsArticleId_fkey"
    FOREIGN KEY ("newsArticleId")
    REFERENCES "NewsArticle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NewsArticleMedia"
    DROP CONSTRAINT IF EXISTS "NewsArticleMedia_mediaAssetId_fkey";
ALTER TABLE "NewsArticleMedia"
    ADD CONSTRAINT "NewsArticleMedia_mediaAssetId_fkey"
    FOREIGN KEY ("mediaAssetId")
    REFERENCES "MediaAsset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Index on reviewStage for admin filtering
CREATE INDEX IF NOT EXISTS "NewsArticle_tenantId_reviewStage_idx"
    ON "NewsArticle"("tenantId", "reviewStage");
