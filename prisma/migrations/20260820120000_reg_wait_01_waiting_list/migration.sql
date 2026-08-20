-- REG-WAIT-01: Canonical Waiting List domain
--
-- Additive migration — does NOT modify or drop any existing table/column.
-- Legacy Registration.status = WAITING is preserved and unchanged.
--
-- Creates:
--   WaitingListScopeType enum  (TARGET_GROUP | ORG_UNIT | TEAM_SEASON)
--   WaitingListStatus enum     (WAITING | CONTACTED | OFFERED | PLACED | WITHDRAWN | REJECTED | ARCHIVED)
--   WaitingListPriority enum   (NORMAL | HIGH | URGENT)
--   WaitingListEntry table     — canonical operational waiting-list record
--
-- ARCHITECTURAL INVARIANTS:
--   - WaitingListEntry does NOT duplicate Registration intake data.
--   - One Registration may have multiple WaitingListEntry rows over time
--     (historical entries), but service logic enforces at most one active
--     (non-terminal) entry at a time.
--   - Tenant isolation: all reads/writes must include tenantId guard.
--   - Scope: exactly one of targetGroupId | orgUnitId | teamSeasonId is set,
--     matching the scopeType field.

-- CreateEnum
CREATE TYPE "WaitingListScopeType" AS ENUM ('TARGET_GROUP', 'ORG_UNIT', 'TEAM_SEASON');

-- CreateEnum
CREATE TYPE "WaitingListStatus" AS ENUM ('WAITING', 'CONTACTED', 'OFFERED', 'PLACED', 'WITHDRAWN', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WaitingListPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "WaitingListEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "personId" TEXT,
    "scopeType" "WaitingListScopeType" NOT NULL,
    "targetGroupId" TEXT,
    "orgUnitId" TEXT,
    "teamSeasonId" TEXT,
    "status" "WaitingListStatus" NOT NULL DEFAULT 'WAITING',
    "priority" "WaitingListPriority" NOT NULL DEFAULT 'NORMAL',
    "responsibleUserId" TEXT,
    "reason" TEXT,
    "internalNote" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedByUserId" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "offeredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitingListEntry_pkey" PRIMARY KEY ("id")
);

-- Operational indexes
CREATE INDEX "WaitingListEntry_tenantId_status_idx" ON "WaitingListEntry"("tenantId", "status");
CREATE INDEX "WaitingListEntry_tenantId_addedAt_idx" ON "WaitingListEntry"("tenantId", "addedAt");
CREATE INDEX "WaitingListEntry_tenantId_priority_idx" ON "WaitingListEntry"("tenantId", "priority");
CREATE INDEX "WaitingListEntry_registrationId_idx" ON "WaitingListEntry"("registrationId");
CREATE INDEX "WaitingListEntry_personId_idx" ON "WaitingListEntry"("personId");
CREATE INDEX "WaitingListEntry_responsibleUserId_idx" ON "WaitingListEntry"("responsibleUserId");
CREATE INDEX "WaitingListEntry_targetGroupId_idx" ON "WaitingListEntry"("targetGroupId");
CREATE INDEX "WaitingListEntry_orgUnitId_idx" ON "WaitingListEntry"("orgUnitId");
CREATE INDEX "WaitingListEntry_teamSeasonId_idx" ON "WaitingListEntry"("teamSeasonId");

-- Foreign keys
ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_targetGroupId_fkey"
    FOREIGN KEY ("targetGroupId") REFERENCES "TargetGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_orgUnitId_fkey"
    FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_teamSeasonId_fkey"
    FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_responsibleUserId_fkey"
    FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_addedByUserId_fkey"
    FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_resolvedByUserId_fkey"
    FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
