-- Tenant Config v1 — Slice 10.2
-- Additive only: all new columns have NOT NULL DEFAULT so existing rows receive safe values.
-- No destructive changes. No renames. No drops.

ALTER TABLE "Tenant" ADD COLUMN "countryCode"           TEXT NOT NULL DEFAULT 'CH';
ALTER TABLE "Tenant" ADD COLUMN "sportCategory"         TEXT NOT NULL DEFAULT 'FOOTBALL';
ALTER TABLE "Tenant" ADD COLUMN "locale"                TEXT NOT NULL DEFAULT 'de-CH';
ALTER TABLE "Tenant" ADD COLUMN "timezone"              TEXT NOT NULL DEFAULT 'Europe/Zurich';
ALTER TABLE "Tenant" ADD COLUMN "currency"              TEXT NOT NULL DEFAULT 'CHF';
ALTER TABLE "Tenant" ADD COLUMN "seasonStartMonth"      INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "Tenant" ADD COLUMN "seasonTransitionDay"   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Tenant" ADD COLUMN "seasonTransitionMonth" INTEGER NOT NULL DEFAULT 8;
