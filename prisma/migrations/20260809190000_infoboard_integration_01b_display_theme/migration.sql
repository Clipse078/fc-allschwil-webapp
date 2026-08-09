-- INFOBOARD-INTEGRATION-01B — Infoboard display theme preference
-- Additive only: no drops, no renames, no column modifications.
--
-- Presentation-only setting: which visual theme ("DARK" | "LIGHT") the
-- public Infoboard displays use. Nullable, no DB-level default or enum —
-- intentional, mirrors the Tenant Branding v1 columns above. Application
-- code (resolveInfoboardDisplayTheme in
-- lib/publishing/infoboard/display-theme.ts) treats null as "DARK" (the
-- existing premium stadium default) and validates the two allowed values
-- at the API layer.
--
-- Never read by planning/resolution code — Betriebsplan resolution,
-- Weekplanner effective state, and resource allocation are unaffected.

ALTER TABLE "Tenant" ADD COLUMN "infoboardDisplayTheme" TEXT;
