-- PERSON-UX-10: Guardians & Emergency Contacts
--
-- Additive migration — does NOT modify or drop any existing table/column.
-- Legacy guardian scalar fields on Person are preserved in full.
--
-- Creates:
--   GuardianRelationshipType enum
--   GuardianRelationship table — canonical Person↔Person guardian links
--   PersonEmergencyContact table — standalone 1:n emergency contacts
--
-- ARCHITECTURAL INVARIANT:
--   GuardianRelationship carries ZERO authorization implications.
--   It does NOT create Users, TenantMemberships, Roles, or permissions.
--   Relationship and authorization are separate domains.

-- CreateEnum
CREATE TYPE "GuardianRelationshipType" AS ENUM ('MOTHER', 'FATHER', 'LEGAL_GUARDIAN', 'FOSTER_GUARDIAN', 'OTHER');

-- CreateTable: canonical Person↔Person guardian relationships
CREATE TABLE "GuardianRelationship" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "childPersonId" TEXT NOT NULL,
    "guardianPersonId" TEXT NOT NULL,
    "relationshipType" "GuardianRelationshipType" NOT NULL DEFAULT 'OTHER',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable: standalone emergency contacts (NOT Person records)
CREATE TABLE "PersonEmergencyContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "relationship" VARCHAR(100),
    "phone" VARCHAR(50) NOT NULL,
    "email" VARCHAR(254),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- Indexes for GuardianRelationship
CREATE INDEX "GuardianRelationship_tenantId_idx" ON "GuardianRelationship"("tenantId");
CREATE INDEX "GuardianRelationship_childPersonId_idx" ON "GuardianRelationship"("childPersonId");
CREATE INDEX "GuardianRelationship_guardianPersonId_idx" ON "GuardianRelationship"("guardianPersonId");
CREATE UNIQUE INDEX "GuardianRelationship_childPersonId_guardianPersonId_key" ON "GuardianRelationship"("childPersonId", "guardianPersonId");

-- Indexes for PersonEmergencyContact
CREATE INDEX "PersonEmergencyContact_tenantId_idx" ON "PersonEmergencyContact"("tenantId");
CREATE INDEX "PersonEmergencyContact_personId_idx" ON "PersonEmergencyContact"("personId");
CREATE INDEX "PersonEmergencyContact_personId_priority_idx" ON "PersonEmergencyContact"("personId", "priority");

-- Foreign keys for GuardianRelationship
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_childPersonId_fkey"
    FOREIGN KEY ("childPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_guardianPersonId_fkey"
    FOREIGN KEY ("guardianPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for PersonEmergencyContact
ALTER TABLE "PersonEmergencyContact" ADD CONSTRAINT "PersonEmergencyContact_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonEmergencyContact" ADD CONSTRAINT "PersonEmergencyContact_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
