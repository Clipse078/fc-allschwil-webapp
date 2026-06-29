-- Design System — CMS V4
-- Adds a nullable JSON column for tenant-scoped design system configuration.
-- Null means "use platform defaults" — no data migration required.
-- Non-destructive: no existing rows are modified.

ALTER TABLE "Tenant" ADD COLUMN "websiteDesignSystem" JSONB;
