-- Org Builder Foundation — Phase 1
-- All pure CREATE TYPE / CREATE TABLE — fully transaction-safe, no ALTER TYPE ADD VALUE.

-- CreateEnum: OrgUnitType
CREATE TYPE "OrgUnitType" AS ENUM (
  'CLUB', 'DIVISION', 'DEPARTMENT', 'SUB_DEPARTMENT',
  'TEAM', 'COMMITTEE', 'PROJECT_GROUP', 'CUSTOM'
);

-- CreateEnum: OrgUnitStatus
CREATE TYPE "OrgUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum: OrgUnitMembershipStatus
CREATE TYPE "OrgUnitMembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateTable: OrgUnit
-- key is unique across the deployment (single-tenant v1).
-- tenantId is nullable — ready for multi-tenant without schema migration.
-- level is denormalized depth (0 = root); max depth 3 enforced in API.
-- parentId is a self-referential FK with onDelete: SetNull (orphan protection).
CREATE TABLE "OrgUnit" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT,
    "parentId"    TEXT,
    "type"        "OrgUnitType" NOT NULL DEFAULT 'DEPARTMENT',
    "status"      "OrgUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "key"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "level"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OrgUnitMembership
CREATE TABLE "OrgUnitMembership" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT,
    "orgUnitId" TEXT NOT NULL,
    "userId"    TEXT,
    "personId"  TEXT,
    "roleKey"   TEXT,
    "status"    "OrgUnitMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "startsAt"  TIMESTAMP(3),
    "endsAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgUnitMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TargetGroup
-- ruleJson stores audience resolution rules (union of orgUnitId / roleKey / userId).
CREATE TABLE "TargetGroup" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT,
    "key"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "status"      "OrgUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "ruleJson"    JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TargetGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_key_key"          ON "OrgUnit"("key");
CREATE INDEX "OrgUnit_tenantId_idx"            ON "OrgUnit"("tenantId");
CREATE INDEX "OrgUnit_parentId_idx"            ON "OrgUnit"("parentId");
CREATE INDEX "OrgUnit_type_status_idx"         ON "OrgUnit"("type", "status");

CREATE INDEX "OrgUnitMembership_orgUnitId_idx"         ON "OrgUnitMembership"("orgUnitId");
CREATE INDEX "OrgUnitMembership_userId_idx"             ON "OrgUnitMembership"("userId");
CREATE INDEX "OrgUnitMembership_tenantId_userId_idx"   ON "OrgUnitMembership"("tenantId", "userId");
CREATE INDEX "OrgUnitMembership_orgUnitId_status_idx"  ON "OrgUnitMembership"("orgUnitId", "status");

CREATE UNIQUE INDEX "TargetGroup_key_key"      ON "TargetGroup"("key");
CREATE INDEX "TargetGroup_tenantId_idx"        ON "TargetGroup"("tenantId");
CREATE INDEX "TargetGroup_status_idx"          ON "TargetGroup"("status");

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrgUnitMembership" ADD CONSTRAINT "OrgUnitMembership_orgUnitId_fkey"
  FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
