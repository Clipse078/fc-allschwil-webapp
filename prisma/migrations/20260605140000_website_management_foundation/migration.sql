-- Website Management Foundation
-- Adds website configuration fields to Tenant, WebsiteSection, and PublishedSnapshot.
-- Safe and non-destructive: new columns and tables only, no existing columns modified.
--
-- Tenant: three nullable website config fields added
--   websiteDomain    — public hostname for tenant resolution (future)
--   websiteEnabled   — master switch for public website feed (default false)
--   approvedDataOnly — serve only approved/published content via public API (default true)
--
-- WebsitePublishStatus / WebsiteSectionType: new enums
-- WebsiteSection:    one record per (tenantId, sectionType) — tracks section publish lifecycle
-- PublishedSnapshot: append-only audit trail of publish events

-- ──────────────────────────────────────────────────────────────────────────────
-- CreateEnum: WebsitePublishStatus
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TYPE "WebsitePublishStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'APPROVED',
    'PUBLISHED',
    'UNPUBLISHED'
);

-- ──────────────────────────────────────────────────────────────────────────────
-- CreateEnum: WebsiteSectionType
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TYPE "WebsiteSectionType" AS ENUM (
    'TEAMS',
    'EVENTS',
    'WEEKPLAN',
    'SPONSORS',
    'NEWS',
    'CONTENT'
);

-- ──────────────────────────────────────────────────────────────────────────────
-- AlterTable: Tenant — add website config fields
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Tenant"
    ADD COLUMN "websiteDomain"    TEXT,
    ADD COLUMN "websiteEnabled"   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "approvedDataOnly" BOOLEAN NOT NULL DEFAULT true;

-- ──────────────────────────────────────────────────────────────────────────────
-- CreateTable: WebsiteSection
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "WebsiteSection" (
    "id"                    TEXT                   NOT NULL,
    "tenantId"              TEXT                   NOT NULL,
    "sectionType"           "WebsiteSectionType"   NOT NULL,
    "status"                "WebsitePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "label"                 TEXT,
    "sortOrder"             INTEGER                NOT NULL DEFAULT 0,
    "isEnabled"             BOOLEAN                NOT NULL DEFAULT true,
    "lastPublishedAt"       TIMESTAMP(3),
    "lastPublishedByUserId" TEXT,
    "notes"                 TEXT,
    "createdAt"             TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)           NOT NULL,

    CONSTRAINT "WebsiteSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteSection_tenantId_sectionType_key"
    ON "WebsiteSection"("tenantId", "sectionType");

CREATE INDEX "WebsiteSection_tenantId_idx"
    ON "WebsiteSection"("tenantId");

CREATE INDEX "WebsiteSection_tenantId_status_idx"
    ON "WebsiteSection"("tenantId", "status");

CREATE INDEX "WebsiteSection_tenantId_sortOrder_idx"
    ON "WebsiteSection"("tenantId", "sortOrder");

ALTER TABLE "WebsiteSection"
    ADD CONSTRAINT "WebsiteSection_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- CreateTable: PublishedSnapshot
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "PublishedSnapshot" (
    "id"                TEXT                   NOT NULL,
    "tenantId"          TEXT                   NOT NULL,
    "sectionId"         TEXT                   NOT NULL,
    "status"            "WebsitePublishStatus" NOT NULL,
    "publishedByUserId" TEXT,
    "snapshotJson"      JSONB,
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublishedSnapshot_tenantId_createdAt_idx"
    ON "PublishedSnapshot"("tenantId", "createdAt");

CREATE INDEX "PublishedSnapshot_sectionId_createdAt_idx"
    ON "PublishedSnapshot"("sectionId", "createdAt");

ALTER TABLE "PublishedSnapshot"
    ADD CONSTRAINT "PublishedSnapshot_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublishedSnapshot"
    ADD CONSTRAINT "PublishedSnapshot_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "WebsiteSection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
