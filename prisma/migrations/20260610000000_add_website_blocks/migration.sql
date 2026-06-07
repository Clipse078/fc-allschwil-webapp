-- CreateEnum
CREATE TYPE "WebsiteBlockType" AS ENUM ('HERO', 'RICH_TEXT', 'NEWS', 'UPCOMING_MATCHES', 'SPONSORS', 'CTA', 'GALLERY');

-- CreateEnum
CREATE TYPE "WebsiteBlockStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WebsitePageContext" AS ENUM ('HOMEPAGE');

-- CreateTable
CREATE TABLE "WebsiteBlock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "WebsiteBlockType" NOT NULL,
    "status" "WebsiteBlockStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "reviewNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteBlockInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "pageContext" "WebsitePageContext" NOT NULL DEFAULT 'HOMEPAGE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteBlockInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteBlock_tenantId_idx" ON "WebsiteBlock"("tenantId");

-- CreateIndex
CREATE INDEX "WebsiteBlock_tenantId_status_idx" ON "WebsiteBlock"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WebsiteBlock_tenantId_type_idx" ON "WebsiteBlock"("tenantId", "type");

-- CreateIndex
CREATE INDEX "WebsiteBlock_tenantId_status_publishedAt_idx" ON "WebsiteBlock"("tenantId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteBlockInstance_tenantId_blockId_pageContext_key" ON "WebsiteBlockInstance"("tenantId", "blockId", "pageContext");

-- CreateIndex
CREATE INDEX "WebsiteBlockInstance_tenantId_pageContext_idx" ON "WebsiteBlockInstance"("tenantId", "pageContext");

-- CreateIndex
CREATE INDEX "WebsiteBlockInstance_tenantId_pageContext_enabled_idx" ON "WebsiteBlockInstance"("tenantId", "pageContext", "enabled");

-- CreateIndex
CREATE INDEX "WebsiteBlockInstance_tenantId_pageContext_sortOrder_idx" ON "WebsiteBlockInstance"("tenantId", "pageContext", "sortOrder");

-- AddForeignKey
ALTER TABLE "WebsiteBlock" ADD CONSTRAINT "WebsiteBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteBlockInstance" ADD CONSTRAINT "WebsiteBlockInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteBlockInstance" ADD CONSTRAINT "WebsiteBlockInstance_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "WebsiteBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
