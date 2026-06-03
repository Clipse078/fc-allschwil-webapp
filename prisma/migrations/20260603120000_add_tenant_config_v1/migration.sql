-- Tenant Config v1 — Slice 10.2
-- Additive only: no drops, no renames, no column modifications.
--
-- String fields (countryCode, sportCategory, locale, timezone, currency):
--   nullable, no DB-level default — intentional for white-label safety.
--   Opinionated defaults (CH / FOOTBALL / de-CH / etc.) belong in seed and
--   application logic, not in the schema. New tenants start with NULL and are
--   configured explicitly by a platform admin.
--
-- Season integer fields (seasonStartMonth, seasonTransitionDay, seasonTransitionMonth):
--   NOT NULL DEFAULT — August 1st (8/1/8) is a neutral structural default for
--   European club sports and safe for all existing rows.

ALTER TABLE "Tenant" ADD COLUMN "countryCode"           TEXT;
ALTER TABLE "Tenant" ADD COLUMN "sportCategory"         TEXT;
ALTER TABLE "Tenant" ADD COLUMN "locale"                TEXT;
ALTER TABLE "Tenant" ADD COLUMN "timezone"              TEXT;
ALTER TABLE "Tenant" ADD COLUMN "currency"              TEXT;
ALTER TABLE "Tenant" ADD COLUMN "seasonStartMonth"      INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "Tenant" ADD COLUMN "seasonTransitionDay"   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Tenant" ADD COLUMN "seasonTransitionMonth" INTEGER NOT NULL DEFAULT 8;
