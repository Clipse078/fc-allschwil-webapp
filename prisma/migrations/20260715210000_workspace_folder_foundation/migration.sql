-- CreateEnum
CREATE TYPE "WorkspaceItemType" AS ENUM ('FILE', 'FOLDER');

-- CreateEnum
CREATE TYPE "WorkspaceDocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkspaceDocumentVersionStatus" AS ENUM ('CURRENT', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "WorkspaceAccessSubjectType" AS ENUM ('USER', 'ROLE', 'ORG_UNIT', 'TEAM', 'TARGET_GROUP');

-- CreateEnum
CREATE TYPE "WorkspaceAccessLevel" AS ENUM ('VIEW', 'DOWNLOAD', 'UPLOAD', 'EDIT', 'DELETE', 'MANAGE', 'OWNER');

-- AlterEnum
ALTER TYPE "PermissionModule" ADD VALUE 'WORKSPACE';

-- CreateTable
CREATE TABLE "WorkspaceFolder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceFolder_tenantId_idx" ON "WorkspaceFolder"("tenantId");

-- CreateIndex
CREATE INDEX "WorkspaceFolder_tenantId_parentId_idx" ON "WorkspaceFolder"("tenantId", "parentId");

-- CreateIndex
CREATE INDEX "WorkspaceFolder_tenantId_displayOrder_idx" ON "WorkspaceFolder"("tenantId", "displayOrder");

-- CreateIndex
CREATE INDEX "WorkspaceFolder_createdByUserId_idx" ON "WorkspaceFolder"("createdByUserId");

-- CreateIndex
CREATE INDEX "WorkspaceFolder_updatedByUserId_idx" ON "WorkspaceFolder"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "WorkspaceFolder" ADD CONSTRAINT "WorkspaceFolder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFolder" ADD CONSTRAINT "WorkspaceFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkspaceFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFolder" ADD CONSTRAINT "WorkspaceFolder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFolder" ADD CONSTRAINT "WorkspaceFolder_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
