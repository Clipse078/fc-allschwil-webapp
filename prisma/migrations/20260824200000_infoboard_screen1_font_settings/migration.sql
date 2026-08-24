-- INFOBOARD-SCREEN1-URGENT-07K: per-card Screen 1 font-size presets
-- Migration artifact only — NOT applied.

ALTER TABLE "Infoboard" ADD COLUMN "screen1TrainingFontSize" TEXT NOT NULL DEFAULT 'LARGE';
ALTER TABLE "Infoboard" ADD COLUMN "screen1MatchFontSize" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Infoboard" ADD COLUMN "screen1TournamentFontSize" TEXT NOT NULL DEFAULT 'LARGE';
