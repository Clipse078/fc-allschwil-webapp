-- MATCH-RESOLUTION-01: Canonical Match Resolution columns
--
-- Adds resolved TeamSeason and Competition references to MatchExternalMapping.
-- These columns are populated by MatchResolutionService after each import cycle.
--
-- Architecture:
--   Provider Import → MatchExternalMapping → MatchResolutionService
--   → TeamExternalMapping → TeamSeason → canonical match ownership
--
-- Field ownership:
--   resolvedHomeTeamSeasonId — set by MatchResolutionService; null until resolution runs.
--   resolvedAwayTeamSeasonId — set by MatchResolutionService; null until resolution runs.
--   resolvedCompetitionId    — competition validation context; null when not yet synced.
--   resolutionStatus         — RESOLVED | PARTIALLY_RESOLVED | UNRESOLVED | INVALID_MAPPING | CONFLICT
--   resolvedAt               — timestamp of the last resolution run.
--
-- Additive only: no destructive changes, no data loss, zero downtime safe.
-- All new columns are nullable with no defaults to avoid migration table rewrites.

-- 1. Add resolved columns
ALTER TABLE "MatchExternalMapping"
  ADD COLUMN "resolvedHomeTeamSeasonId" TEXT,
  ADD COLUMN "resolvedAwayTeamSeasonId" TEXT,
  ADD COLUMN "resolvedCompetitionId" TEXT,
  ADD COLUMN "resolutionStatus" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- 2. FK: home TeamSeason
ALTER TABLE "MatchExternalMapping"
  ADD CONSTRAINT "MatchExternalMapping_resolvedHomeTeamSeasonId_fkey"
  FOREIGN KEY ("resolvedHomeTeamSeasonId")
  REFERENCES "TeamSeason"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. FK: away TeamSeason
ALTER TABLE "MatchExternalMapping"
  ADD CONSTRAINT "MatchExternalMapping_resolvedAwayTeamSeasonId_fkey"
  FOREIGN KEY ("resolvedAwayTeamSeasonId")
  REFERENCES "TeamSeason"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. FK: resolved Competition (validation context)
ALTER TABLE "MatchExternalMapping"
  ADD CONSTRAINT "MatchExternalMapping_resolvedCompetitionId_fkey"
  FOREIGN KEY ("resolvedCompetitionId")
  REFERENCES "Competition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Indexes for resolution status queries and FK lookups
CREATE INDEX "MatchExternalMapping_resolutionStatus_idx"
  ON "MatchExternalMapping"("resolutionStatus");

CREATE INDEX "MatchExternalMapping_resolvedHomeTeamSeasonId_idx"
  ON "MatchExternalMapping"("resolvedHomeTeamSeasonId");

CREATE INDEX "MatchExternalMapping_resolvedAwayTeamSeasonId_idx"
  ON "MatchExternalMapping"("resolvedAwayTeamSeasonId");
