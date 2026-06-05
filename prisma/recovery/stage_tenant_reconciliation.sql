-- =============================================================================
-- STAGE Tenant Schema Recovery — Idempotent, Non-Destructive
-- =============================================================================
--
-- PURPOSE
--   Bring the STAGE "Tenant" table from the legacy 20260517 design to full
--   parity with the schema expected by the migration series
--   20260601083400_add_tenant_foundation → 20260604130000_wochenplan_publication.
--
-- LEGACY ASSUMPTIONS (20260517 design)
--   The STAGE Tenant table was created before the formal migration history and
--   differs from the migration-managed schema in (at minimum) these ways:
--
--   Legacy column   │ Migration-expected column / type
--   ────────────────┼──────────────────────────────────────────────────────
--   slug TEXT UNIQUE│ key TEXT UNIQUE (20260601083400)
--   isActive BOOLEAN│ status TenantStatus NOT NULL DEFAULT 'ACTIVE' (20260601083400)
--   (may exist)     │ countryCode, sportCategory, locale, timezone,
--                   │ currency, seasonStartMonth, seasonTransitionDay,
--                   │ seasonTransitionMonth (20260603120000)
--   (may exist)     │ logoUrl, primaryColor, secondaryColor (20260603140000)
--
-- MIGRATIONS WHOSE ASSUMPTIONS THIS SCRIPT SATISFIES
--   20260601083400_add_tenant_foundation      → TenantStatus enum + Tenant table
--   20260601124700_…_tenant_backfill          → Tenant.key referenced as 'fc-allschwil'
--   20260603120000_add_tenant_config_v1       → ADD COLUMN config fields
--   20260603140000_add_tenant_branding_v1     → ADD COLUMN branding fields
--   20260604064000_user_tenant_fk             → backfill via Tenant.key = 'fc-allschwil'
--
--   All other migrations from 20260601093400 onward do not depend on Tenant
--   column shape (they create new tables with FK to Tenant.id, which is stable).
--
-- WHAT THIS SCRIPT DOES NOT DO
--   - Does not drop any column (including the legacy slug / isActive columns)
--   - Does not delete any row
--   - Does not call any Prisma CLI command
--   - Does not touch _prisma_migrations
--
-- HOW TO RUN
--   psql "$DATABASE_URL" -f prisma/recovery/stage_tenant_reconciliation.sql
--
-- AFTER RUNNING
--   1. Verify zero schema drift:
--        npx prisma migrate diff \
--          --from-schema-datasource prisma/schema.prisma \
--          --to-schema-datamodel    prisma/schema.prisma
--      Expected output: "The schemas are identical."
--
--   2. If parity is confirmed, mark each pending migration as applied in order:
--        npx prisma migrate resolve --applied 20260601083400_add_tenant_foundation
--        npx prisma migrate resolve --applied 20260601093400_add_registration_inbox
--        npx prisma migrate resolve --applied 20260601124700_add_org_membership_relations_tenant_backfill
--        npx prisma migrate resolve --applied 20260602000000_add_tenants_permission_module
--        npx prisma migrate resolve --applied 20260603120000_add_tenant_config_v1
--        npx prisma migrate resolve --applied 20260603140000_add_tenant_branding_v1
--        npx prisma migrate resolve --applied 20260603160000_add_org_permission_module
--        npx prisma migrate resolve --applied 20260603180000_orgunit_tenant_scoped_key
--        npx prisma migrate resolve --applied 20260603200000_team_orgunit_bridge
--        npx prisma migrate resolve --applied 20260604063500_target_group_tenant_scoped_key
--        npx prisma migrate resolve --applied 20260604064000_user_tenant_fk
--        npx prisma migrate resolve --applied 20260604090000_registration_v2_assignment
--        npx prisma migrate resolve --applied 20260604100000_event_allocation_fields
--        npx prisma migrate resolve --applied 20260604110000_event_tenant_isolation
--        npx prisma migrate resolve --applied 20260604120000_facilities_and_resources
--        npx prisma migrate resolve --applied 20260604130000_wochenplan_publication
--
--      NOTE: Only resolve migrations whose DDL this script or prior STAGE state
--            already satisfies. Migrations that create tables/indexes not yet
--            present in STAGE (e.g. Registration, Facility, WochenplanPublication)
--            should be run via `prisma migrate deploy`, NOT resolved as applied,
--            unless you have confirmed STAGE already has those tables.
--            See EXECUTION NOTES at the bottom of this file.
--
-- IDEMPOTENCY
--   Safe to run multiple times. Every destructive operation is guarded by an
--   existence check. RAISE NOTICE lines report what was done vs. skipped.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- SANITY CHECK: confirm we are in the expected schema
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF current_schema() != 'public' THEN
        RAISE WARNING
            'current_schema() = %; expected ''public''. '
            'Verify search_path before proceeding.',
            current_schema();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name   = 'Tenant'
    ) THEN
        RAISE EXCEPTION
            'Tenant table not found in schema %. '
            'This script is for STAGE environments where Tenant already exists. '
            'Use the standard migration (20260601083400) instead.',
            current_schema();
    END IF;

    RAISE NOTICE 'Sanity checks passed. Tenant table exists in schema %.', current_schema();
END
$$;


-- ===========================================================================
-- BLOCK 1 — TenantStatus enum
-- ===========================================================================
-- 20260601083400 expects: CREATE TYPE "TenantStatus" AS ENUM (...)
-- On legacy STAGE this type was never created; create it only if absent.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'TenantStatus'
          AND n.nspname  = current_schema()
    ) THEN
        CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
        RAISE NOTICE 'BLOCK 1: Created TenantStatus enum.';
    ELSE
        RAISE NOTICE 'BLOCK 1: TenantStatus enum already exists — skipped.';
    END IF;
END
$$;


-- ===========================================================================
-- BLOCK 2 — Tenant.key column  (maps from legacy slug)
-- ===========================================================================
-- 20260601083400 expects: "key" TEXT NOT NULL UNIQUE
-- Legacy design had: "slug" TEXT NOT NULL UNIQUE
-- Strategy:
--   1. Add key as nullable TEXT (IF NOT EXISTS — safe if already added)
--   2. Backfill key from slug where slug exists and key is still NULL
--   3. Fallback: any row still NULL gets key = id (safe sentinel, guarantees
--      unique since id is the PK)
--   4. Verify no NULLs remain before hardening to NOT NULL
-- ---------------------------------------------------------------------------
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "key" TEXT;

DO $$
BEGIN
    -- Backfill from slug only when slug column is present
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name   = 'Tenant'
          AND column_name  = 'slug'
    ) THEN
        UPDATE "Tenant"
        SET    "key" = "slug"
        WHERE  "key" IS NULL
          AND  "slug" IS NOT NULL;

        RAISE NOTICE 'BLOCK 2: Backfilled Tenant.key from Tenant.slug.';
    ELSE
        RAISE NOTICE 'BLOCK 2: Tenant.slug column absent — slug→key backfill skipped.';
    END IF;

    -- Sentinel fallback: rows still missing key after slug backfill
    UPDATE "Tenant" SET "key" = "id" WHERE "key" IS NULL;

    -- Guard: refuse to harden if any row is still NULL (should be impossible
    -- after the fallback above, but be explicit)
    IF EXISTS (SELECT 1 FROM "Tenant" WHERE "key" IS NULL) THEN
        RAISE EXCEPTION
            'BLOCK 2 ABORTED: Tenant rows with NULL key remain after backfill. '
            'Inspect data manually before re-running.';
    END IF;

    RAISE NOTICE 'BLOCK 2: All Tenant.key values are non-null. Hardening to NOT NULL.';
END
$$;

ALTER TABLE "Tenant" ALTER COLUMN "key" SET NOT NULL;


-- ===========================================================================
-- BLOCK 3 — Unique index on Tenant.key
-- ===========================================================================
-- 20260601083400 expects: CREATE UNIQUE INDEX "Tenant_key_key" ON "Tenant"("key")
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename  = 'Tenant'
          AND indexname  = 'Tenant_key_key'
    ) THEN
        -- Validate no duplicate key values before creating the unique index
        IF EXISTS (
            SELECT "key" FROM "Tenant"
            GROUP BY "key" HAVING COUNT(*) > 1
        ) THEN
            RAISE EXCEPTION
                'BLOCK 3 ABORTED: Duplicate values exist in Tenant.key — '
                'cannot create unique index. Resolve duplicates manually.';
        END IF;

        CREATE UNIQUE INDEX "Tenant_key_key" ON "Tenant"("key");
        RAISE NOTICE 'BLOCK 3: Created Tenant_key_key unique index.';
    ELSE
        RAISE NOTICE 'BLOCK 3: Tenant_key_key unique index already exists — skipped.';
    END IF;
END
$$;


-- ===========================================================================
-- BLOCK 4 — Tenant.status column  (maps from legacy isActive boolean)
-- ===========================================================================
-- 20260601083400 expects: "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE'
-- Legacy design had: "isActive" BOOLEAN DEFAULT true
-- Strategy:
--   1. Add status as nullable TenantStatus (IF NOT EXISTS)
--   2. Backfill status from isActive where isActive column exists
--   3. Default any remaining NULLs to ACTIVE
--   4. Verify no NULLs remain, then set DEFAULT + NOT NULL
-- ---------------------------------------------------------------------------
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "status" "TenantStatus";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name   = 'Tenant'
          AND column_name  = 'isActive'
    ) THEN
        UPDATE "Tenant"
        SET    "status" = CASE
                   WHEN "isActive" = TRUE  THEN 'ACTIVE'::"TenantStatus"
                   WHEN "isActive" = FALSE THEN 'INACTIVE'::"TenantStatus"
                   ELSE                        'ACTIVE'::"TenantStatus"
               END
        WHERE  "status" IS NULL;

        RAISE NOTICE 'BLOCK 4: Backfilled Tenant.status from Tenant.isActive.';
    ELSE
        -- No isActive column; default all null rows to ACTIVE
        UPDATE "Tenant"
        SET    "status" = 'ACTIVE'::"TenantStatus"
        WHERE  "status" IS NULL;

        RAISE NOTICE 'BLOCK 4: Tenant.isActive absent — defaulted remaining NULLs to ACTIVE.';
    END IF;

    IF EXISTS (SELECT 1 FROM "Tenant" WHERE "status" IS NULL) THEN
        RAISE EXCEPTION
            'BLOCK 4 ABORTED: Tenant rows with NULL status remain after backfill. '
            'Inspect data manually before re-running.';
    END IF;

    RAISE NOTICE 'BLOCK 4: All Tenant.status values are non-null. Hardening to NOT NULL.';
END
$$;

-- Set default before NOT NULL so future inserts without explicit status succeed
ALTER TABLE "Tenant" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE "Tenant" ALTER COLUMN "status" SET NOT NULL;


-- ===========================================================================
-- BLOCK 5 — Support indexes on status and name
-- ===========================================================================
-- 20260601083400 expects:
--   CREATE INDEX "Tenant_status_idx" ON "Tenant"("status")
--   CREATE INDEX "Tenant_name_idx"   ON "Tenant"("name")
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename  = 'Tenant'
          AND indexname  = 'Tenant_status_idx'
    ) THEN
        CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
        RAISE NOTICE 'BLOCK 5: Created Tenant_status_idx.';
    ELSE
        RAISE NOTICE 'BLOCK 5: Tenant_status_idx already exists — skipped.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename  = 'Tenant'
          AND indexname  = 'Tenant_name_idx'
    ) THEN
        CREATE INDEX "Tenant_name_idx" ON "Tenant"("name");
        RAISE NOTICE 'BLOCK 5: Created Tenant_name_idx.';
    ELSE
        RAISE NOTICE 'BLOCK 5: Tenant_name_idx already exists — skipped.';
    END IF;
END
$$;


-- ===========================================================================
-- BLOCK 6 — Tenant Config v1 columns  (expected by 20260603120000)
-- ===========================================================================
-- The original migration uses plain ALTER TABLE ADD COLUMN without IF NOT
-- EXISTS. If STAGE already carries these columns from the legacy design, the
-- original migration would abort. This block adds them idempotently so that
-- 20260603120000 can be marked --applied without re-running its DDL.
--
-- Nullable string fields: no DB default (white-label safety — matches schema).
-- Integer fields: NOT NULL DEFAULT (August 1st convention — safe for all rows).
-- ---------------------------------------------------------------------------
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "countryCode"           TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sportCategory"         TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "locale"                TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "timezone"              TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currency"              TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seasonStartMonth"      INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seasonTransitionDay"   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seasonTransitionMonth" INTEGER NOT NULL DEFAULT 8;

RAISE NOTICE 'BLOCK 6: Tenant config v1 columns ensured (IF NOT EXISTS).';


-- ===========================================================================
-- BLOCK 7 — Tenant Branding v1 columns  (expected by 20260603140000)
-- ===========================================================================
-- Same pattern as Block 6: original migration has no IF NOT EXISTS guard.
-- ---------------------------------------------------------------------------
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoUrl"        TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "primaryColor"   TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;

RAISE NOTICE 'BLOCK 7: Tenant branding v1 columns ensured (IF NOT EXISTS).';


-- ===========================================================================
-- BLOCK 8 — Final verification snapshot
-- ===========================================================================
-- Emits a summary row for each expected column so the operator can confirm
-- all 16 required columns are present without querying separately.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    missing_cols TEXT := '';
    col TEXT;
    required TEXT[] := ARRAY[
        'id', 'key', 'name', 'status', 'createdAt', 'updatedAt',
        'countryCode', 'sportCategory', 'locale', 'timezone', 'currency',
        'seasonStartMonth', 'seasonTransitionDay', 'seasonTransitionMonth',
        'logoUrl', 'primaryColor', 'secondaryColor'
    ];
BEGIN
    FOREACH col IN ARRAY required LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name   = 'Tenant'
              AND column_name  = col
        ) THEN
            missing_cols := missing_cols || col || ' ';
        END IF;
    END LOOP;

    IF missing_cols != '' THEN
        RAISE EXCEPTION
            'BLOCK 8: Recovery incomplete — missing columns: [%]. '
            'Review script output above for errors.',
            trim(missing_cols);
    END IF;

    RAISE NOTICE
        'BLOCK 8: All 17 required Tenant columns are present. '
        'Recovery SQL completed successfully. '
        'Next step: run prisma migrate diff to confirm zero schema drift, '
        'then use prisma migrate resolve --applied for each migration listed '
        'in the header comment of this file.';
END
$$;

COMMIT;


-- =============================================================================
-- EXECUTION NOTES — which migrations to resolve vs. deploy after running this script
-- =============================================================================
--
-- After this script runs and parity is confirmed, classify each pending migration:
--
-- RESOLVE AS APPLIED (their DDL is now satisfied by this script or pre-existing state):
--   20260601083400_add_tenant_foundation          ← Tenant table + enum
--   20260603120000_add_tenant_config_v1           ← config columns
--   20260603140000_add_tenant_branding_v1         ← branding columns
--
-- DEPLOY NORMALLY via `prisma migrate deploy` (they create NEW objects not
-- present on STAGE, or their DDL is already idempotent):
--   20260601093400_add_registration_inbox         ← new Registration table
--   20260601124700_…_tenant_backfill              ← safe backfill + new indexes
--   20260602000000_add_tenants_permission_module  ← ADD VALUE IF NOT EXISTS
--   20260603160000_add_org_permission_module      ← ADD VALUE IF NOT EXISTS
--   20260603180000_orgunit_tenant_scoped_key      ← drops old index, creates scoped
--   20260603200000_team_orgunit_bridge            ← new column + FK
--   20260604063500_target_group_tenant_scoped_key ← drops old index, creates scoped
--   20260604064000_user_tenant_fk                 ← new User.tenantId column + backfill
--   20260604090000_registration_v2_assignment     ← new Registration.targetGroupId
--   20260604100000_event_allocation_fields        ← new Event allocation columns
--   20260604110000_event_tenant_isolation         ← new Event.tenantId column
--   20260604120000_facilities_and_resources       ← new Facility + FacilityResource tables
--   20260604130000_wochenplan_publication         ← new WochenplanPublication table
--
-- CAVEAT: if any of the "DEPLOY NORMALLY" migrations have already been partially
-- applied to STAGE manually (e.g. Registration or User.tenantId already exist),
-- their CREATE TABLE / ADD COLUMN statements will fail without IF NOT EXISTS.
-- In that case, resolve them as applied after manually confirming parity for
-- each one individually.
-- =============================================================================
