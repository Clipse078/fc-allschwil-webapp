-- Workspace document versioning
--
-- Adds tenant-scoped Workspace documents and immutable document versions.
--
-- Prerequisites are provided by:
-- 20260715210000_workspace_folder_foundation
--
-- That prerequisite migration creates:
-- - WorkspaceFolder
-- - WorkspaceDocumentStatus
-- - WorkspaceDocumentVersionStatus
-- - the remaining Workspace enums
-- - PermissionModule.WORKSPACE
--
-- This migration is additive and does not modify or remove existing data.

-- CreateTable
CREATE TABLE "WorkspaceDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "status" "WorkspaceDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentVersionId" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceDocumentVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "WorkspaceDocumentVersionStatus" NOT NULL DEFAULT 'CURRENT',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT,
    "checksum" TEXT,
    "changeNote" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceDocument_currentVersionId_key"
    ON "WorkspaceDocument"("currentVersionId");

-- CreateIndex
CREATE INDEX "WorkspaceDocument_tenantId_idx"
    ON "WorkspaceDocument"("tenantId");

-- CreateIndex
CREATE INDEX "WorkspaceDocument_tenantId_folderId_idx"
    ON "WorkspaceDocument"("tenantId", "folderId");

-- CreateIndex
CREATE INDEX "WorkspaceDocument_tenantId_status_idx"
    ON "WorkspaceDocument"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceDocument_tenantId_archivedAt_idx"
    ON "WorkspaceDocument"("tenantId", "archivedAt");

-- CreateIndex
CREATE INDEX "WorkspaceDocument_createdByUserId_idx"
    ON "WorkspaceDocument"("createdByUserId");

-- CreateIndex
CREATE INDEX "WorkspaceDocument_updatedByUserId_idx"
    ON "WorkspaceDocument"("updatedByUserId");

-- CreateIndex
CREATE INDEX "WorkspaceDocumentVersion_tenantId_idx"
    ON "WorkspaceDocumentVersion"("tenantId");

-- CreateIndex
CREATE INDEX "WorkspaceDocumentVersion_tenantId_documentId_idx"
    ON "WorkspaceDocumentVersion"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "WorkspaceDocumentVersion_tenantId_status_idx"
    ON "WorkspaceDocumentVersion"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceDocumentVersion_createdByUserId_idx"
    ON "WorkspaceDocumentVersion"("createdByUserId");

-- CreateIndex
CREATE INDEX "WorkspaceDocumentVersion_createdAt_idx"
    ON "WorkspaceDocumentVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceDocumentVersion_documentId_versionNumber_key"
    ON "WorkspaceDocumentVersion"("documentId", "versionNumber");

-- AddForeignKey
ALTER TABLE "WorkspaceDocument"
    ADD CONSTRAINT "WorkspaceDocument_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDocument"
    ADD CONSTRAINT "WorkspaceDocument_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "WorkspaceFolder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDocument"
    ADD CONSTRAINT "WorkspaceDocument_currentVersionId_fkey"
    FOREIGN KEY ("currentVersionId") REFERENCES "WorkspaceDocumentVersion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDocument"
    ADD CONSTRAINT "WorkspaceDocument_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDocument"
    ADD CONSTRAINT "WorkspaceDocument_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDocumentVersion"
    ADD CONSTRAINT "WorkspaceDocumentVersion_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDocumentVersion"
    ADD CONSTRAINT "WorkspaceDocumentVersion_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "WorkspaceDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDocumentVersion"
    ADD CONSTRAINT "WorkspaceDocumentVersion_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;