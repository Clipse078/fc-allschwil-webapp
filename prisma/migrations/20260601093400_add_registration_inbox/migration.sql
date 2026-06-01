-- Registration Inbox MVP
-- Tenant-scoped registration records plus permission module support.

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM (
    'PROBETRAINING',
    'SPIELERANMELDUNG',
    'TRAINERANMELDUNG',
    'SPONSORANFRAGE',
    'KONTAKTANFRAGE',
    'OTHER'
);

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM (
    'NEW',
    'REVIEWING',
    'CONTACTED',
    'ACCEPTED',
    'REJECTED',
    'ARCHIVED'
);

-- AlterEnum
ALTER TYPE "PermissionModule" ADD VALUE 'REGISTRATIONS';

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "RegistrationType" NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'NEW',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthYear" INTEGER,
    "message" TEXT,
    "payloadJson" JSONB,
    "source" TEXT,
    "assignedToUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Registration"
    ADD CONSTRAINT "Registration_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration"
    ADD CONSTRAINT "Registration_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Registration_tenantId_status_idx" ON "Registration"("tenantId", "status");
CREATE INDEX "Registration_tenantId_type_idx" ON "Registration"("tenantId", "type");
CREATE INDEX "Registration_tenantId_createdAt_idx" ON "Registration"("tenantId", "createdAt");
CREATE INDEX "Registration_assignedToUserId_idx" ON "Registration"("assignedToUserId");
