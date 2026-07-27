-- TEAM-PROVIDER-01 — Canonical Provider Team Mapping Foundation
--
-- Adds workflow metadata to TeamExternalMapping for the manual mapping
-- workflow and suggestion engine.
--
-- Changes:
--   1. TeamExternalMapping.mappingSource (TEXT, default 'SYNC') —
--      distinguishes provider-synced rows from administrator-created rows.
--   2. TeamExternalMapping.confidenceLevel (TEXT, nullable) —
--      suggestion-engine confidence at mapping creation time.
--      Values: 'HIGH' | 'MEDIUM' | 'LOW' | null
--   3. TeamExternalMapping.mappingCompetitionId (TEXT, nullable, FK) —
--      Competition used as context during manual mapping. Informational only.
--      Competition does NOT own the provider mapping.
--
-- Architecture invariants:
--   - Existing SYNC-created rows remain fully valid (mappingSource defaults to 'SYNC').
--   - Archived competitions are allowed as context references (historical traceability).
--   - FK on mappingCompetitionId uses SET NULL on competition deletion — avoids
--     breaking provider mappings when competition is deleted or archived.
--   - String columns (not enums) used for extensibility without future migrations.
--
-- Additive only: no destructive changes, no data loss, zero downtime safe.

-- 1. Add mappingSource column (default 'SYNC' for existing rows)
ALTER TABLE "TeamExternalMapping"
  ADD COLUMN IF NOT EXISTS "mappingSource" TEXT NOT NULL DEFAULT 'SYNC';

-- 2. Add confidenceLevel column (nullable)
ALTER TABLE "TeamExternalMapping"
  ADD COLUMN IF NOT EXISTS "confidenceLevel" TEXT;

-- 3. Add mappingCompetitionId FK column
ALTER TABLE "TeamExternalMapping"
  ADD COLUMN IF NOT EXISTS "mappingCompetitionId" TEXT;

-- 4. Add FK constraint for mappingCompetitionId → Competition
--    Uses DO block for idempotent re-run safety.
DO $$ BEGIN
  ALTER TABLE "TeamExternalMapping"
    ADD CONSTRAINT "TeamExternalMapping_mappingCompetitionId_fkey"
    FOREIGN KEY ("mappingCompetitionId")
    REFERENCES "Competition"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Indexes for new columns
CREATE INDEX IF NOT EXISTS "TeamExternalMapping_mappingSource_idx"
  ON "TeamExternalMapping"("mappingSource");

CREATE INDEX IF NOT EXISTS "TeamExternalMapping_mappingCompetitionId_idx"
  ON "TeamExternalMapping"("mappingCompetitionId");
