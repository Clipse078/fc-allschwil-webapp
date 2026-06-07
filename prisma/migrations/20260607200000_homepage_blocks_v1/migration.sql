-- Migration: 20260607200000_homepage_blocks_v1
-- Homepage Blocks V1: composable homepage sections with Hero type.
-- Adds HomepageBlockStatus, HomepageBlockType enums and HomepageBlock model.

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "HomepageBlockStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "HomepageBlockType" AS ENUM ('HERO');

-- ── HomepageBlock table ───────────────────────────────────────────────────────

CREATE TABLE "HomepageBlock" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "type"           "HomepageBlockType"   NOT NULL DEFAULT 'HERO',
    "sortOrder"      INTEGER               NOT NULL DEFAULT 0,
    "status"         "HomepageBlockStatus" NOT NULL DEFAULT 'DRAFT',
    "title"          TEXT NOT NULL,
    "data"           JSONB NOT NULL DEFAULT '{}',
    "heroMediaId"    TEXT,
    "overlayColor"   TEXT,
    "overlayOpacity" INTEGER,
    "gradientType"   TEXT,
    "gradientFrom"   TEXT,
    "gradientTo"     TEXT,
    "textColor"      TEXT,
    "publishedAt"    TIMESTAMP(3),
    "scheduledAt"    TIMESTAMP(3),
    "reviewNotes"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageBlock_pkey" PRIMARY KEY ("id")
);

-- ── Foreign keys ──────────────────────────────────────────────────────────────

ALTER TABLE "HomepageBlock"
    ADD CONSTRAINT "HomepageBlock_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomepageBlock"
    ADD CONSTRAINT "HomepageBlock_heroMediaId_fkey"
    FOREIGN KEY ("heroMediaId") REFERENCES "MediaAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX "HomepageBlock_tenantId_idx"              ON "HomepageBlock"("tenantId");
CREATE INDEX "HomepageBlock_tenantId_status_idx"       ON "HomepageBlock"("tenantId", "status");
CREATE INDEX "HomepageBlock_tenantId_sortOrder_idx"    ON "HomepageBlock"("tenantId", "sortOrder");
CREATE INDEX "HomepageBlock_tenantId_status_publishedAt_idx"
    ON "HomepageBlock"("tenantId", "status", "publishedAt");
CREATE INDEX "HomepageBlock_tenantId_status_sortOrder_idx"
    ON "HomepageBlock"("tenantId", "status", "sortOrder");
