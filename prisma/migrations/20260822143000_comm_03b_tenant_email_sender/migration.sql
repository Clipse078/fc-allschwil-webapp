-- COMM-03B: tenant-owned visible email sender identity.
-- Existing tenants remain unconfigured and continue using the platform sender.
ALTER TABLE "Tenant"
  ADD COLUMN "emailSenderDisplayName" TEXT,
  ADD COLUMN "emailSenderAddress" TEXT;
