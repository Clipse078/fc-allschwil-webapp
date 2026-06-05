# STAGE Recovery Runbook

> Version: 2.0 — 2026-06-05
> Strategy: **Option C** — Manual SQL → prove schema parity → `prisma migrate resolve --applied` → `prisma migrate deploy`
> Scope: **STAGE environment only. Do NOT run against Production.**
> Supersedes: Runbook v1.0 (2026-06-02), which covered migrations 1–23 only.

---

## Why This PR Exists

STAGE is frozen at April 2026. It has 7 applied migrations (the April baseline) and **28 missing migrations** spanning 2026-05-18 through 2026-06-04. A large 174-file feature+recovery PR was accumulated but must **not** be merged as a single unit — it mixes DB recovery, UI, API, and application changes in ways that obscure the schema repair and make review unsafe.

This PR contains only two files:

| File | Purpose |
|------|---------|
| `prisma/recovery/stage_tenant_reconciliation.sql` | Idempotent SQL that establishes Tenant schema parity for the three Tenant-owning migrations |
| `STAGE_RECOVERY_RUNBOOK.md` (this file) | Exact execution sequence for the operator running the recovery |

No application code, no UI changes, no layout changes, no tenant runtime, no branding UI, no infoboard, no facilities UI, no API routes, and no migration file edits are included.

---

## Why Option C

| Option | Description | Why rejected / chosen |
|--------|-------------|----------------------|
| A | Raw `prisma migrate deploy` (attempt-and-handle-failures flow) | Risky: STAGE may already have a partially-different Tenant table from a previous manual intervention; letting Prisma attempt `add_tenant_foundation` against a table that partially exists would fail mid-migration and leave `_prisma_migrations` unresolved. |
| B | `prisma migrate reset` — full wipe and re-seed | Destructive: deletes all April-era test data (Users, Roles, Permissions, Seasons, Teams, Events, etc.). Acceptable only if STAGE is being intentionally reset to a known-clean baseline; that decision belongs to the team, not this recovery PR. |
| **C** | Manual SQL establishes Tenant parity → `resolve --applied` → `migrate deploy` | **Chosen.** The SQL script is fully guarded and idempotent. It can run against any STAGE state — whether the Tenant table does not exist at all, exists with legacy columns (`slug`, `isActive`), or exists in a partially-applied state — and bring it to the correct target schema. Once the three Tenant migrations are marked resolved, Prisma's migration engine takes over cleanly for the remaining 25 migrations, using the normal deploy path with the MANUAL interventions documented below. |

---

## Migration Map

### Resolved by the SQL script (do NOT let Prisma attempt these)

| # | Migration name | What it does |
|---|---------------|-------------|
| 20 | `20260601083400_add_tenant_foundation` | Creates `TenantStatus` enum, `Tenant` table, `Tenant_key_key` unique index, `Tenant_status_idx`, `Tenant_name_idx` |
| 24 | `20260603120000_add_tenant_config_v1` | Adds `countryCode`, `sportCategory`, `locale`, `timezone`, `currency`, `seasonStartMonth`, `seasonTransitionDay`, `seasonTransitionMonth` to `Tenant` |
| 25 | `20260603140000_add_tenant_branding_v1` | Adds `logoUrl`, `primaryColor`, `secondaryColor` to `Tenant` |

### Deployed by Prisma after resolution (25 migrations)

| # | Migration name | Execution mode |
|---|---------------|----------------|
| 8 | `20260518120000_add_targets_module` | **MANUAL-HYBRID** |
| 9 | `20260518130000_add_governance_foundation` | **MANUAL-HYBRID** |
| 10 | `20260518140000_add_cross_module_links` | Prisma |
| 11 | `20260518150000_add_meeting_model` | Prisma |
| 12 | `20260518160000_add_initiative_model` | Prisma |
| 13 | `20260518170000_add_visibility_scope` | Prisma |
| 14 | `20260518180000_add_target_visibility_scope` | Prisma |
| 15 | `20260518190000_add_meeting_initiative_permission_modules` | **MANUAL-ENUM-ONLY** |
| 16 | `20260518200000_add_meeting_sub_entities` | Prisma |
| 17 | `20260518210000_add_communication_template` | Prisma |
| 18 | `20260518220000_add_templates_permission_module` | **MANUAL-ENUM-ONLY** |
| 19 | `20260518230000_add_org_builder_foundation` | Prisma |
| 21 | `20260601093400_add_registration_inbox` | **MANUAL-HYBRID** |
| 22 | `20260601124700_add_org_membership_relations_tenant_backfill` | Prisma |
| 23 | `20260602000000_add_tenants_permission_module` | **MANUAL-ENUM-ONLY** |
| 26 | `20260603160000_add_org_permission_module` | **MANUAL-ENUM-ONLY** |
| 27 | `20260603180000_orgunit_tenant_scoped_key` | Prisma |
| 28 | `20260603200000_team_orgunit_bridge` | Prisma |
| 29 | `20260604063500_target_group_tenant_scoped_key` | Prisma |
| 30 | `20260604064000_user_tenant_fk` | Prisma |
| 31 | `20260604090000_registration_v2_assignment` | Prisma |
| 32 | `20260604100000_event_allocation_fields` | Prisma |
| 33 | `20260604110000_event_tenant_isolation` | Prisma |
| 34 | `20260604120000_facilities_and_resources` | **MANUAL-HYBRID** |
| 35 | `20260604130000_wochenplan_publication` | Prisma |

**MANUAL-HYBRID:** Migration contains `ALTER TYPE … ADD VALUE` (cannot run inside a transaction) alongside other DDL. Apply manually in two passes: first the `ALTER TYPE` outside any transaction block, then the remaining DDL, then mark resolved.

**MANUAL-ENUM-ONLY:** Migration contains only `ALTER TYPE … ADD VALUE`. Apply manually outside any transaction block, then mark resolved.

---

## Prerequisites

Before starting, confirm all of the following:

- [ ] `psql` and `npx` are available in your shell.
- [ ] `DATABASE_URL` is set and points to **STAGE** (not production).
  ```bash
  echo $DATABASE_URL   # must contain your Neon STAGE connection string
  ```
- [ ] The local repo is on the branch that includes this runbook and the SQL file.
  ```bash
  git status           # should show nothing unexpected
  ls prisma/recovery/stage_tenant_reconciliation.sql   # file must exist
  ```
- [ ] PostgreSQL version on STAGE is ≥ 13.
  ```bash
  psql $DATABASE_URL -c "SELECT version();"
  ```
- [ ] No long-running transactions are blocking schema changes.
  ```bash
  psql $DATABASE_URL -c "SELECT pid, state, query_start, left(query,60) FROM pg_stat_activity WHERE state != 'idle';"
  ```

---

## Phase 1 — Pre-Check Queries (read-only)

Run all queries in psql or Neon SQL Editor. These confirm the current STAGE state before any change is made.

### 1.1 — Current migration state

```bash
npx prisma migrate status
```

**Expected before recovery:** Exactly 7 migrations shown as Applied (the April baseline), all others as Pending.

If any May/June migration shows as Applied already, stop and reconcile with the team before proceeding — the script is still safe to run (it is idempotent), but the `resolve --applied` step must only mark migrations whose DDL has already been applied to the database.

### 1.2 — Does the Tenant table exist?

```sql
SELECT table_name, table_type
FROM   information_schema.tables
WHERE  table_schema = 'public'
AND    table_name   = 'Tenant';
```

Expected if STAGE is clean: **0 rows** (Tenant does not exist).
Expected if a previous partial recovery was attempted: **1 row**.
Either way the SQL script handles both states safely.

### 1.3 — If Tenant exists, inspect its current columns

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
AND    table_name   = 'Tenant'
ORDER  BY ordinal_position;
```

Record which columns are present. This tells you whether the script will be creating everything from scratch or reconciling a partial schema.

### 1.4 — Total data table count (baseline)

```sql
SELECT COUNT(*) AS data_tables
FROM   information_schema.tables
WHERE  table_schema = 'public'
AND    table_type   = 'BASE TABLE'
AND    table_name  != '_prisma_migrations';
```

Expected for a clean STAGE: **16**. Record this number; Phase 5 will verify the count has grown to **34** after full deployment.

---

## Phase 2 — Backup

**Do not skip this phase.** Prisma does not support rollback of applied migrations. The only recovery path after a catastrophic failure is restoration from this backup.

### 2.1 — Full database dump

```bash
pg_dump $DATABASE_URL > stage_backup_$(date +%Y%m%d_%H%M%S).sql
echo "Backup size: $(du -sh stage_backup_*.sql | tail -1)"
```

Confirm the file is non-zero and ends with the standard PostgreSQL dump footer (`-- PostgreSQL database dump complete`) before continuing.

---

## Phase 3 — Run the Tenant Reconciliation SQL

### 3.1 — Execute the script

```bash
psql $DATABASE_URL -f prisma/recovery/stage_tenant_reconciliation.sql
```

### 3.2 — Expected output

```
BEGIN
NOTICE:  STEP 1: Created TenantStatus enum.          -- OR: already present
NOTICE:  STEP 2: Created Tenant base table.           -- OR: already present
NOTICE:  STEP 3: Added Tenant.key column (nullable for backfill).
NOTICE:  STEP 4: Backfilled Tenant.key from id (no slug column present).
NOTICE:  STEP 5: Tenant.key — no nulls, no duplicates. Safe to harden.
NOTICE:  STEP 6: Created unique index Tenant_key_key.
NOTICE:  STEP 7: Tenant.key hardened to NOT NULL.
NOTICE:  STEP 8: Added Tenant.status column (nullable for backfill).
NOTICE:  STEP 9: Backfilled Tenant.status to ACTIVE (no isActive column present).
NOTICE:  STEP 10: Tenant.status hardened to NOT NULL DEFAULT ACTIVE.
NOTICE:  STEP 11: Created Tenant_status_idx.
NOTICE:  STEP 12: Created Tenant_name_idx.
NOTICE:  STEP 13: Tenant config columns ensured present.
NOTICE:  STEP 14: Tenant branding columns ensured present.
NOTICE:  STEP 15: Verification PASSED — all 17 required Tenant columns present.
COMMIT
```

If the Tenant table already existed with legacy columns, steps 1–10 will print "already present" / "skipping" notices instead of creation notices. The key line is **STEP 15: Verification PASSED** — that confirms the target schema is in place.

### 3.3 — If the script fails

Any `RAISE EXCEPTION` causes the entire transaction to roll back automatically. The database is unchanged. Read the error message:

- **"% rows still have NULL key"** — some Tenant rows could not be backfilled. Examine those rows (`SELECT id, slug FROM "Tenant" WHERE key IS NULL`) and fix the data manually, then re-run.
- **"% duplicate key values"** — deduplicate the conflicting `key` values manually, then re-run.
- **"STEP 15 VERIFICATION FAILED"** — a column is still missing after all steps completed; examine the listed column names and investigate why the ADD COLUMN did not execute.

### 3.4 — Post-SQL verification

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
AND    table_name   = 'Tenant'
ORDER  BY ordinal_position;
```

**Expected: 17 rows** — `id`, `name`, `createdAt`, `updatedAt`, `key`, `status`, `countryCode`, `sportCategory`, `locale`, `timezone`, `currency`, `seasonStartMonth`, `seasonTransitionDay`, `seasonTransitionMonth`, `logoUrl`, `primaryColor`, `secondaryColor`.

```sql
SELECT indexname, indexdef
FROM   pg_indexes
WHERE  schemaname = 'public'
AND    tablename  = 'Tenant'
ORDER  BY indexname;
```

**Expected: 4 indexes** — `Tenant_key_key` (unique), `Tenant_name_idx`, `Tenant_pkey`, `Tenant_status_idx`.

```sql
SELECT enumlabel
FROM   pg_enum e
JOIN   pg_type t ON t.oid = e.enumtypid
WHERE  t.typname = 'TenantStatus'
ORDER  BY enumsortorder;
```

**Expected: 3 values** — `ACTIVE`, `INACTIVE`, `ARCHIVED`.

---

## Phase 4 — Mark Tenant Migrations Resolved

Tell Prisma that the three Tenant migrations are complete. Run each command and confirm the expected output.

```bash
npx prisma migrate resolve --applied 20260601083400_add_tenant_foundation
```
Expected: `Migration 20260601083400_add_tenant_foundation marked as applied.`

```bash
npx prisma migrate resolve --applied 20260603120000_add_tenant_config_v1
```
Expected: `Migration 20260603120000_add_tenant_config_v1 marked as applied.`

```bash
npx prisma migrate resolve --applied 20260603140000_add_tenant_branding_v1
```
Expected: `Migration 20260603140000_add_tenant_branding_v1 marked as applied.`

### 4.1 — Confirm resolution

```bash
npx prisma migrate status
```

**Expected:** 10 migrations shown as Applied (7 April + 3 just resolved). 25 pending.

---

## Phase 5 — Deploy Remaining Migrations

### How this section is organised

The 25 remaining migrations are deployed via 8 Prisma `deploy` attempts separated by manual ALTER TYPE interventions. Each attempt either completes cleanly or fails at the next `ALTER TYPE … ADD VALUE` barrier, at which point a manual step resolves it and the cycle repeats.

Set DATABASE_URL once for the session if not already set:
```bash
export DATABASE_URL="<your-neon-stage-connection-string>"
```

---

### Attempt 1 — will fail on migration 8

```bash
npx prisma migrate deploy
```

**Expected failure:** `20260518120000_add_targets_module` fails on `ALTER TYPE "PermissionModule" ADD VALUE 'TARGETS'` inside a transaction. Nothing applied.

---

### Manual Step M1 — migration 8: `20260518120000_add_targets_module` (MANUAL-HYBRID)

**Purpose:** Adds `TARGETS` to `PermissionModule` enum; creates `TargetCategory`, `TargetStatus`, `TargetPeriod`, `TargetMetricType`, `TargetDirection` enums; creates `Target`, `TargetMetric`, `TargetDataPoint` tables.

#### M1a — Apply enum value (outside transaction)
```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TARGETS';"
```

#### M1b — Apply remaining DDL
```bash
psql $DATABASE_URL << 'SQL'
CREATE TYPE "TargetCategory" AS ENUM ('SPORTLICHE_ENTWICKLUNG','MITGLIEDERWACHSTUM','FINANZEN','AUSBILDUNG','MEDIEN_SOZIALES','GOVERNANCE');
CREATE TYPE "TargetStatus" AS ENUM ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED');
CREATE TYPE "TargetPeriod" AS ENUM ('SEASON','QUARTER','YEAR','CUSTOM');
CREATE TYPE "TargetMetricType" AS ENUM ('PERCENTAGE','NUMERIC','CURRENCY','BOOLEAN');
CREATE TYPE "TargetDirection" AS ENUM ('INCREASE','DECREASE','MAINTAIN');
CREATE TABLE "Target" ("id" TEXT NOT NULL,"title" TEXT NOT NULL,"description" TEXT,"category" "TargetCategory" NOT NULL DEFAULT 'SPORTLICHE_ENTWICKLUNG',"status" "TargetStatus" NOT NULL DEFAULT 'ACTIVE',"period" "TargetPeriod" NOT NULL DEFAULT 'SEASON',"periodLabel" TEXT,"moduleKey" TEXT,"sportCategory" TEXT,"ageGroupHint" TEXT,"startsAt" TIMESTAMP(3),"endsAt" TIMESTAMP(3),"nudgeJson" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Target_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TargetMetric" ("id" TEXT NOT NULL,"targetId" TEXT NOT NULL,"label" TEXT NOT NULL,"type" "TargetMetricType" NOT NULL DEFAULT 'PERCENTAGE',"direction" "TargetDirection" NOT NULL DEFAULT 'INCREASE',"targetValue" DOUBLE PRECISION NOT NULL,"currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,"unit" TEXT,"notes" TEXT,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "TargetMetric_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TargetDataPoint" ("id" TEXT NOT NULL,"metricId" TEXT NOT NULL,"value" DOUBLE PRECISION NOT NULL,"note" TEXT,"measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "TargetDataPoint_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Target_category_idx" ON "Target"("category");
CREATE INDEX "Target_status_idx" ON "Target"("status");
CREATE INDEX "Target_period_idx" ON "Target"("period");
CREATE INDEX "TargetMetric_targetId_idx" ON "TargetMetric"("targetId");
CREATE INDEX "TargetMetric_targetId_sortOrder_idx" ON "TargetMetric"("targetId","sortOrder");
CREATE INDEX "TargetDataPoint_metricId_idx" ON "TargetDataPoint"("metricId");
CREATE INDEX "TargetDataPoint_measuredAt_idx" ON "TargetDataPoint"("measuredAt");
ALTER TABLE "TargetMetric" ADD CONSTRAINT "TargetMetric_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TargetDataPoint" ADD CONSTRAINT "TargetDataPoint_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "TargetMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
SQL
```

#### M1c — Mark resolved
```bash
npx prisma migrate resolve --applied 20260518120000_add_targets_module
```

---

### Attempt 2 — will fail on migration 9

```bash
npx prisma migrate deploy
```

**Expected failure:** `20260518130000_add_governance_foundation` fails on first `ALTER TYPE "WorkflowDomain" ADD VALUE`.

---

### Manual Step M2 — migration 9: `20260518130000_add_governance_foundation` (MANUAL-HYBRID)

**Purpose:** Adds `MEETINGS`, `INITIATIVES`, `TARGETS` to `WorkflowDomain` enum; adds governance columns to `Target`.

#### M2a — Apply enum values
```bash
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'TARGETS';"
```

#### M2b — Apply remaining DDL
```bash
psql $DATABASE_URL << 'SQL'
ALTER TABLE "Target" ADD COLUMN "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT', ADD COLUMN "requiresFourEyeReview" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "reviewedByUserId" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3);
CREATE INDEX "Target_reviewStage_idx" ON "Target"("reviewStage");
SQL
```

#### M2c — Mark resolved
```bash
npx prisma migrate resolve --applied 20260518130000_add_governance_foundation
```

---

### Attempt 3 — applies migrations 10–14, then fails on 15

```bash
npx prisma migrate deploy
```

**Expected:** Applies `add_cross_module_links`, `add_meeting_model`, `add_initiative_model`, `add_visibility_scope`, `add_target_visibility_scope` (5 migrations). Fails on `add_meeting_initiative_permission_modules`.

---

### Manual Step M3 — migration 15: `20260518190000_add_meeting_initiative_permission_modules` (MANUAL-ENUM-ONLY)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
npx prisma migrate resolve --applied 20260518190000_add_meeting_initiative_permission_modules
```

---

### Attempt 4 — applies migrations 16–17, then fails on 18

```bash
npx prisma migrate deploy
```

**Expected:** Applies `add_meeting_sub_entities`, `add_communication_template` (2 migrations). Fails on `add_templates_permission_module`.

---

### Manual Step M4 — migration 18: `20260518220000_add_templates_permission_module` (MANUAL-ENUM-ONLY)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TEMPLATES';"
npx prisma migrate resolve --applied 20260518220000_add_templates_permission_module
```

---

### Attempt 5 — applies migration 19, then fails on 21

```bash
npx prisma migrate deploy
```

**Expected:** Applies `add_org_builder_foundation` (1 migration — note migration 20 is already resolved, and migration 21 is MANUAL-HYBRID). Fails on `add_registration_inbox`.

---

### Manual Step M5 — migration 21: `20260601093400_add_registration_inbox` (MANUAL-HYBRID)

**Purpose:** Adds `REGISTRATIONS` to `PermissionModule`; creates `RegistrationType`, `RegistrationStatus` enums; creates `Registration` table with FK to `Tenant` and `User`.

**Prerequisite check:** Confirm the Tenant table exists before running (it was created by the SQL script in Phase 3):
```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'Tenant' AND table_schema = 'public';
```
Expected: `1`.

#### M5a — Apply enum value
```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'REGISTRATIONS';"
```

#### M5b — Apply remaining DDL
```bash
psql $DATABASE_URL << 'SQL'
BEGIN;
CREATE TYPE IF NOT EXISTS "RegistrationType" AS ENUM ('PROBETRAINING','SPIELERANMELDUNG','TRAINERANMELDUNG','SPONSORANFRAGE','KONTAKTANFRAGE','OTHER');
CREATE TYPE IF NOT EXISTS "RegistrationStatus" AS ENUM ('NEW','REVIEWING','CONTACTED','ACCEPTED','REJECTED','ARCHIVED');
CREATE TABLE IF NOT EXISTS "Registration" ("id" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"type" "RegistrationType" NOT NULL,"status" "RegistrationStatus" NOT NULL DEFAULT 'NEW',"firstName" TEXT NOT NULL,"lastName" TEXT NOT NULL,"email" TEXT NOT NULL,"phone" TEXT,"birthDate" TIMESTAMP(3),"birthYear" INTEGER,"message" TEXT,"payloadJson" JSONB,"source" TEXT,"assignedToUserId" TEXT,"submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Registration_pkey" PRIMARY KEY ("id"));
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Registration_tenantId_status_idx" ON "Registration"("tenantId","status");
CREATE INDEX IF NOT EXISTS "Registration_tenantId_type_idx" ON "Registration"("tenantId","type");
CREATE INDEX IF NOT EXISTS "Registration_tenantId_createdAt_idx" ON "Registration"("tenantId","createdAt");
CREATE INDEX IF NOT EXISTS "Registration_assignedToUserId_idx" ON "Registration"("assignedToUserId");
COMMIT;
SQL
```

#### M5c — Mark resolved
```bash
npx prisma migrate resolve --applied 20260601093400_add_registration_inbox
```

---

### Attempt 6 — applies migration 22, then fails on 23

```bash
npx prisma migrate deploy
```

**Expected:** Applies `add_org_membership_relations_tenant_backfill` (1 migration — all 4 UPDATE statements will report `UPDATE 0` on empty tables; that is correct). Fails on `add_tenants_permission_module`.

---

### Manual Step M6 — migration 23: `20260602000000_add_tenants_permission_module` (MANUAL-ENUM-ONLY)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TENANTS';"
npx prisma migrate resolve --applied 20260602000000_add_tenants_permission_module
```

---

### Attempt 7 — applies migrations 26–33 (skipping resolved 24–25), then fails on 26

> **Note:** Prisma processes migrations in chronological order. Migrations 24 and 25 are already marked resolved and will be skipped. Migration 26 (`add_org_permission_module`) is MANUAL-ENUM-ONLY and will cause a failure.

```bash
npx prisma migrate deploy
```

**Expected failure:** Fails on `20260603160000_add_org_permission_module`.

---

### Manual Step M7 — migration 26: `20260603160000_add_org_permission_module` (MANUAL-ENUM-ONLY)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'ORG';"
npx prisma migrate resolve --applied 20260603160000_add_org_permission_module
```

---

### Attempt 8 — applies migrations 27–33, then fails on 34

```bash
npx prisma migrate deploy
```

**Expected:** Applies `orgunit_tenant_scoped_key`, `team_orgunit_bridge`, `target_group_tenant_scoped_key`, `user_tenant_fk`, `registration_v2_assignment`, `event_allocation_fields`, `event_tenant_isolation` (7 migrations). Fails on `facilities_and_resources`.

---

### Manual Step M8 — migration 34: `20260604120000_facilities_and_resources` (MANUAL-HYBRID)

**Purpose:** Adds `FACILITIES` to `PermissionModule`; creates `FacilityType`, `FacilityResourceType`, `FacilityStatus` enums; creates `Facility` and `FacilityResource` tables.

#### M8a — Apply enum value
```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'FACILITIES';"
```

#### M8b — Apply remaining DDL
```bash
psql $DATABASE_URL << 'SQL'
CREATE TYPE "FacilityType" AS ENUM ('PITCH','DRESSING_ROOM_BLOCK','INDOOR_HALL','OTHER');
CREATE TYPE "FacilityResourceType" AS ENUM ('FULL_PITCH','HALF_PITCH','DRESSING_ROOM','OTHER');
CREATE TYPE "FacilityStatus" AS ENUM ('ACTIVE','INACTIVE','ARCHIVED');
CREATE TABLE "Facility" ("id" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"name" TEXT NOT NULL,"type" "FacilityType" NOT NULL DEFAULT 'OTHER',"status" "FacilityStatus" NOT NULL DEFAULT 'ACTIVE',"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Facility_pkey" PRIMARY KEY ("id"));
CREATE TABLE "FacilityResource" ("id" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"facilityId" TEXT NOT NULL,"name" TEXT NOT NULL,"code" TEXT NOT NULL,"type" "FacilityResourceType" NOT NULL DEFAULT 'OTHER',"status" "FacilityStatus" NOT NULL DEFAULT 'ACTIVE',"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "FacilityResource_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Facility_tenantId_idx" ON "Facility"("tenantId");
CREATE INDEX "Facility_tenantId_status_idx" ON "Facility"("tenantId","status");
CREATE INDEX "Facility_tenantId_sortOrder_idx" ON "Facility"("tenantId","sortOrder");
CREATE UNIQUE INDEX "FacilityResource_tenantId_code_key" ON "FacilityResource"("tenantId","code");
CREATE INDEX "FacilityResource_tenantId_idx" ON "FacilityResource"("tenantId");
CREATE INDEX "FacilityResource_facilityId_idx" ON "FacilityResource"("facilityId");
CREATE INDEX "FacilityResource_tenantId_status_idx" ON "FacilityResource"("tenantId","status");
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityResource" ADD CONSTRAINT "FacilityResource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityResource" ADD CONSTRAINT "FacilityResource_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
SQL
```

#### M8c — Mark resolved
```bash
npx prisma migrate resolve --applied 20260604120000_facilities_and_resources
```

---

### Attempt 9 — final deploy (should complete cleanly)

```bash
npx prisma migrate deploy
```

**Expected:**
```
All migrations have been successfully applied.
```

If migration 35 (`add_wochenplan_publication`) is shown as applied, all 35 migrations are complete.

---

### Optional — Seed demo data

Once all 35 migrations are applied:

```bash
npx prisma db seed
```

The seed is fully idempotent. It skips entity types that already have data (e.g. existing Tenants if count > 0) and upserts everything else.

---

## Phase 6 — Post-Check Verification

Run all queries in psql or Neon SQL Editor.

### 6.1 — Migration count

```sql
SELECT COUNT(*) AS total_applied
FROM   _prisma_migrations
WHERE  finished_at   IS NOT NULL
AND    rolled_back_at IS NULL;
```

**Expected: `35`**

### 6.2 — Failed or pending migrations

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM   _prisma_migrations
WHERE  rolled_back_at IS NOT NULL
   OR  finished_at    IS NULL;
```

**Expected: 0 rows.**

### 6.3 — Confirm Tenant columns (all 17)

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
AND    table_name   = 'Tenant'
ORDER  BY ordinal_position;
```

**Expected: 17 rows** — `id`, `name`, `createdAt`, `updatedAt`, `key`, `status`, `countryCode`, `sportCategory`, `locale`, `timezone`, `currency`, `seasonStartMonth`, `seasonTransitionDay`, `seasonTransitionMonth`, `logoUrl`, `primaryColor`, `secondaryColor`.

Legacy columns `slug` and `isActive` may also appear if they were present on STAGE before the recovery; that is correct and expected.

### 6.4 — Total data table count

```sql
SELECT COUNT(*) AS data_tables
FROM   information_schema.tables
WHERE  table_schema = 'public'
AND    table_type   = 'BASE TABLE'
AND    table_name  != '_prisma_migrations';
```

**Expected: `34`**

### 6.5 — PermissionModule enum values

```sql
SELECT enumlabel
FROM   pg_enum e
JOIN   pg_type t ON t.oid = e.enumtypid
WHERE  t.typname = 'PermissionModule'
ORDER  BY enumsortorder;
```

**Expected: 19 values** — `USERS`, `SEASONS`, `TEAMS`, `PEOPLE`, `EVENTS`, `FIXTURES`, `WOCHENPLAN`, `NEWS`, `WEBSITE`, `INFOBOARD`, `FUNCTIONS`, `TARGETS`, `MEETINGS`, `INITIATIVES`, `TEMPLATES`, `REGISTRATIONS`, `TENANTS`, `ORG`, `FACILITIES`.

### 6.6 — prisma migrate status (final)

```bash
npx prisma migrate status
```

**Expected:** All 35 migrations shown as Applied. Zero pending.

### 6.7 — Tenant indexes

```sql
SELECT indexname, indexdef
FROM   pg_indexes
WHERE  schemaname = 'public'
AND    tablename  = 'Tenant'
ORDER  BY indexname;
```

**Expected: 4 indexes** — `Tenant_key_key` (unique), `Tenant_name_idx`, `Tenant_pkey`, `Tenant_status_idx`.

### 6.8 — FK constraint on Registration

```sql
SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table
FROM   information_schema.table_constraints      tc
JOIN   information_schema.key_column_usage       kcu ON tc.constraint_name = kcu.constraint_name
JOIN   information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE  tc.table_name    = 'Registration'
AND    tc.constraint_type = 'FOREIGN KEY';
```

**Expected: 2 rows** — `tenantId → Tenant.id` and `assignedToUserId → User.id`.

---

## Rollback / Abort Guidance

### If the SQL script fails (Phase 3)

The transaction is rolled back automatically. The database is unchanged. Read the EXCEPTION message, fix the root cause (duplicate keys, null keys, or missing column from a previous failed manual attempt), and re-run:

```bash
psql $DATABASE_URL -f prisma/recovery/stage_tenant_reconciliation.sql
```

### If a `prisma migrate deploy` attempt fails unexpectedly

```bash
npx prisma migrate status
```

Identify which migrations applied before the failure. Determine whether the partially applied state is safe to continue from or whether a full restore is needed.

### If a MANUAL-HYBRID DDL block partially applies

The ALTER TYPE outside-transaction step leaves the enum value added but the DDL block incomplete, with the migration NOT recorded in `_prisma_migrations`. You can safely re-run the DDL block — the `IF NOT EXISTS` guards on CREATE TABLE/INDEX make it re-runnable. If any table was partially created, PostgreSQL will error; use `DROP TABLE IF EXISTS "<Name>"` to clean it up before retrying the DDL block.

### Full restore from backup

If the migration state is unrecoverable:

```bash
psql $DATABASE_URL < stage_backup_<timestamp>.sql
```

After restore, confirm the table count returns to the Phase 1 baseline before retrying.

---

## Evidence Checklist for PR Review

Before approving this PR, verify each of the following:

- [ ] `git diff origin/STAGE...HEAD -- ':(exclude)STAGE_RECOVERY_RUNBOOK.md' ':(exclude)prisma/recovery/'` is **empty** — no application code, migrations, UI, or API files are included.
- [ ] `prisma/recovery/stage_tenant_reconciliation.sql` is present and non-empty.
- [ ] SQL file opens with `BEGIN;` and closes with `COMMIT;`.
- [ ] Every structural DDL step has a corresponding `IF (NOT) EXISTS` guard.
- [ ] Dynamic SQL (`EXECUTE`) is used for the `slug` and `isActive` reference in steps 4 and 9 (parse-time safety).
- [ ] STEP 5 raises `EXCEPTION` on null/duplicate keys — transaction cannot silently leave a broken `Tenant.key`.
- [ ] STEP 15 raises `EXCEPTION` if any of the 17 required Tenant columns is still missing.
- [ ] No `DROP COLUMN`, `ALTER COLUMN TYPE`, or `DELETE FROM` statements exist in the SQL file.
- [ ] `_prisma_migrations` is not referenced anywhere in the SQL file.
- [ ] The three `prisma migrate resolve --applied` commands in Phase 4 exactly match the three migration folder names in `prisma/migrations/`.
- [ ] The 8 MANUAL intervention steps (M1–M8) in Phase 5 are sequenced in chronological migration order and account for all `ALTER TYPE … ADD VALUE` barriers in migrations 8–35.
- [ ] This runbook supersedes `STAGE_RECOVERY_RUNBOOK.md` v1.0 (which only covered migrations 1–23).

---

## Execution Summary

```
Phase 1  Pre-check queries (read-only) — confirm baseline state
Phase 2  pg_dump backup
Phase 3  psql -f prisma/recovery/stage_tenant_reconciliation.sql
         → confirms STEP 15: Verification PASSED
Phase 4  prisma migrate resolve --applied  ×3  (Tenant migrations 20, 24, 25)
         → prisma migrate status shows 10 applied, 25 pending
Phase 5  9 deploy attempts interleaved with 8 manual ALTER TYPE interventions
         → final attempt returns "All migrations have been successfully applied."
         Optional: npx prisma db seed
Phase 6  Verification queries — expect 35 applied, 34 tables, 19 PermissionModule values
```
