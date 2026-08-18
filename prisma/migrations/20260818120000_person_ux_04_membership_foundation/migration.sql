-- PERSON-UX-04: Canonical club membership lifecycle foundation.
--
-- Introduces PersonMembership — the dedicated model for club membership history.
-- This is structurally SEPARATE from:
--   TenantMembership (login / tenant access)
--   OrgUnitMembership (RPERM/governance scope)
--   PersonAssignment (organisational function)
--   PlayerSquadMember / TrainerTeamMember (sporting capacity)
--
-- Historical records are kept permanently (no hard delete).
-- Membership is NOT season-bound and NOT derived from other relations.

-- CreateEnum
CREATE TYPE "PersonMembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "PersonMembershipType" AS ENUM ('ACTIVE_MEMBER', 'PASSIVE_MEMBER', 'HONORARY_MEMBER', 'OTHER');

-- CreateTable
CREATE TABLE "PersonMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "membershipType" "PersonMembershipType" NOT NULL DEFAULT 'ACTIVE_MEMBER',
    "status" "PersonMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberNumber" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonMembership_tenantId_idx" ON "PersonMembership"("tenantId");

-- CreateIndex
CREATE INDEX "PersonMembership_personId_idx" ON "PersonMembership"("personId");

-- CreateIndex
CREATE INDEX "PersonMembership_tenantId_status_idx" ON "PersonMembership"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PersonMembership_personId_status_idx" ON "PersonMembership"("personId", "status");

-- CreateIndex
CREATE INDEX "PersonMembership_tenantId_personId_idx" ON "PersonMembership"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "PersonMembership_startsAt_idx" ON "PersonMembership"("startsAt");

-- AddForeignKey
ALTER TABLE "PersonMembership" ADD CONSTRAINT "PersonMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMembership" ADD CONSTRAINT "PersonMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
