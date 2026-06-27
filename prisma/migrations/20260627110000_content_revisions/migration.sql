-- CMS V2 Slice 9: Version History — ContentRevision append-only audit table
--
-- Stores immutable snapshots of CMS entities at every significant edit.
-- Never deletes or updates rows. Restoring a revision creates a new row.
-- entityType supports: "WebsitePageSection" | "WebsitePage" | "HomepageSection"

CREATE TABLE "ContentRevision" (
  "id"              TEXT        NOT NULL,
  "tenantId"        TEXT        NOT NULL,
  "entityType"      TEXT        NOT NULL,
  "entityId"        TEXT        NOT NULL,
  "versionNumber"   INTEGER     NOT NULL,
  "createdByUserId" TEXT,
  "changeNote"      TEXT,
  "snapshot"        JSONB       NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one version number per entity
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_entityType_entityId_versionNumber_key"
  UNIQUE ("entityType", "entityId", "versionNumber");

-- Foreign key: tenant cascade-deletes revisions
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key: user set-null on delete (preserve revision even if user is removed)
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Performance indexes
CREATE INDEX "ContentRevision_tenantId_idx"          ON "ContentRevision"("tenantId");
CREATE INDEX "ContentRevision_entityType_entityId_idx" ON "ContentRevision"("entityType", "entityId");
CREATE INDEX "ContentRevision_tenantId_entityType_idx" ON "ContentRevision"("tenantId", "entityType");
CREATE INDEX "ContentRevision_createdAt_idx"          ON "ContentRevision"("createdAt");
