-- CLUB-LOGO-CONTRAST-01A — Canonical club-level logo contrast metadata.
--
-- Additive only: creates LogoContrastMode enum and adds a NOT NULL column with
-- default NORMAL to ExternalClub. Existing rows receive NORMAL automatically.

-- CreateEnum
CREATE TYPE "LogoContrastMode" AS ENUM ('NORMAL', 'INVERT_ON_DARK');

-- AlterTable
ALTER TABLE "ExternalClub" ADD COLUMN "logoContrastMode" "LogoContrastMode" NOT NULL DEFAULT 'NORMAL';
