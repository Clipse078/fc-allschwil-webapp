-- Admin → Facilities & Resources MVP
-- Adds tenant-scoped Facility and FacilityResource tables.
-- Also adds FACILITIES to PermissionModule enum.
-- Safe and non-destructive: new tables only, no existing columns modified.

-- AlterEnum: Add FACILITIES to PermissionModule
ALTER TYPE "PermissionModule" ADD VALUE 'FACILITIES';

-- CreateEnum: FacilityType
CREATE TYPE "FacilityType" AS ENUM ('PITCH', 'DRESSING_ROOM_BLOCK', 'INDOOR_HALL', 'OTHER');

-- CreateEnum: FacilityResourceType
CREATE TYPE "FacilityResourceType" AS ENUM ('FULL_PITCH', 'HALF_PITCH', 'DRESSING_ROOM', 'OTHER');

-- CreateEnum: FacilityStatus
CREATE TYPE "FacilityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable: Facility
CREATE TABLE "Facility" (
    "id"        TEXT            NOT NULL,
    "tenantId"  TEXT            NOT NULL,
    "name"      TEXT            NOT NULL,
    "type"      "FacilityType"  NOT NULL DEFAULT 'OTHER',
    "status"    "FacilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER         NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FacilityResource
CREATE TABLE "FacilityResource" (
    "id"         TEXT                  NOT NULL,
    "tenantId"   TEXT                  NOT NULL,
    "facilityId" TEXT                  NOT NULL,
    "name"       TEXT                  NOT NULL,
    "code"       TEXT                  NOT NULL,
    "type"       "FacilityResourceType" NOT NULL DEFAULT 'OTHER',
    "status"     "FacilityStatus"      NOT NULL DEFAULT 'ACTIVE',
    "sortOrder"  INTEGER               NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3)          NOT NULL,

    CONSTRAINT "FacilityResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Facility_tenantId_idx" ON "Facility"("tenantId");
CREATE INDEX "Facility_tenantId_status_idx" ON "Facility"("tenantId", "status");
CREATE INDEX "Facility_tenantId_sortOrder_idx" ON "Facility"("tenantId", "sortOrder");

CREATE UNIQUE INDEX "FacilityResource_tenantId_code_key" ON "FacilityResource"("tenantId", "code");
CREATE INDEX "FacilityResource_tenantId_idx" ON "FacilityResource"("tenantId");
CREATE INDEX "FacilityResource_facilityId_idx" ON "FacilityResource"("facilityId");
CREATE INDEX "FacilityResource_tenantId_status_idx" ON "FacilityResource"("tenantId", "status");

-- AddForeignKey: Facility → Tenant
ALTER TABLE "Facility"
    ADD CONSTRAINT "Facility_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FacilityResource → Tenant
ALTER TABLE "FacilityResource"
    ADD CONSTRAINT "FacilityResource_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FacilityResource → Facility
ALTER TABLE "FacilityResource"
    ADD CONSTRAINT "FacilityResource_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "Facility"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
