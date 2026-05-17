-- Non-destructive: extend Tenant with branding + feature-flag fields.
-- All columns are nullable so existing rows are unaffected.

ALTER TABLE "Tenant" ADD COLUMN "shortName"      TEXT;
ALTER TABLE "Tenant" ADD COLUMN "secondaryColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "featuresJson"   JSONB;
