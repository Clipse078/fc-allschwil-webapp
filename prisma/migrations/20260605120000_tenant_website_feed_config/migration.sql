-- Website Feed Contract v1 — Slice 1
-- Additive only: no destructive changes, no data loss, zero-downtime safe.
--
-- Adds three optional website-feed gate fields to the Tenant table:
--   websiteDomain    – custom public domain for Host-header tenant resolution
--   websiteEnabled   – master switch for /api/public/v1/website/* endpoints
--   approvedDataOnly – when true: only review-approved content is exposed
--
-- All three columns are new; existing rows receive the safe defaults:
--   websiteDomain    NULL   (opt-in; no domain = domain resolution disabled)
--   websiteEnabled   FALSE  (opt-in; existing tenants stay dark until configured)
--   approvedDataOnly TRUE   (safe default: only approved content goes public)

-- AddColumn
ALTER TABLE "Tenant" ADD COLUMN "websiteDomain" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "websiteEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "approvedDataOnly" BOOLEAN NOT NULL DEFAULT true;

-- CreateUniqueIndex (one domain → one tenant, prevents misconfiguration)
CREATE UNIQUE INDEX "Tenant_websiteDomain_key" ON "Tenant"("websiteDomain");
