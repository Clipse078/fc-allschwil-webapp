-- =============================================================================
-- prisma/recovery/stage_tenant_reconciliation.sql
-- =============================================================================
-- Purpose  : Idempotent, fully guarded reconciliation of the Tenant schema on
--            STAGE.  Brings the Tenant table, its enum type, all config/branding
--            columns, and all required indexes to the state expected by the three
--            Tenant-owning Prisma migrations:
--
--              20260601083400_add_tenant_foundation
--              20260603120000_add_tenant_config_v1
--              20260603140000_add_tenant_branding_v1
--
-- Strategy : Option C — Manual SQL establishes schema parity, then the operator
--            calls `prisma migrate resolve --applied` for those three migrations
--            and lets `prisma migrate deploy` handle all remaining pending
--            migrations.  See STAGE_RECOVERY_RUNBOOK.md for the full sequence.
--
-- Safety   : Fully guarded.  Every structural change is wrapped in an
--            IF (NOT) EXISTS check.  All steps run inside one BEGIN/COMMIT
--            block; any unrecoverable inconsistency (duplicate keys, null keys
--            that cannot be resolved) raises an EXCEPTION and rolls the entire
--            script back automatically.
--
-- Hard rules observed:
--   - Does NOT touch _prisma_migrations.
--   - Does NOT drop legacy Tenant columns slug or isActive.
--   - Does NOT delete tenant rows or any production data.
--   - Does NOT rewrite any existing migration file.
--
-- Execution:
--   psql $DATABASE_URL -f prisma/recovery/stage_tenant_reconciliation.sql
--
-- CAUTION  : Run against STAGE only.  Do NOT run against Production.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1 — TenantStatus enum
-- CREATE only when the type does not yet exist.  Preserves any pre-existing
-- enum definition; does NOT add or remove values from an existing type.
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_type      t
    JOIN   pg_namespace n ON n.oid = t.typnamespace
    WHERE  t.typname  = 'TenantStatus'
    AND    n.nspname  = 'public'
  ) THEN
    CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
    RAISE NOTICE 'STEP 1: Created TenantStatus enum.';
  ELSE
    RAISE NOTICE 'STEP 1: TenantStatus enum already present – skipping.';
  END IF;
END $$;

-- =============================================================================
-- STEP 2 — Tenant base table
-- Creates the minimal shell (id, name, timestamps) when the table is absent.
-- key and status are intentionally omitted here; they are added as nullable
-- columns in steps 3 and 8 so the backfill + harden pattern works identically
-- for both the fresh-table case and the pre-existing-table case.
-- updatedAt carries DEFAULT CURRENT_TIMESTAMP as a recovery safety net only;
-- the Prisma runtime always supplies this value in normal operation.
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.tables
    WHERE  table_schema = 'public'
    AND    table_name   = 'Tenant'
  ) THEN
    CREATE TABLE "Tenant" (
      "id"        TEXT         NOT NULL,
      "name"      TEXT         NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
    );
    RAISE NOTICE 'STEP 2: Created Tenant base table.';
  ELSE
    RAISE NOTICE 'STEP 2: Tenant table already present – reconciling columns.';
  END IF;
END $$;

-- =============================================================================
-- STEP 3 — Add Tenant.key (nullable — backfill precedes the NOT NULL harden)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'Tenant'
    AND    column_name  = 'key'
  ) THEN
    ALTER TABLE "Tenant" ADD COLUMN "key" TEXT;
    RAISE NOTICE 'STEP 3: Added Tenant.key column (nullable for backfill).';
  ELSE
    RAISE NOTICE 'STEP 3: Tenant.key already present – skipping ADD COLUMN.';
  END IF;
END $$;

-- =============================================================================
-- STEP 4 — Backfill Tenant.key
-- Prefers the legacy slug value when that column exists; falls back to id for
-- any row whose slug is itself NULL, or when slug is not present at all.
-- Dynamic SQL is required to avoid a parse-time error when slug is absent.
-- =============================================================================
DO $$
DECLARE
  has_slug BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'Tenant'
    AND    column_name  = 'slug'
  ) INTO has_slug;

  IF has_slug THEN
    EXECUTE $dyn$
      UPDATE "Tenant"
      SET    "key" = "slug"
      WHERE  "key" IS NULL
      AND    "slug" IS NOT NULL
    $dyn$;
    EXECUTE $dyn$
      UPDATE "Tenant"
      SET    "key" = "id"
      WHERE  "key" IS NULL
    $dyn$;
    RAISE NOTICE 'STEP 4: Backfilled Tenant.key from slug (id fallback for null slugs).';
  ELSE
    UPDATE "Tenant"
    SET    "key" = "id"
    WHERE  "key" IS NULL;
    RAISE NOTICE 'STEP 4: Backfilled Tenant.key from id (no slug column present).';
  END IF;
END $$;

-- =============================================================================
-- STEP 5 — Duplicate / null key safety gate
-- Raises EXCEPTION (rolls back the entire transaction) when constraints cannot
-- be safely enforced.  Fix data manually and re-run the script.
-- =============================================================================
DO $$
DECLARE
  v_null_count INTEGER;
  v_dup_count  INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO   v_null_count
  FROM   "Tenant"
  WHERE  "key" IS NULL;

  SELECT COUNT(*)
  INTO   v_dup_count
  FROM (
    SELECT "key"
    FROM   "Tenant"
    GROUP  BY "key"
    HAVING COUNT(*) > 1
  ) sub;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION
      'STEP 5 ABORT: % Tenant row(s) still have NULL key after backfill. '
      'Inspect and repair manually before re-running.', v_null_count;
  END IF;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION
      'STEP 5 ABORT: % duplicate Tenant.key value(s) found. '
      'Deduplicate manually before re-running.', v_dup_count;
  END IF;

  RAISE NOTICE 'STEP 5: Tenant.key — no nulls, no duplicates. Safe to harden.';
END $$;

-- =============================================================================
-- STEP 6 — Unique index Tenant_key_key (matches migration 20260601083400)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'Tenant'
    AND    indexname  = 'Tenant_key_key'
  ) THEN
    CREATE UNIQUE INDEX "Tenant_key_key" ON "Tenant"("key");
    RAISE NOTICE 'STEP 6: Created unique index Tenant_key_key.';
  ELSE
    RAISE NOTICE 'STEP 6: Tenant_key_key already present – skipping.';
  END IF;
END $$;

-- =============================================================================
-- STEP 7 — Harden Tenant.key NOT NULL
-- =============================================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'Tenant'
    AND    column_name  = 'key'
    AND    is_nullable  = 'YES'
  ) THEN
    ALTER TABLE "Tenant" ALTER COLUMN "key" SET NOT NULL;
    RAISE NOTICE 'STEP 7: Tenant.key hardened to NOT NULL.';
  ELSE
    RAISE NOTICE 'STEP 7: Tenant.key is already NOT NULL – skipping.';
  END IF;
END $$;

-- =============================================================================
-- STEP 8 — Add Tenant.status (nullable — backfill precedes the NOT NULL harden)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'Tenant'
    AND    column_name  = 'status'
  ) THEN
    ALTER TABLE "Tenant" ADD COLUMN "status" "TenantStatus";
    RAISE NOTICE 'STEP 8: Added Tenant.status column (nullable for backfill).';
  ELSE
    RAISE NOTICE 'STEP 8: Tenant.status already present – skipping ADD COLUMN.';
  END IF;
END $$;

-- =============================================================================
-- STEP 9 — Backfill Tenant.status
-- Derives ACTIVE/INACTIVE from the legacy isActive boolean when that column
-- exists; defaults all remaining null rows to ACTIVE otherwise.
-- Dynamic SQL avoids a parse-time error when isActive is absent.
-- =============================================================================
DO $$
DECLARE
  has_is_active BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'Tenant'
    AND    column_name  = 'isActive'
  ) INTO has_is_active;

  IF has_is_active THEN
    EXECUTE $dyn$
      UPDATE "Tenant"
      SET    "status" = CASE
               WHEN "isActive" = true THEN 'ACTIVE'::"TenantStatus"
               ELSE                        'INACTIVE'::"TenantStatus"
             END
      WHERE  "status" IS NULL
    $dyn$;
    RAISE NOTICE 'STEP 9: Backfilled Tenant.status from isActive.';
  ELSE
    UPDATE "Tenant"
    SET    "status" = 'ACTIVE'::"TenantStatus"
    WHERE  "status" IS NULL;
    RAISE NOTICE 'STEP 9: Backfilled Tenant.status to ACTIVE (no isActive column present).';
  END IF;
END $$;

-- =============================================================================
-- STEP 10 — Harden Tenant.status NOT NULL DEFAULT 'ACTIVE'
-- =============================================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'Tenant'
    AND    column_name  = 'status'
    AND    is_nullable  = 'YES'
  ) THEN
    ALTER TABLE "Tenant" ALTER COLUMN "status" SET NOT NULL;
    ALTER TABLE "Tenant" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
    RAISE NOTICE 'STEP 10: Tenant.status hardened to NOT NULL DEFAULT ACTIVE.';
  ELSE
    RAISE NOTICE 'STEP 10: Tenant.status is already NOT NULL – skipping.';
  END IF;
END $$;

-- =============================================================================
-- STEP 11 — Tenant_status_idx (matches migration 20260601083400)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'Tenant'
    AND    indexname  = 'Tenant_status_idx'
  ) THEN
    CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
    RAISE NOTICE 'STEP 11: Created Tenant_status_idx.';
  ELSE
    RAISE NOTICE 'STEP 11: Tenant_status_idx already present – skipping.';
  END IF;
END $$;

-- =============================================================================
-- STEP 12 — Tenant_name_idx (matches migration 20260601083400)
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'Tenant'
    AND    indexname  = 'Tenant_name_idx'
  ) THEN
    CREATE INDEX "Tenant_name_idx" ON "Tenant"("name");
    RAISE NOTICE 'STEP 12: Created Tenant_name_idx.';
  ELSE
    RAISE NOTICE 'STEP 12: Tenant_name_idx already present – skipping.';
  END IF;
END $$;

-- =============================================================================
-- STEP 13 — Tenant config columns  (migration 20260603120000_add_tenant_config_v1)
-- String fields are nullable with no DB default (white-label safety).
-- Integer season fields carry NOT NULL DEFAULT matching the migration.
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "countryCode"           TEXT;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sportCategory"         TEXT;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "locale"                TEXT;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "timezone"              TEXT;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currency"              TEXT;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seasonStartMonth"      INTEGER NOT NULL DEFAULT 8;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seasonTransitionDay"   INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seasonTransitionMonth" INTEGER NOT NULL DEFAULT 8;
  RAISE NOTICE 'STEP 13: Tenant config columns ensured present.';
END $$;

-- =============================================================================
-- STEP 14 — Tenant branding columns  (migration 20260603140000_add_tenant_branding_v1)
-- All nullable TEXT; no DB-level constraint (validated at the API layer).
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoUrl"        TEXT;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "primaryColor"   TEXT;
  ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
  RAISE NOTICE 'STEP 14: Tenant branding columns ensured present.';
END $$;

-- =============================================================================
-- STEP 15 — Final verification
-- Raises EXCEPTION and rolls back the entire transaction when any required
-- target column is still missing after all the steps above.
-- =============================================================================
DO $$
DECLARE
  required_cols TEXT[] := ARRAY[
    'id', 'key', 'name', 'status',
    'countryCode', 'sportCategory', 'locale', 'timezone', 'currency',
    'seasonStartMonth', 'seasonTransitionDay', 'seasonTransitionMonth',
    'logoUrl', 'primaryColor', 'secondaryColor',
    'createdAt', 'updatedAt'
  ];
  col          TEXT;
  missing_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH col IN ARRAY required_cols LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM   information_schema.columns
      WHERE  table_schema = 'public'
      AND    table_name   = 'Tenant'
      AND    column_name  = col
    ) THEN
      missing_cols := array_append(missing_cols, col);
    END IF;
  END LOOP;

  IF array_length(missing_cols, 1) IS NOT NULL
     AND array_length(missing_cols, 1) > 0
  THEN
    RAISE EXCEPTION
      'STEP 15 VERIFICATION FAILED: Tenant table is still missing required '
      'column(s): %. Transaction rolled back. Investigate before re-running.',
      missing_cols;
  END IF;

  RAISE NOTICE 'STEP 15: Verification PASSED — all 17 required Tenant columns present.';
END $$;

COMMIT;

-- =============================================================================
-- Post-transaction confirmation query (run separately after COMMIT succeeds):
--
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM   information_schema.columns
--   WHERE  table_schema = 'public' AND table_name = 'Tenant'
--   ORDER  BY ordinal_position;
--
-- Expected: 17 rows covering id, key, name, status, countryCode, sportCategory,
--           locale, timezone, currency, seasonStartMonth, seasonTransitionDay,
--           seasonTransitionMonth, logoUrl, primaryColor, secondaryColor,
--           createdAt, updatedAt.
-- =============================================================================
