-- PERSON-UX-07: Person-bound private document storage foundation
--
-- Additive only. No DROP. No RENAME. No destructive SQL.
-- This migration is SEPARATE from the capacity-profiles migration
-- (20260818150000_person_ux_07_capacity_profiles) to maintain separation of concerns.
--
-- SECURITY:
--   PersonDocument is a highly sensitive model. File binaries are stored
--   exclusively in the private Vercel Blob store ("person-docs/" prefix).
--   No public URL is ever returned to clients for download.
--   All reads/writes enforce tenant isolation + document-domain permission.
--
-- DO NOT DEPLOY without infrastructure review and authorization policy sign-off.

-- Document category enum
CREATE TYPE "PersonDocumentCategory" AS ENUM (
  'IDENTITY_DOCUMENT',
  'CONSENT',
  'CERTIFICATE',
  'QUALIFICATION',
  'CONTRACT',
  'PERMIT',
  'CORRESPONDENCE',
  'OTHER'
);

-- PersonDocument table
CREATE TABLE "PersonDocument" (
  "id"               TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "personId"         TEXT NOT NULL,
  "category"         "PersonDocumentCategory" NOT NULL DEFAULT 'OTHER',
  "title"            TEXT NOT NULL,
  "storageKey"       TEXT NOT NULL,
  "storageUrl"       TEXT,
  "originalFilename" TEXT NOT NULL,
  "mimeType"         TEXT NOT NULL,
  "sizeBytes"        INTEGER NOT NULL,
  "issueDate"        TIMESTAMP(3),
  "expiryDate"       TIMESTAMP(3),
  "notes"            TEXT,
  "uploadedByUserId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonDocument_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient queries
CREATE INDEX "PersonDocument_tenantId_idx" ON "PersonDocument"("tenantId");
CREATE INDEX "PersonDocument_personId_idx" ON "PersonDocument"("personId");
CREATE INDEX "PersonDocument_tenantId_personId_idx" ON "PersonDocument"("tenantId", "personId");
CREATE INDEX "PersonDocument_tenantId_personId_category_idx" ON "PersonDocument"("tenantId", "personId", "category");
CREATE INDEX "PersonDocument_expiryDate_idx" ON "PersonDocument"("expiryDate");
CREATE INDEX "PersonDocument_uploadedByUserId_idx" ON "PersonDocument"("uploadedByUserId");

-- Foreign keys
ALTER TABLE "PersonDocument" ADD CONSTRAINT "PersonDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonDocument" ADD CONSTRAINT "PersonDocument_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonDocument" ADD CONSTRAINT "PersonDocument_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
