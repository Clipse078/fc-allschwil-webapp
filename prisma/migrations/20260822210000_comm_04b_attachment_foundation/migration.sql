-- COMM-04B: additive immutable communication attachment foundation.
-- Legacy CommunicationMessage.attachments JSON is intentionally retained.

CREATE TYPE "CommunicationAttachmentSourceType" AS ENUM (
  'UPLOAD',
  'WORKSPACE_DOCUMENT_VERSION',
  'GENERATED_DOCUMENT',
  'INBOUND'
);

CREATE TYPE "CommunicationAttachmentLifecycleStatus" AS ENUM (
  'STAGED',
  'READY',
  'FAILED',
  'QUARANTINED'
);

CREATE TYPE "CommunicationAttachmentScanStatus" AS ENUM (
  'PENDING',
  'CLEAN',
  'QUARANTINED',
  'FAILED'
);

ALTER TABLE "CommunicationMessage"
  ADD COLUMN "retryOfMessageId" TEXT;

CREATE TABLE "CommunicationAttachment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "sanitizedFilename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "sourceType" "CommunicationAttachmentSourceType" NOT NULL,
  "sourceDocumentId" TEXT,
  "sourceDocumentVersionId" TEXT,
  "ingestionMetadata" JSONB,
  "lifecycleStatus" "CommunicationAttachmentLifecycleStatus" NOT NULL DEFAULT 'STAGED',
  "scanStatus" "CommunicationAttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationMessageAttachment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "attachmentId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationAttachment_storageKey_key"
  ON "CommunicationAttachment"("storageKey");
CREATE INDEX "CommunicationAttachment_tenantId_idx"
  ON "CommunicationAttachment"("tenantId");
CREATE INDEX "CommunicationAttachment_tenantId_createdAt_idx"
  ON "CommunicationAttachment"("tenantId", "createdAt");
CREATE INDEX "CommunicationAttachment_tenantId_checksumSha256_idx"
  ON "CommunicationAttachment"("tenantId", "checksumSha256");
CREATE INDEX "CommunicationAttachment_tenantId_lifecycleStatus_scanStatus_idx"
  ON "CommunicationAttachment"("tenantId", "lifecycleStatus", "scanStatus");
CREATE INDEX "CommunicationAttachment_tenantId_sourceDocumentId_idx"
  ON "CommunicationAttachment"("tenantId", "sourceDocumentId");
CREATE INDEX "CommunicationAttachment_tenantId_sourceDocumentVersionId_idx"
  ON "CommunicationAttachment"("tenantId", "sourceDocumentVersionId");
CREATE INDEX "CommunicationAttachment_createdByUserId_idx"
  ON "CommunicationAttachment"("createdByUserId");

CREATE UNIQUE INDEX "CommunicationMessageAttachment_messageId_attachmentId_key"
  ON "CommunicationMessageAttachment"("messageId", "attachmentId");
CREATE UNIQUE INDEX "CommunicationMessageAttachment_messageId_sortOrder_key"
  ON "CommunicationMessageAttachment"("messageId", "sortOrder");
CREATE INDEX "CommunicationMessageAttachment_tenantId_idx"
  ON "CommunicationMessageAttachment"("tenantId");
CREATE INDEX "CommunicationMessageAttachment_tenantId_messageId_sortOrder_idx"
  ON "CommunicationMessageAttachment"("tenantId", "messageId", "sortOrder");
CREATE INDEX "CommunicationMessageAttachment_tenantId_attachmentId_idx"
  ON "CommunicationMessageAttachment"("tenantId", "attachmentId");
CREATE INDEX "CommunicationMessage_tenantId_retryOfMessageId_idx"
  ON "CommunicationMessage"("tenantId", "retryOfMessageId");

ALTER TABLE "CommunicationMessage"
  ADD CONSTRAINT "CommunicationMessage_retryOfMessageId_fkey"
  FOREIGN KEY ("retryOfMessageId") REFERENCES "CommunicationMessage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunicationAttachment"
  ADD CONSTRAINT "CommunicationAttachment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAttachment"
  ADD CONSTRAINT "CommunicationAttachment_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationAttachment"
  ADD CONSTRAINT "CommunicationAttachment_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "WorkspaceDocument"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationAttachment"
  ADD CONSTRAINT "CommunicationAttachment_sourceDocumentVersionId_fkey"
  FOREIGN KEY ("sourceDocumentVersionId") REFERENCES "WorkspaceDocumentVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunicationMessageAttachment"
  ADD CONSTRAINT "CommunicationMessageAttachment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationMessageAttachment"
  ADD CONSTRAINT "CommunicationMessageAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "CommunicationMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationMessageAttachment"
  ADD CONSTRAINT "CommunicationMessageAttachment_attachmentId_fkey"
  FOREIGN KEY ("attachmentId") REFERENCES "CommunicationAttachment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
