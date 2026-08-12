-- INFOBOARD-V2: Unlimited tenant-managed Infoboard displays
-- Migration: 20260812180000_infoboard_v2_unlimited_boards
--
-- Adds:
--   - InfoboardStatus enum (ACTIVE, DISABLED, DRAFT)
--   - Infoboard model with all per-board configuration fields
--
-- Tenant.infoboardDisplayTheme is preserved (still used as fallback when
-- a specific Infoboard.displayTheme is null).
-- Existing /infoboard/screen-1 public URL remains valid — a seeded
-- Infoboard row with slug "screen-1" will be inserted by the seed script.

-- CreateEnum
CREATE TYPE "InfoboardStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DRAFT');

-- CreateTable
CREATE TABLE "Infoboard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "InfoboardStatus" NOT NULL DEFAULT 'ACTIVE',
    "templateType" TEXT NOT NULL DEFAULT 'TAGESUEBERSICHT',
    "displayTheme" TEXT,
    "headerSubtitleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "headerSubtitleText" TEXT,
    "headerShowTime" BOOLEAN NOT NULL DEFAULT true,
    "headerShowDate" BOOLEAN NOT NULL DEFAULT true,
    "headerShowWeather" BOOLEAN NOT NULL DEFAULT false,
    "announcementEnabled" BOOLEAN NOT NULL DEFAULT false,
    "announcementText" TEXT,
    "announcementBgColor" TEXT,
    "announcementTextColor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Infoboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Infoboard_tenantId_slug_key" ON "Infoboard"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Infoboard_tenantId_status_idx" ON "Infoboard"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Infoboard_tenantId_sortOrder_idx" ON "Infoboard"("tenantId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Infoboard" ADD CONSTRAINT "Infoboard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
