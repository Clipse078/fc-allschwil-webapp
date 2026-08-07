-- TEAM-IDENTITY-01 — Canonical Team naming architecture
--
-- Adds tenant-owned SHORT NAME and ALTERNATIVE NAME columns to Team.
-- Team.name remains the canonical LONG NAME (kept for backward
-- compatibility — not renamed to `longName`).
--
-- Changes:
--   1. Team.shortName (TEXT, nullable) — e.g. "B2".
--   2. Team.alternativeName (TEXT, nullable) — e.g. "Junioren B2".
--
-- Architecture invariants:
--   - Additive only: no destructive changes, no data loss, zero downtime safe.
--   - Both columns are nullable; existing Team rows are left untouched and
--     may remain NULL indefinitely. No guessed data migration is performed.
--   - Provider identity is unaffected: TeamExternalMapping.provider +
--     externalTeamId + externalSeasonId remains the sole identity key.
--   - Provider sync (lib/integrations/sfv/sync/*) never writes to these
--     columns — see team-mapper.ts field-ownership documentation.
--
-- No STAGE tenant data is mutated by this migration beyond the new nullable
-- columns being added (existing rows get shortName = NULL, alternativeName = NULL).

ALTER TABLE "Team"
  ADD COLUMN IF NOT EXISTS "shortName" TEXT,
  ADD COLUMN IF NOT EXISTS "alternativeName" TEXT;
