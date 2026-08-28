-- TEAM-COCKPIT-PREMIUM-01J-A: Team-bound private document storage foundation
--
-- Additive only. No DROP. No RENAME. No destructive SQL.
--
-- SECURITY:
--   TeamDocument binaries are stored exclusively in the private Vercel Blob store
--   under the dedicated "team-docs/" namespace. No public URL is persisted.
--   All reads/writes enforce tenant + team isolation at the service layer.
--
-- DO NOT DEPLOY without infrastructure review and authorization policy sign-off.

CREATE TABLE "TeamDocument" (
  "id"               TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "teamId"           TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "storageKey"       TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType"         TEXT NOT NULL,
  "sizeBytes"        INTEGER NOT NULL,
  "uploadedByUserId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeamDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamDocument_tenantId_teamId_idx" ON "TeamDocument"("tenantId", "teamId");
CREATE INDEX "TeamDocument_tenantId_teamId_createdAt_idx" ON "TeamDocument"("tenantId", "teamId", "createdAt");
CREATE INDEX "TeamDocument_uploadedByUserId_idx" ON "TeamDocument"("uploadedByUserId");

ALTER TABLE "TeamDocument" ADD CONSTRAINT "TeamDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamDocument" ADD CONSTRAINT "TeamDocument_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamDocument" ADD CONSTRAINT "TeamDocument_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
