-- TEAM-PROVIDER-01-V — Uniqueness + validation hardening
--
-- Corrective migration identified during independent verification.
--
-- Issues fixed:
--   1. Missing partial unique index on (teamSeasonId, provider) WHERE teamSeasonId IS NOT NULL.
--      Without this, a race condition allows one TeamSeason to acquire two provider
--      mappings for the same provider. Service-layer checks alone are insufficient.
--
-- Architecture invariants:
--   - Partial unique index only applies when teamSeasonId IS NOT NULL.
--     NULL teamSeasonId means "provider record with no seasonal assignment" — this is
--     normal for SYNC-created rows and unlinked mappings. Multiple such rows are valid.
--   - The existing unique constraint on (tenantId, provider, externalTeamId, externalSeasonId)
--     already prevents duplicate external-team rows; this constraint closes the remaining gap.
--
-- Additive only: no destructive changes, no data loss, zero downtime safe.

-- 1. Partial unique index: one TeamSeason maps to at most one row per provider.
CREATE UNIQUE INDEX IF NOT EXISTS "TeamExternalMapping_teamSeasonId_provider_uq"
  ON "TeamExternalMapping"("teamSeasonId", "provider")
  WHERE "teamSeasonId" IS NOT NULL;
