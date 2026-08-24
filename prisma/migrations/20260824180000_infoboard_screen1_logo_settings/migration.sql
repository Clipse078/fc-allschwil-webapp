-- INFOBOARD-SCREEN1-URGENT-07C: Screen 1 Match/Tournament logo presentation controls
-- Migration artifact only — NOT applied to STAGE.

ALTER TABLE "Infoboard" ADD COLUMN "screen1MatchShowLogos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Infoboard" ADD COLUMN "screen1MatchLogoSize" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Infoboard" ADD COLUMN "screen1TournamentShowLogos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Infoboard" ADD COLUMN "screen1TournamentLogoSize" TEXT NOT NULL DEFAULT 'MEDIUM';
