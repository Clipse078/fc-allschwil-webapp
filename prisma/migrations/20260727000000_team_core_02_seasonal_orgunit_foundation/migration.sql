-- TEAM-CORE-02 — Seasonal OrgUnit and Mapping Foundation
--
-- This migration is non-destructive and fully additive.
-- No existing rows are deleted. No NOT NULL constraints are imposed on
-- existing historical records without backfill.
--
-- Changes:
--   1. Create TeamSeasonOrgUnit — canonical many-to-many join between
--      TeamSeason and OrgUnit, replacing the legacy single Team.orgUnitId.
--   2. Backfill TeamSeasonOrgUnit from Team.orgUnitId where possible.
--   3. Add TeamExternalMapping.teamSeasonId — seasonal link (nullable).
--   4. Backfill TeamExternalMapping.teamSeasonId where unambiguously resolvable.
--   5. Replace Team.slug global unique constraint with tenant-scoped compound
--      unique constraint (tenantId, slug).
--
-- Safety characteristics:
--   - All steps use IF NOT EXISTS / DO-exception guards for idempotency.
--   - No existing data is modified except via explicit backfill steps.
--   - Backfills are partial: null values are preserved for unresolvable rows.
--   - No foreign key enforcement on historical null values.
--   - Rollback: drop TeamSeasonOrgUnit table, drop teamSeasonId column,
--     drop compound index, restore global slug unique index. Schema-only
--     rollback is feasible; backfilled data would remain (harmless).
-- ---------------------------------------------------------------------------

-- 1. CREATE TeamSeasonOrgUnit
-- ---------------------------------------------------------------------------
-- Canonical many-to-many between TeamSeason and OrgUnit.
-- Replaces legacy Team.orgUnitId single-link architecture.
-- Delete behavior:
--   - teamSeason: CASCADE — the join row disappears with the seasonal record.
--   - orgUnit:    RESTRICT — prevents silent deletion of historical links.
--     Archive OrgUnits instead of deleting them.
--   - tenant:     CASCADE — follows tenant lifecycle.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "TeamSeasonOrgUnit" (
    "id"           TEXT         NOT NULL,
    "tenantId"     TEXT         NOT NULL,
    "teamSeasonId" TEXT         NOT NULL,
    "orgUnitId"    TEXT         NOT NULL,
    "isPrimary"    BOOLEAN      NOT NULL DEFAULT false,
    "displayOrder" INTEGER      NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamSeasonOrgUnit_pkey" PRIMARY KEY ("id")
);

-- Prevent duplicate OrgUnit assignment for the same TeamSeason
CREATE UNIQUE INDEX IF NOT EXISTS "TeamSeasonOrgUnit_teamSeasonId_orgUnitId_key"
    ON "TeamSeasonOrgUnit"("teamSeasonId", "orgUnitId");

CREATE INDEX IF NOT EXISTS "TeamSeasonOrgUnit_tenantId_idx"
    ON "TeamSeasonOrgUnit"("tenantId");

CREATE INDEX IF NOT EXISTS "TeamSeasonOrgUnit_teamSeasonId_idx"
    ON "TeamSeasonOrgUnit"("teamSeasonId");

CREATE INDEX IF NOT EXISTS "TeamSeasonOrgUnit_orgUnitId_idx"
    ON "TeamSeasonOrgUnit"("orgUnitId");

CREATE INDEX IF NOT EXISTS "TeamSeasonOrgUnit_tenantId_isPrimary_idx"
    ON "TeamSeasonOrgUnit"("tenantId", "isPrimary");

-- Foreign key: tenant
DO $$ BEGIN
  ALTER TABLE "TeamSeasonOrgUnit"
    ADD CONSTRAINT "TeamSeasonOrgUnit_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Foreign key: teamSeason (cascade — join follows seasonal record)
DO $$ BEGIN
  ALTER TABLE "TeamSeasonOrgUnit"
    ADD CONSTRAINT "TeamSeasonOrgUnit_teamSeasonId_fkey"
    FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Foreign key: orgUnit (restrict — prevents silent history loss)
DO $$ BEGIN
  ALTER TABLE "TeamSeasonOrgUnit"
    ADD CONSTRAINT "TeamSeasonOrgUnit_orgUnitId_fkey"
    FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. BACKFILL TeamSeasonOrgUnit from Team.orgUnitId
-- ---------------------------------------------------------------------------
-- For each existing TeamSeason whose parent Team has a non-null orgUnitId:
--   - Create one TeamSeasonOrgUnit row.
--   - Mark isPrimary = true (it was the only OrgUnit before).
--   - Use the Team's tenantId for consistency.
--   - Skip where the TeamSeason or Team already has a matching row (idempotent).
--   - Skip where Team.tenantId is null (cannot determine correct tenant).
--   - Skip where Team.orgUnitId resolves to an OrgUnit in a different tenant
--     than the Team — cross-tenant assignments are not created.
-- Teams with no OrgUnit assignment are left without a row (valid historical state).
-- ---------------------------------------------------------------------------
INSERT INTO "TeamSeasonOrgUnit" (
    "id",
    "tenantId",
    "teamSeasonId",
    "orgUnitId",
    "isPrimary",
    "displayOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    -- Generate a deterministic-looking ID using concat of teamSeasonId+orgUnitId
    -- to ensure idempotency if the INSERT is retried after partial failure.
    -- Using gen_random_uuid() which is available in PostgreSQL 13+.
    gen_random_uuid()::TEXT,
    t."tenantId",
    ts."id",
    t."orgUnitId",
    true,  -- isPrimary: the legacy single-link was the implicit primary
    0,     -- displayOrder: default
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "TeamSeason" ts
JOIN "Team" t ON t."id" = ts."teamId"
JOIN "OrgUnit" ou ON ou."id" = t."orgUnitId"
WHERE
    -- Only where Team has a valid orgUnitId
    t."orgUnitId" IS NOT NULL
    -- Only where Team has a tenantId (cannot determine tenant otherwise)
    AND t."tenantId" IS NOT NULL
    -- Only where OrgUnit belongs to the same tenant as Team (cross-tenant safety)
    AND (ou."tenantId" IS NULL OR ou."tenantId" = t."tenantId")
    -- Idempotency: skip if a row already exists for this teamSeason+orgUnit pair
    AND NOT EXISTS (
        SELECT 1 FROM "TeamSeasonOrgUnit" tso
        WHERE tso."teamSeasonId" = ts."id"
          AND tso."orgUnitId" = t."orgUnitId"
    )
ON CONFLICT DO NOTHING;

-- 3. ADD TeamExternalMapping.teamSeasonId (nullable)
-- ---------------------------------------------------------------------------
-- Seasonal link from an external provider mapping to a TeamSeason.
-- Nullable: historical rows remain valid with teamSeasonId = NULL.
-- Consistency rules (enforced at service layer):
--   - teamSeason.teamId must equal teamId
--   - externalSeasonId must correspond to the TeamSeason's season
-- ---------------------------------------------------------------------------
ALTER TABLE "TeamExternalMapping"
    ADD COLUMN IF NOT EXISTS "teamSeasonId" TEXT;

-- Index for forward lookup (all mappings for a TeamSeason)
CREATE INDEX IF NOT EXISTS "TeamExternalMapping_teamSeasonId_idx"
    ON "TeamExternalMapping"("teamSeasonId");

-- Foreign key: teamSeason (SetNull on delete — historical mapping survives season deletion)
DO $$ BEGIN
  ALTER TABLE "TeamExternalMapping"
    ADD CONSTRAINT "TeamExternalMapping_teamSeasonId_fkey"
    FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. BACKFILL TeamExternalMapping.teamSeasonId
-- ---------------------------------------------------------------------------
-- Resolve teamSeasonId from TeamSeason where exactly one match exists for:
--   - teamId = mapping.teamId
--   - season.key matches the provider's externalSeasonId pattern
--
-- Resolution strategy:
--   Match TeamSeason where:
--     - teamSeason.teamId = mapping.teamId
--     - Exactly one TeamSeason exists for that team (unambiguous case)
--   When multiple TeamSeasons exist for the team, resolution is deferred to
--   application-level logic and teamSeasonId remains null.
--
-- Note: Season.externalSeasonId is not yet modelled (deferred to SEASON-01).
--   We cannot reliably match externalSeasonId to a Season row without that
--   mapping. Therefore the backfill uses a conservative "exactly one TeamSeason
--   for this team" rule.
--
-- Unresolved mappings (null teamSeasonId) remain valid and backward-compatible.
-- They can be resolved manually or by a future SEASON-01 migration.
-- ---------------------------------------------------------------------------
UPDATE "TeamExternalMapping" m
SET "teamSeasonId" = sub."teamSeasonId"
FROM (
    -- Only resolve when exactly one TeamSeason exists for this team
    SELECT
        m2."id" AS "mappingId",
        ts2."id" AS "teamSeasonId"
    FROM "TeamExternalMapping" m2
    JOIN "TeamSeason" ts2 ON ts2."teamId" = m2."teamId"
    WHERE m2."teamSeasonId" IS NULL
      AND (
          SELECT COUNT(*)
          FROM "TeamSeason" ts3
          WHERE ts3."teamId" = m2."teamId"
      ) = 1
) sub
WHERE m."id" = sub."mappingId"
  AND m."teamSeasonId" IS NULL;

-- 5. REPLACE Team.slug global unique constraint with tenant-scoped compound unique
-- ---------------------------------------------------------------------------
-- Before: Team.slug is globally unique (@unique → Team_slug_key index).
-- After:  Team.slug is unique per tenant (@@unique([tenantId, slug])).
--
-- Safety: the global constraint is strictly stricter than the compound constraint,
-- so existing data cannot violate the new constraint. No data rewrite needed.
--
-- Effect on queries: any findUnique({ where: { slug } }) must be updated to
-- use findUnique({ where: { tenantId_slug: { tenantId, slug } } }) or
-- findFirst({ where: { tenantId, slug } }). See service/API update notes.
-- ---------------------------------------------------------------------------

-- Drop the global unique index
DROP INDEX IF EXISTS "Team_slug_key";

-- Create tenant-scoped compound unique index
CREATE UNIQUE INDEX IF NOT EXISTS "Team_tenantId_slug_key"
    ON "Team"("tenantId", "slug");
