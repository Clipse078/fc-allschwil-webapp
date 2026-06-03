-- Tenant Branding v1 — Slice 10.6
-- Additive only: no drops, no renames, no column modifications.
--
-- All branding fields are nullable, no DB-level default — intentional for
-- white-label safety. Application code falls back to SportClubEvo defaults
-- (PLATFORM_BRANDING in lib/tenant-runtime/branding.ts) when null.
--
-- primaryColor / secondaryColor: stored as a 6-digit hex string (#rrggbb).
-- Validated at the API layer; no DB constraint to keep the migration simple.

ALTER TABLE "Tenant" ADD COLUMN "logoUrl"        TEXT;
ALTER TABLE "Tenant" ADD COLUMN "primaryColor"   TEXT;
ALTER TABLE "Tenant" ADD COLUMN "secondaryColor" TEXT;
