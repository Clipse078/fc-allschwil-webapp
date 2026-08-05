-- REGISTRATION-01F — Assignment & Person Creation Workflow
--
-- Additive only: no destructive changes, no data loss, zero downtime safe.
--
-- 1. RegistrationStatus: adds ASSIGNED + WAITING so the workflow status set
--    matches Goal 8 (New, In Review, Assigned, Contacted, Waiting,
--    Accepted, Rejected, Archived).
-- 2. Person: adds address / guardian / football fields + provenance
--    (createdFromRegistration, createdRegistrationId) used by the
--    "Create Person" workflow action (Goal 3). All nullable — existing
--    Person rows are unaffected.
-- 3. Registration: adds personId (Goal 2/3 link), duplicateIgnoredAt /
--    duplicateIgnoredById (Goal 7), contactedAt / archivedAt (Goal 6/8).

-- AlterEnum
-- PostgreSQL 12+ allows adding multiple enum values in one migration.
ALTER TYPE "RegistrationStatus" ADD VALUE 'ASSIGNED';
ALTER TYPE "RegistrationStatus" ADD VALUE 'WAITING';

-- AlterTable: Person — address / guardian / football + creation provenance
ALTER TABLE "Person" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "createdFromRegistration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdRegistrationId" TEXT,
ADD COLUMN     "footballJson" JSONB,
ADD COLUMN     "guardianEmail" TEXT,
ADD COLUMN     "guardianFirstName" TEXT,
ADD COLUMN     "guardianLastName" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "houseNumber" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "street" TEXT;

-- AlterTable: Registration — person link, duplicate-ignore, quick-action timestamps
ALTER TABLE "Registration" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "contactedAt" TIMESTAMP(3),
ADD COLUMN     "duplicateIgnoredAt" TIMESTAMP(3),
ADD COLUMN     "duplicateIgnoredById" TEXT,
ADD COLUMN     "personId" TEXT;

-- CreateIndex
CREATE INDEX "Person_createdRegistrationId_idx" ON "Person"("createdRegistrationId");

-- CreateIndex
CREATE INDEX "Registration_personId_idx" ON "Registration"("personId");

-- CreateIndex
CREATE INDEX "Registration_duplicateIgnoredById_idx" ON "Registration"("duplicateIgnoredById");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_duplicateIgnoredById_fkey" FOREIGN KEY ("duplicateIgnoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_createdRegistrationId_fkey" FOREIGN KEY ("createdRegistrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
