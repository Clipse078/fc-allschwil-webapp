-- Tenant Foundation — Phase 1
-- Pure CREATE TYPE + CREATE TABLE; no tenant isolation or feature wiring in this phase.

-- CreateEnum: TenantStatus
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable: Tenant
CREATE TABLE "Tenant" (
    "id"        TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "status"    "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_key_key" ON "Tenant"("key");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE INDEX "Tenant_name_idx" ON "Tenant"("name");
