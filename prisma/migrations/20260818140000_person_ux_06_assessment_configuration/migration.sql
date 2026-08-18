-- PERSON-UX-06: Assessment Configuration + Benchmarks
--
-- Additive migration only. No destructive changes.
-- Adds rating-mode and benchmark fields to DevelopmentCriterion,
-- and raw-input snapshot fields to DevelopmentAssessmentRating.
--
-- All new columns have safe defaults so existing rows remain valid:
--   ratingMode            → 'SCORE_0_100' (backward-compatible)
--   showTeamBenchmark     → false
--   showJahrgangBenchmark → false
--   ratingModeSnapshot    → NULL (treated as SCORE_0_100 by application)
--   rawValue              → NULL
--   rawLabelSnapshot      → NULL

-- ── DevelopmentCriterion additions ───────────────────────────────────────────

ALTER TABLE "DevelopmentCriterion"
  ADD COLUMN "ratingMode"            TEXT    NOT NULL DEFAULT 'SCORE_0_100',
  ADD COLUMN "qualitativeLabels"     JSONB,
  ADD COLUMN "showTeamBenchmark"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showJahrgangBenchmark" BOOLEAN NOT NULL DEFAULT false;

-- ── DevelopmentAssessmentRating additions ─────────────────────────────────────

ALTER TABLE "DevelopmentAssessmentRating"
  ADD COLUMN "ratingModeSnapshot" TEXT,
  ADD COLUMN "rawValue"           INTEGER,
  ADD COLUMN "rawLabelSnapshot"   TEXT;
