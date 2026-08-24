-- INFOBOARD-SCREEN1-URGENT-07E: Screen 1 Training logo presentation controls
-- Migration artifact only — NOT applied.

ALTER TABLE "Infoboard" ADD COLUMN "screen1TrainingShowLogos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Infoboard" ADD COLUMN "screen1TrainingLogoSize" TEXT NOT NULL DEFAULT 'MEDIUM';
