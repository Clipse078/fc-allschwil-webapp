-- AlterEnum
ALTER TYPE "NewsArticleStatus" ADD VALUE 'IN_REVIEW';

-- DropIndex
DROP INDEX "Facility_tenantId_status_idx";

-- DropIndex
DROP INDEX "FacilityResource_tenantId_status_idx";

-- DropIndex
DROP INDEX "TargetGroup_tenantId_idx";

-- AlterTable
ALTER TABLE "NewsArticle" ADD COLUMN     "authorPersonId" TEXT,
ADD COLUMN     "reviewNotes" TEXT;

-- CreateTable
CREATE TABLE "NewsArticleMedia" (
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

-- CreateIndex
CREATE INDEX "NewsArticleMedia_articleId_idx" ON "NewsArticleMedia"("articleId");

-- CreateIndex
CREATE INDEX "NewsArticleMedia_tenantId_idx" ON "NewsArticleMedia"("tenantId");

-- CreateIndex
CREATE INDEX "NewsArticleMedia_articleId_sortOrder_idx" ON "NewsArticleMedia"("articleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticleMedia_articleId_mediaAssetId_key" ON "NewsArticleMedia"("articleId", "mediaAssetId");

-- CreateIndex
CREATE INDEX "NewsArticle_tenantId_status_scheduledAt_idx" ON "NewsArticle"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NewsArticle_tenantId_authorPersonId_idx" ON "NewsArticle"("tenantId", "authorPersonId");

-- AddForeignKey
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_authorPersonId_fkey" FOREIGN KEY ("authorPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsArticleMedia" ADD CONSTRAINT "NewsArticleMedia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsArticleMedia" ADD CONSTRAINT "NewsArticleMedia_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsArticleMedia" ADD CONSTRAINT "NewsArticleMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
