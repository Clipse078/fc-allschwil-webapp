-- Website Registration Integration — additive RegistrationType enum extensions
-- New values cover membership, volunteer, referee, camp, and event registrations
-- submitted through the public FC Allschwil website.
-- These additions are non-destructive: existing rows remain unchanged.

-- AlterEnum: add values to RegistrationType
ALTER TYPE "RegistrationType" ADD VALUE IF NOT EXISTS 'MITGLIEDSCHAFT';
ALTER TYPE "RegistrationType" ADD VALUE IF NOT EXISTS 'FREIWILLIGENMELDUNG';
ALTER TYPE "RegistrationType" ADD VALUE IF NOT EXISTS 'SCHIEDSRICHTERANMELDUNG';
ALTER TYPE "RegistrationType" ADD VALUE IF NOT EXISTS 'CAMP_ANMELDUNG';
ALTER TYPE "RegistrationType" ADD VALUE IF NOT EXISTS 'VERANSTALTUNGSANMELDUNG';

-- CreateIndex: index on source field for website-submission queries
CREATE INDEX IF NOT EXISTS "Registration_tenantId_source_idx" ON "Registration"("tenantId", "source");
