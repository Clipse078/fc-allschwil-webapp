-- DAM Premium Media Library — CMS V2 Slice 11
--
-- Changes (all additive, zero destructive operations):
--   1. MediaAsset      — add description, copyright, photographer, folderId,
--                        archivedAt, storageKey columns.
--   2. MediaFolder     — new; tenant-scoped folder hierarchy for DAM.
--   3. MediaTag        — new; tenant-scoped controlled tag vocabulary.
--   4. MediaAssetTag   — new; asset ↔ tag join table.
--   5. MediaAssetUsage — new; generic cross-module usage tracking.
--
-- Idempotency: all DDL uses IF NOT EXISTS / IF COLUMN NOT EXISTS guards.
-- Safe to re-run if applied partially out-of-band.

-- ── 1. MediaAsset — DAM extension columns ─────────────────────────────────────
ALTER TABLE "MediaAsset"
  ADD COLUMN IF NOT EXISTS "description"  TEXT,
  ADD COLUMN IF NOT EXISTS "copyright"    TEXT,
  ADD COLUMN IF NOT EXISTS "photographer" TEXT,
  ADD COLUMN IF NOT EXISTS "folderId"     TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "storageKey"   TEXT;

-- Index for folder lookup
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_folderId_idx"
  ON "MediaAsset"("tenantId", "folderId");

-- ── 2. MediaFolder ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MediaFolder" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "parentId"   TEXT,
  "name"       TEXT NOT NULL,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MediaFolder_tenantId_idx"
  ON "MediaFolder"("tenantId");
CREATE INDEX IF NOT EXISTS "MediaFolder_tenantId_parentId_idx"
  ON "MediaFolder"("tenantId", "parentId");
CREATE INDEX IF NOT EXISTS "MediaFolder_tenantId_sortOrder_idx"
  ON "MediaFolder"("tenantId", "sortOrder");

ALTER TABLE "MediaFolder"
  DROP CONSTRAINT IF EXISTS "MediaFolder_tenantId_fkey";
ALTER TABLE "MediaFolder"
  ADD CONSTRAINT "MediaFolder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaFolder"
  DROP CONSTRAINT IF EXISTS "MediaFolder_parentId_fkey";
ALTER TABLE "MediaFolder"
  ADD CONSTRAINT "MediaFolder_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "MediaFolder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FK from MediaAsset.folderId → MediaFolder
ALTER TABLE "MediaAsset"
  DROP CONSTRAINT IF EXISTS "MediaAsset_folderId_fkey";
ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "MediaFolder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. MediaTag ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MediaTag" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaTag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaTag_tenantId_name_key" UNIQUE ("tenantId", "name")
);

CREATE INDEX IF NOT EXISTS "MediaTag_tenantId_idx"
  ON "MediaTag"("tenantId");

ALTER TABLE "MediaTag"
  DROP CONSTRAINT IF EXISTS "MediaTag_tenantId_fkey";
ALTER TABLE "MediaTag"
  ADD CONSTRAINT "MediaTag_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. MediaAssetTag ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MediaAssetTag" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "tagId"        TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaAssetTag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAssetTag_mediaAssetId_tagId_key" UNIQUE ("mediaAssetId", "tagId")
);

CREATE INDEX IF NOT EXISTS "MediaAssetTag_tagId_idx"
  ON "MediaAssetTag"("tagId");
CREATE INDEX IF NOT EXISTS "MediaAssetTag_tenantId_idx"
  ON "MediaAssetTag"("tenantId");

ALTER TABLE "MediaAssetTag"
  DROP CONSTRAINT IF EXISTS "MediaAssetTag_tenantId_fkey";
ALTER TABLE "MediaAssetTag"
  ADD CONSTRAINT "MediaAssetTag_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAssetTag"
  DROP CONSTRAINT IF EXISTS "MediaAssetTag_mediaAssetId_fkey";
ALTER TABLE "MediaAssetTag"
  ADD CONSTRAINT "MediaAssetTag_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAssetTag"
  DROP CONSTRAINT IF EXISTS "MediaAssetTag_tagId_fkey";
ALTER TABLE "MediaAssetTag"
  ADD CONSTRAINT "MediaAssetTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "MediaTag"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. MediaAssetUsage ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MediaAssetUsage" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "entityType"   TEXT NOT NULL,
  "entityId"     TEXT NOT NULL,
  "fieldPath"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaAssetUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAssetUsage_mediaAssetId_entityType_entityId_fieldPath_key"
    UNIQUE ("mediaAssetId", "entityType", "entityId", "fieldPath")
);

CREATE INDEX IF NOT EXISTS "MediaAssetUsage_tenantId_idx"
  ON "MediaAssetUsage"("tenantId");
CREATE INDEX IF NOT EXISTS "MediaAssetUsage_mediaAssetId_idx"
  ON "MediaAssetUsage"("mediaAssetId");
CREATE INDEX IF NOT EXISTS "MediaAssetUsage_entityType_entityId_idx"
  ON "MediaAssetUsage"("entityType", "entityId");

ALTER TABLE "MediaAssetUsage"
  DROP CONSTRAINT IF EXISTS "MediaAssetUsage_tenantId_fkey";
ALTER TABLE "MediaAssetUsage"
  ADD CONSTRAINT "MediaAssetUsage_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAssetUsage"
  DROP CONSTRAINT IF EXISTS "MediaAssetUsage_mediaAssetId_fkey";
ALTER TABLE "MediaAssetUsage"
  ADD CONSTRAINT "MediaAssetUsage_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
