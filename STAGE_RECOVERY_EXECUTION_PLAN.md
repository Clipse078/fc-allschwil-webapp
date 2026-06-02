# STAGE Recovery Execution Plan

> Version: 2.0 — 2026-06-02  
> Supersedes: `STAGE_RECOVERY_RUNBOOK.md` v1.0  
> Scope: **STAGE environment only. Do NOT execute against Production.**  
> Author: Generated from confirmed STAGE_DRIFT_REPORT.md + complete migration SQL inventory  
> Type: In-place additive repair — applies 16 missing migrations; no existing data is destroyed.

---

## Situation Summary

STAGE is frozen at April 2026. The `_prisma_migrations` table contains exactly 7 records — all from the April deployment. Every table, enum, and column introduced since `2026-05-18` is absent. The migration history is clean (no failed or rolled-back entries). This plan applies all 16 missing migrations in strict chronological order.

**Starting state:** 16 data tables, 7 applied migrations, schema missing 15 tables and 9 enum values.  
**Target state:** 31 data tables, 23 applied migrations, schema identical to `schema.prisma`.

---

## Section 1 — Exact Migration Execution Order

The 16 pending migrations must be applied in the following strict order. No deviation is permitted.

| Seq | Migration directory | DDL summary | Execution mode |
|-----|--------------------|-----------------------------|----------------|
| 1 | `20260518120000_add_targets_module` | ALTER TYPE PermissionModule + 5 CREATE TYPE + Target / TargetMetric / TargetDataPoint tables | **MANUAL-HYBRID** |
| 2 | `20260518130000_add_governance_foundation` | ALTER TYPE WorkflowDomain ×3 + governance columns on Target | **MANUAL-HYBRID** |
| 3 | `20260518140000_add_cross_module_links` | ADD COLUMN linkedInitiativeRefs, linkedMeetingRefs (JSONB) on Target | Prisma deploy |
| 4 | `20260518150000_add_meeting_model` | CREATE TYPE MeetingStatus + Meeting table | Prisma deploy |
| 5 | `20260518160000_add_initiative_model` | CREATE TYPE InitiativeStatus + Initiative table | Prisma deploy |
| 6 | `20260518170000_add_visibility_scope` | CREATE TYPE VisibilityScope + visibility columns on Meeting, Initiative | Prisma deploy |
| 7 | `20260518180000_add_target_visibility_scope` | Visibility columns on Target | Prisma deploy |
| 8 | `20260518190000_add_meeting_initiative_permission_modules` | ALTER TYPE PermissionModule ADD VALUE MEETINGS, INITIATIVES | **MANUAL-ENUM-ONLY** |
| 9 | `20260518200000_add_meeting_sub_entities` | 4 CREATE TYPE + MeetingAgendaItem / MeetingDecision / MeetingAction / MeetingParticipant | Prisma deploy |
| 10 | `20260518210000_add_communication_template` | 2 CREATE TYPE + CommunicationTemplate table | Prisma deploy |
| 11 | `20260518220000_add_templates_permission_module` | ALTER TYPE PermissionModule ADD VALUE TEMPLATES | **MANUAL-ENUM-ONLY** |
| 12 | `20260518230000_add_org_builder_foundation` | 3 CREATE TYPE + OrgUnit / OrgUnitMembership / TargetGroup | Prisma deploy |
| 13 | `20260601083400_add_tenant_foundation` | CREATE TYPE TenantStatus + Tenant table | Prisma deploy |
| 14 | `20260601093400_add_registration_inbox` | ALTER TYPE PermissionModule + 2 CREATE TYPE + Registration table + FKs | **MANUAL-HYBRID** |
| 15 | `20260601124700_add_org_membership_relations_tenant_backfill` | 4 UPDATE (data backfill, no-op on empty tables) + CREATE INDEX + ADD FK ×2 | Prisma deploy |
| 16 | `20260602000000_add_tenants_permission_module` | ALTER TYPE PermissionModule ADD VALUE TENANTS | **MANUAL-ENUM-ONLY** |

**Execution mode definitions:**

- **Prisma deploy** — safe to apply via `prisma migrate deploy`; no `ALTER TYPE … ADD VALUE` present.
- **MANUAL-HYBRID** — file contains `ALTER TYPE … ADD VALUE` AND other DDL. Prisma wraps each migration in `BEGIN … COMMIT`. In PostgreSQL, `ALTER TYPE … ADD VALUE` cannot execute inside a transaction block; the entire transaction rolls back. Apply the `ALTER TYPE` statements first via `psql` (outside any transaction), apply the remaining DDL via `psql`, then mark the migration resolved with `prisma migrate resolve --applied`.
- **MANUAL-ENUM-ONLY** — file contains only `ALTER TYPE … ADD VALUE` statements. Apply via `psql`, then mark resolved. No other DDL to apply.

---

## Section 2 — Migrations Requiring Manual ALTER TYPE Handling

Six of the 16 pending migrations contain `ALTER TYPE … ADD VALUE` and require manual intervention.

| # | Migration | ALTER TYPE statements | Other DDL in same file |
|---|-----------|----------------------|------------------------|
| 1 | `20260518120000_add_targets_module` | `ALTER TYPE "PermissionModule" ADD VALUE 'TARGETS'` | Yes — 5 CREATE TYPE, 3 CREATE TABLE, indexes, FKs |
| 2 | `20260518130000_add_governance_foundation` | `ALTER TYPE "WorkflowDomain" ADD VALUE 'MEETINGS'`<br>`ALTER TYPE "WorkflowDomain" ADD VALUE 'INITIATIVES'`<br>`ALTER TYPE "WorkflowDomain" ADD VALUE 'TARGETS'` | Yes — ALTER TABLE ADD COLUMN ×4, CREATE INDEX |
| 8 | `20260518190000_add_meeting_initiative_permission_modules` | `ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'MEETINGS'`<br>`ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'INITIATIVES'` | None |
| 11 | `20260518220000_add_templates_permission_module` | `ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'TEMPLATES'` | None |
| 14 | `20260601093400_add_registration_inbox` | `ALTER TYPE "PermissionModule" ADD VALUE 'REGISTRATIONS'` | Yes — 2 CREATE TYPE, 1 CREATE TABLE, 2 ADD FK, 4 CREATE INDEX |
| 16 | `20260602000000_add_tenants_permission_module` | `ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'TENANTS'` | None |

**Why `IF NOT EXISTS` is safe here:** Migrations 8, 11, and 16 use the `IF NOT EXISTS` guard. If the enum value was already added by a previous attempt (e.g. a partial run), the statement silently succeeds rather than throwing a duplicate-value error. Migrations 1 and 14 in the original SQL do not include `IF NOT EXISTS`; the `psql` commands in Section 3 add the guard defensively.

---

## Section 3 — Exact psql Commands

Set the connection string once for the session before any step below:

```bash
export DATABASE_URL="<your-neon-stage-connection-string>"
```

Verify it is pointing at STAGE (not Production):

```bash
psql $DATABASE_URL -c "SELECT current_database(), inet_server_addr(), version();"
```

---

### 3.1 — Manual migration 1: `20260518120000_add_targets_module`

#### Step 3.1.1 — ALTER TYPE (outside transaction)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TARGETS';"
```

Expected output: `ALTER TYPE`

#### Step 3.1.2 — Remaining DDL (transaction-safe block)

```bash
psql $DATABASE_URL << 'SQL'
CREATE TYPE "TargetCategory" AS ENUM (
  'SPORTLICHE_ENTWICKLUNG', 'MITGLIEDERWACHSTUM', 'FINANZEN',
  'AUSBILDUNG', 'MEDIEN_SOZIALES', 'GOVERNANCE'
);
CREATE TYPE "TargetStatus"     AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TargetPeriod"     AS ENUM ('SEASON', 'QUARTER', 'YEAR', 'CUSTOM');
CREATE TYPE "TargetMetricType" AS ENUM ('PERCENTAGE', 'NUMERIC', 'CURRENCY', 'BOOLEAN');
CREATE TYPE "TargetDirection"  AS ENUM ('INCREASE', 'DECREASE', 'MAINTAIN');

CREATE TABLE "Target" (
    "id"           TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "category"     "TargetCategory" NOT NULL DEFAULT 'SPORTLICHE_ENTWICKLUNG',
    "status"       "TargetStatus"   NOT NULL DEFAULT 'ACTIVE',
    "period"       "TargetPeriod"   NOT NULL DEFAULT 'SEASON',
    "periodLabel"  TEXT,
    "moduleKey"    TEXT,
    "sportCategory" TEXT,
    "ageGroupHint" TEXT,
    "startsAt"     TIMESTAMP(3),
    "endsAt"       TIMESTAMP(3),
    "nudgeJson"    JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TargetMetric" (
    "id"           TEXT NOT NULL,
    "targetId"     TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "type"         "TargetMetricType" NOT NULL DEFAULT 'PERCENTAGE',
    "direction"    "TargetDirection"  NOT NULL DEFAULT 'INCREASE',
    "targetValue"  DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit"         TEXT,
    "notes"        TEXT,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TargetMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TargetDataPoint" (
    "id"         TEXT NOT NULL,
    "metricId"   TEXT NOT NULL,
    "value"      DOUBLE PRECISION NOT NULL,
    "note"       TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TargetDataPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Target_category_idx"              ON "Target"("category");
CREATE INDEX "Target_status_idx"                ON "Target"("status");
CREATE INDEX "Target_period_idx"                ON "Target"("period");
CREATE INDEX "TargetMetric_targetId_idx"         ON "TargetMetric"("targetId");
CREATE INDEX "TargetMetric_targetId_sortOrder_idx" ON "TargetMetric"("targetId", "sortOrder");
CREATE INDEX "TargetDataPoint_metricId_idx"     ON "TargetDataPoint"("metricId");
CREATE INDEX "TargetDataPoint_measuredAt_idx"   ON "TargetDataPoint"("measuredAt");

ALTER TABLE "TargetMetric"
    ADD CONSTRAINT "TargetMetric_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TargetDataPoint"
    ADD CONSTRAINT "TargetDataPoint_metricId_fkey"
    FOREIGN KEY ("metricId") REFERENCES "TargetMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
SQL
```

Expected output per statement: `CREATE TYPE` ×5, `CREATE TABLE` ×3, `CREATE INDEX` ×7, `ALTER TABLE` ×2.

---

### 3.2 — Manual migration 2: `20260518130000_add_governance_foundation`

#### Step 3.2.1 — ALTER TYPE statements (outside transaction; run as separate commands)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'TARGETS';"
```

Expected output: `ALTER TYPE` three times.

#### Step 3.2.2 — Remaining DDL

```bash
psql $DATABASE_URL << 'SQL'
ALTER TABLE "Target"
    ADD COLUMN "reviewStage"            "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "requiresFourEyeReview"  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "reviewedByUserId"       TEXT,
    ADD COLUMN "reviewedAt"             TIMESTAMP(3);

CREATE INDEX "Target_reviewStage_idx" ON "Target"("reviewStage");
SQL
```

Expected output: `ALTER TABLE`, `CREATE INDEX`.

---

### 3.3 — Manual migration 8: `20260518190000_add_meeting_initiative_permission_modules`

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
```

Expected output: `ALTER TYPE` twice.

---

### 3.4 — Manual migration 11: `20260518220000_add_templates_permission_module`

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TEMPLATES';"
```

Expected output: `ALTER TYPE`

---

### 3.5 — Manual migration 14: `20260601093400_add_registration_inbox`

#### Step 3.5.1 — ALTER TYPE (outside transaction)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'REGISTRATIONS';"
```

Expected output: `ALTER TYPE`

#### Step 3.5.2 — Remaining DDL

```bash
psql $DATABASE_URL << 'SQL'
CREATE TYPE "RegistrationType" AS ENUM (
    'PROBETRAINING', 'SPIELERANMELDUNG', 'TRAINERANMELDUNG',
    'SPONSORANFRAGE', 'KONTAKTANFRAGE', 'OTHER'
);

CREATE TYPE "RegistrationStatus" AS ENUM (
    'NEW', 'REVIEWING', 'CONTACTED', 'ACCEPTED', 'REJECTED', 'ARCHIVED'
);

CREATE TABLE "Registration" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "type"             "RegistrationType" NOT NULL,
    "status"           "RegistrationStatus" NOT NULL DEFAULT 'NEW',
    "firstName"        TEXT NOT NULL,
    "lastName"         TEXT NOT NULL,
    "email"            TEXT NOT NULL,
    "phone"            TEXT,
    "birthDate"        TIMESTAMP(3),
    "birthYear"        INTEGER,
    "message"          TEXT,
    "payloadJson"      JSONB,
    "source"           TEXT,
    "assignedToUserId" TEXT,
    "submittedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Registration"
    ADD CONSTRAINT "Registration_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Registration"
    ADD CONSTRAINT "Registration_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Registration_tenantId_status_idx"  ON "Registration"("tenantId", "status");
CREATE INDEX "Registration_tenantId_type_idx"    ON "Registration"("tenantId", "type");
CREATE INDEX "Registration_tenantId_createdAt_idx" ON "Registration"("tenantId", "createdAt");
CREATE INDEX "Registration_assignedToUserId_idx" ON "Registration"("assignedToUserId");
SQL
```

Expected output: `CREATE TYPE` ×2, `CREATE TABLE`, `ALTER TABLE` ×2, `CREATE INDEX` ×4.

---

### 3.6 — Manual migration 16: `20260602000000_add_tenants_permission_module`

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TENANTS';"
```

Expected output: `ALTER TYPE`

---

## Section 4 — Exact `prisma migrate resolve` Commands

Run each of these immediately after completing the corresponding psql steps above. Do NOT run them before the DDL steps for MANUAL-HYBRID migrations.

```bash
# After Section 3.1 + 3.1.2:
npx prisma migrate resolve --applied 20260518120000_add_targets_module

# After Section 3.2 + 3.2.2:
npx prisma migrate resolve --applied 20260518130000_add_governance_foundation

# After Section 3.3:
npx prisma migrate resolve --applied 20260518190000_add_meeting_initiative_permission_modules

# After Section 3.4:
npx prisma migrate resolve --applied 20260518220000_add_templates_permission_module

# After Section 3.5 + 3.5.2:
npx prisma migrate resolve --applied 20260601093400_add_registration_inbox

# After Section 3.6:
npx prisma migrate resolve --applied 20260602000000_add_tenants_permission_module
```

Each command should print:

```
Migration <name> marked as applied.
```

---

## Section 5 — Exact `prisma migrate deploy` Commands

There are 7 deploy invocations. The command is always the same:

```bash
npx prisma migrate deploy
```

The table below shows what each invocation does and when it is run.

| Invocation | When to run | Expected behaviour |
|---|---|---|
| **Deploy 1** | Before any manual steps — immediately after backup | Attempts migration 1. Fails with `ERROR: ALTER TYPE ... cannot run inside a transaction block`. Nothing applied. |
| **Deploy 2** | After `resolve` for migration 1 | Attempts migration 2. Fails on first `ALTER TYPE WorkflowDomain`. Nothing applied. |
| **Deploy 3** | After `resolve` for migration 2 | Applies migrations 3, 4, 5, 6, 7 cleanly. Fails on migration 8 (`alter type`). |
| **Deploy 4** | After `resolve` for migration 8 | Applies migrations 9, 10 cleanly. Fails on migration 11 (`alter type`). |
| **Deploy 5** | After `resolve` for migration 11 | Applies migrations 12, 13 cleanly. Fails on migration 14 (`alter type`). |
| **Deploy 6** | After `resolve` for migration 14 | Applies migration 15 cleanly. Fails on migration 16 (`alter type`). |
| **Deploy 7** | After `resolve` for migration 16 | Applies nothing (all migrations already applied or resolved). Reports: `All migrations have been successfully applied.` |

**Note on Deploy 3 expected output:**

```
Applying migration `20260518140000_add_cross_module_links`
Applying migration `20260518150000_add_meeting_model`
Applying migration `20260518160000_add_initiative_model`
Applying migration `20260518170000_add_visibility_scope`
Applying migration `20260518180000_add_target_visibility_scope`
Error: ... ALTER TYPE ... cannot run inside a transaction block
```

---

## Section 6 — Rollback and Backup Procedure

### 6.1 — Mandatory pre-execution backup

**Take this backup before running any command.** Prisma has no built-in rollback for applied migrations. The backup is the only recovery path if something goes wrong.

```bash
# Full logical dump — captures schema + data
pg_dump $DATABASE_URL > stage_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify the file is non-zero and ends with the PostgreSQL dump footer
wc -l stage_backup_*.sql
tail -5 stage_backup_*.sql
```

A valid dump ends with lines like:

```
-- PostgreSQL database dump complete
```

Do not proceed if the dump is empty or truncated.

### 6.2 — Restoring from backup

```bash
# Restore into a fresh database or the existing STAGE database after clearing it
psql $DATABASE_URL < stage_backup_<timestamp>.sql
```

After restore, confirm the table count returns to the pre-recovery baseline:

```bash
psql $DATABASE_URL -c "
  SELECT COUNT(*) AS data_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name != '_prisma_migrations';
"
```

Expected after restore to pre-recovery state: `16`

### 6.3 — Failure decision tree

```
A step fails →
  ├─ STOP. Do not retry blindly.
  ├─ Run: npx prisma migrate status
  │   → Note which migrations are Applied vs Pending vs Failed.
  ├─ If the failure was in a psql DDL block:
  │   ├─ Check whether the object was partially created:
  │   │     psql $DATABASE_URL -c "\dt"
  │   │     psql $DATABASE_URL -c "\dT"
  │   ├─ If a table was partially created, drop it:
  │   │     psql $DATABASE_URL -c "DROP TABLE IF EXISTS \"<TableName>\";"
  │   └─ Re-run the failed psql block from step 3.x
  ├─ If the failure was in prisma migrate deploy (unexpected):
  │   ├─ Check the error message for the failing migration name.
  │   ├─ If it is one of the 6 known ALTER TYPE migrations → apply the manual workaround.
  │   └─ If it is a different migration → investigate; do not resolve blindly.
  └─ If state is unrecoverable or unclear:
      └─ Restore from backup: psql $DATABASE_URL < stage_backup_<timestamp>.sql
```

### 6.4 — Handling a partial MANUAL-HYBRID migration

If the `ALTER TYPE` step succeeded but the DDL block (step 3.x.2) failed partway:

1. The enum value is already present in PostgreSQL — it cannot be rolled back.
2. The migration is NOT yet recorded in `_prisma_migrations`.
3. Drop any partially created objects:

```bash
# For migration 1 (20260518120000) partial failure example:
psql $DATABASE_URL -c "DROP TABLE IF EXISTS \"TargetDataPoint\";"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS \"TargetMetric\";"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS \"Target\";"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS \"TargetDirection\";"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS \"TargetMetricType\";"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS \"TargetPeriod\";"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS \"TargetStatus\";"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS \"TargetCategory\";"
# Note: the 'TARGETS' enum value added to PermissionModule cannot be removed in PostgreSQL.
# It is inert without the associated tables and causes no harm.
```

4. Re-run the full DDL block from step 3.x.2.
5. Run `prisma migrate resolve --applied <migration_name>`.

### 6.5 — Emergency rollback of all sprint tables (last resort — data loss)

Only use this if restoration from backup is not viable and you need to return STAGE to the April baseline manually. This destroys all data in the sprint tables.

```sql
-- Dependent tables first (FK order)
DROP TABLE IF EXISTS "Registration";
DROP TABLE IF EXISTS "MeetingParticipant";
DROP TABLE IF EXISTS "MeetingAction";
DROP TABLE IF EXISTS "MeetingDecision";
DROP TABLE IF EXISTS "MeetingAgendaItem";
DROP TABLE IF EXISTS "OrgUnitMembership";
DROP TABLE IF EXISTS "OrgUnit";
DROP TABLE IF EXISTS "TargetGroup";
DROP TABLE IF EXISTS "Tenant";
DROP TABLE IF EXISTS "CommunicationTemplate";
DROP TABLE IF EXISTS "Initiative";
DROP TABLE IF EXISTS "Meeting";
DROP TABLE IF EXISTS "TargetDataPoint";
DROP TABLE IF EXISTS "TargetMetric";
DROP TABLE IF EXISTS "Target";

-- Enum types
DROP TYPE IF EXISTS "RegistrationStatus";
DROP TYPE IF EXISTS "RegistrationType";
DROP TYPE IF EXISTS "TenantStatus";
DROP TYPE IF EXISTS "OrgUnitMembershipStatus";
DROP TYPE IF EXISTS "OrgUnitStatus";
DROP TYPE IF EXISTS "OrgUnitType";
DROP TYPE IF EXISTS "CommunicationTemplateStatus";
DROP TYPE IF EXISTS "CommunicationTemplateCategory";
DROP TYPE IF EXISTS "MeetingParticipantStatus";
DROP TYPE IF EXISTS "MeetingActionStatus";
DROP TYPE IF EXISTS "MeetingDecisionStatus";
DROP TYPE IF EXISTS "MeetingAgendaItemStatus";
DROP TYPE IF EXISTS "VisibilityScope";
DROP TYPE IF EXISTS "InitiativeStatus";
DROP TYPE IF EXISTS "MeetingStatus";
DROP TYPE IF EXISTS "TargetDirection";
DROP TYPE IF EXISTS "TargetMetricType";
DROP TYPE IF EXISTS "TargetPeriod";
DROP TYPE IF EXISTS "TargetStatus";
DROP TYPE IF EXISTS "TargetCategory";

-- Delete sprint migration records from history
DELETE FROM _prisma_migrations
WHERE migration_name >= '20260518120000';
```

After running the above, remove STAGE Prisma history entries and confirm table count = 16 before considering the rollback complete.

> **Note:** `ALTER TYPE … ADD VALUE` values cannot be removed from PostgreSQL enums (`TARGETS`, `MEETINGS`, `INITIATIVES`, `TEMPLATES`, `REGISTRATIONS`, `TENANTS` in `PermissionModule`; `MEETINGS`, `INITIATIVES`, `TARGETS` in `WorkflowDomain`). These are inert once the associated tables are dropped.

---

## Section 7 — Verification Steps After Each Migration Group

Run the verification queries in `psql` or the Neon SQL Editor. Stop if any check fails; do not proceed to the next segment.

### 7.1 — Pre-execution baseline (before Deploy 1)

```bash
# 1. Confirm 7 applied migrations
psql $DATABASE_URL -c "
  SELECT COUNT(*) AS applied
  FROM _prisma_migrations
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
"
# Expected: 7

# 2. Confirm 16 data tables
psql $DATABASE_URL -c "
  SELECT COUNT(*) AS data_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name != '_prisma_migrations';
"
# Expected: 16

# 3. Confirm Target table does NOT yet exist
psql $DATABASE_URL -c "
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Target'
  ) AS target_exists;
"
# Expected: false
```

---

### 7.2 — After Step 3.1 + 3.1.2 + resolve (migration 1 complete)

```bash
# Confirm Target, TargetMetric, TargetDataPoint tables exist
psql $DATABASE_URL -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('Target', 'TargetMetric', 'TargetDataPoint')
  ORDER BY table_name;
"
# Expected: 3 rows

# Confirm TARGETS is in PermissionModule
psql $DATABASE_URL -c "
  SELECT enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'PermissionModule' AND enumlabel = 'TARGETS';
"
# Expected: 1 row

# Confirm migration 1 is recorded as applied
psql $DATABASE_URL -c "
  SELECT migration_name, finished_at
  FROM _prisma_migrations
  WHERE migration_name = '20260518120000_add_targets_module';
"
# Expected: 1 row with non-null finished_at
```

---

### 7.3 — After Step 3.2 + 3.2.2 + resolve (migration 2 complete)

```bash
# Confirm governance columns on Target
psql $DATABASE_URL -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Target'
    AND column_name IN ('reviewStage', 'requiresFourEyeReview', 'reviewedByUserId', 'reviewedAt')
  ORDER BY column_name;
"
# Expected: 4 rows

# Confirm WorkflowDomain has MEETINGS, INITIATIVES, TARGETS
psql $DATABASE_URL -c "
  SELECT enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'WorkflowDomain'
    AND enumlabel IN ('MEETINGS', 'INITIATIVES', 'TARGETS')
  ORDER BY enumlabel;
"
# Expected: 3 rows
```

---

### 7.4 — After Deploy 3 (migrations 3–7 applied)

```bash
# Confirm Migration count is now 14 (7 April + 2 resolved + 5 deployed)
psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM _prisma_migrations
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
"
# Expected: 14

# Confirm Meeting and Initiative tables exist
psql $DATABASE_URL -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('Meeting', 'Initiative')
  ORDER BY table_name;
"
# Expected: 2 rows

# Confirm VisibilityScope enum exists
psql $DATABASE_URL -c "
  SELECT typname FROM pg_type WHERE typname = 'VisibilityScope';
"
# Expected: 1 row

# Confirm linked ref columns exist on Target
psql $DATABASE_URL -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Target'
    AND column_name IN ('linkedInitiativeRefs', 'linkedMeetingRefs')
  ORDER BY column_name;
"
# Expected: 2 rows

# Confirm visibilityScope column on Meeting and Initiative
psql $DATABASE_URL -c "
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'visibilityScope'
    AND table_name IN ('Meeting', 'Initiative', 'Target')
  ORDER BY table_name;
"
# Expected: 3 rows
```

---

### 7.5 — After Step 3.3 + resolve (migration 8 complete)

```bash
# Confirm MEETINGS and INITIATIVES are in PermissionModule
psql $DATABASE_URL -c "
  SELECT enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'PermissionModule'
    AND enumlabel IN ('MEETINGS', 'INITIATIVES')
  ORDER BY enumlabel;
"
# Expected: 2 rows
```

---

### 7.6 — After Deploy 4 (migrations 9–10 applied)

```bash
# Confirm Meeting sub-entity tables exist
psql $DATABASE_URL -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'MeetingAgendaItem', 'MeetingDecision', 'MeetingAction', 'MeetingParticipant'
    )
  ORDER BY table_name;
"
# Expected: 4 rows

# Confirm CommunicationTemplate table exists
psql $DATABASE_URL -c "
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'CommunicationTemplate'
  ) AS ct_exists;
"
# Expected: true

# Confirm FK constraints on MeetingAgendaItem
psql $DATABASE_URL -c "
  SELECT constraint_name FROM information_schema.table_constraints
  WHERE table_name = 'MeetingAgendaItem'
    AND constraint_type = 'FOREIGN KEY';
"
# Expected: 1 row (MeetingAgendaItem_meetingId_fkey)
```

---

### 7.7 — After Step 3.4 + resolve (migration 11 complete)

```bash
# Confirm TEMPLATES is in PermissionModule
psql $DATABASE_URL -c "
  SELECT enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'PermissionModule' AND enumlabel = 'TEMPLATES';
"
# Expected: 1 row
```

---

### 7.8 — After Deploy 5 (migrations 12–13 applied)

```bash
# Confirm OrgUnit, OrgUnitMembership, TargetGroup exist
psql $DATABASE_URL -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('OrgUnit', 'OrgUnitMembership', 'TargetGroup')
  ORDER BY table_name;
"
# Expected: 3 rows

# Confirm Tenant table exists
psql $DATABASE_URL -c "
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Tenant'
  ) AS tenant_exists;
"
# Expected: true

# Confirm TenantStatus enum exists
psql $DATABASE_URL -c "
  SELECT typname FROM pg_type WHERE typname = 'TenantStatus';
"
# Expected: 1 row
```

---

### 7.9 — After Step 3.5 + 3.5.2 + resolve (migration 14 complete)

```bash
# Confirm Registration table exists with expected columns
psql $DATABASE_URL -c "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Registration'
  ORDER BY ordinal_position;
"
# Expected: 15 columns including id, tenantId, type, status, firstName, lastName, email, etc.

# Confirm FK constraints on Registration
psql $DATABASE_URL -c "
  SELECT tc.constraint_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'Registration'
    AND tc.constraint_type = 'FOREIGN KEY';
"
# Expected: 2 rows (Registration_tenantId_fkey, Registration_assignedToUserId_fkey)

# Confirm REGISTRATIONS is in PermissionModule
psql $DATABASE_URL -c "
  SELECT enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'PermissionModule' AND enumlabel = 'REGISTRATIONS';
"
# Expected: 1 row
```

---

### 7.10 — After Deploy 6 (migration 15 applied)

```bash
# Confirm FK constraints on OrgUnitMembership (userId and personId)
psql $DATABASE_URL -c "
  SELECT tc.constraint_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'OrgUnitMembership'
    AND tc.constraint_type = 'FOREIGN KEY'
  ORDER BY kcu.column_name;
"
# Expected: 3 rows (orgUnitId, userId, personId foreign keys)

# Confirm the backfill UPDATE was a no-op (tables are empty, all good)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"OrgUnit\";"
# Expected: 0 (fresh table — seed not yet run)
```

---

### 7.11 — After Step 3.6 + resolve (migration 16 complete)

```bash
# Confirm TENANTS is in PermissionModule
psql $DATABASE_URL -c "
  SELECT enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'PermissionModule' AND enumlabel = 'TENANTS';
"
# Expected: 1 row
```

---

### 7.12 — After Deploy 7 (final deploy — no-op; confirms clean state)

```bash
npx prisma migrate status
# Expected output: "All migrations have been successfully applied."
# All 23 migrations listed as Applied. Zero pending.
```

---

## Section 8 — Final Validation Checklist

Run all items below after the seed (`npx prisma db seed`) has completed successfully. Each item has a SQL verification query AND a browser/API smoke test where applicable.

---

### 8.1 — Tenant table exists

**SQL check:**

```sql
SELECT id, key, name, status, "createdAt"
FROM "Tenant"
ORDER BY "createdAt";
```

Expected: At minimum the `fc-allschwil` tenant row inserted by the seed.

**Schema check:**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Tenant'
ORDER BY ordinal_position;
```

Expected columns: `id` (text, NOT NULL), `key` (text, NOT NULL), `name` (text, NOT NULL), `status` (TenantStatus, NOT NULL), `createdAt`, `updatedAt`.

---

### 8.2 — Registration table exists

**SQL check:**

```sql
SELECT COUNT(*) AS registration_count FROM "Registration";
```

Expected: 0 (no seed registrations by default) — but the query must succeed without error.

**Schema integrity check:**

```sql
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'Registration'
  AND tc.constraint_type = 'FOREIGN KEY';
```

Expected: 2 rows — `tenantId → Tenant` and `assignedToUserId → User`.

---

### 8.3 — OrgUnit tables exist

**SQL check:**

```sql
SELECT table_name, (
  SELECT COUNT(*) FROM information_schema.columns c2
  WHERE c2.table_name = t.table_name AND c2.table_schema = 'public'
) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('OrgUnit', 'OrgUnitMembership', 'TargetGroup')
ORDER BY table_name;
```

Expected: 3 rows with column counts > 0.

**Seed data check (after seed):**

```sql
SELECT key, name, type, status FROM "OrgUnit" ORDER BY key;
```

Expected: rows for `vorstand` (Vorstand, COMMITTEE) and `sportkommission` (Sportkommission, COMMITTEE).

---

### 8.4 — Meetings work

**SQL check:**

```sql
SELECT id, slug, title, status, "reviewStage", "visibilityScope"
FROM "Meeting"
ORDER BY "meetingDate" DESC;
```

Expected: 3 seed meetings (`vorstandssitzung-april`, `trainer-rapport-rueckrunde`, `medienkoordination-saisonstart`).

**API smoke test (requires a valid STAGE session cookie):**

```bash
# GET /api/meetings — returns 200 with JSON array
curl -s -o /dev/null -w "%{http_code}" \
  -H "Cookie: <session-cookie>" \
  https://<stage-domain>/api/meetings
# Expected: 200
```

**Browser test:**

1. Navigate to `https://<stage-domain>/admin/vereinsleitung/meetings`
2. Confirm the page loads without 500 error
3. Confirm the 3 seeded meetings appear in the list with status badges

---

### 8.5 — Initiatives work

**SQL check:**

```sql
SELECT id, slug, title, status, "reviewStage", "visibilityScope"
FROM "Initiative"
ORDER BY "createdAt";
```

Expected: 3 seed initiatives (`website-relaunch`, `neues-clubhaus-konzept`, `sponsorenlauf-2025`).

**API smoke test:**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Cookie: <session-cookie>" \
  https://<stage-domain>/api/initiatives
# Expected: 200
```

**Browser test:**

1. Navigate to `https://<stage-domain>/admin/vereinsleitung/initiativen`
2. Confirm the page loads without error
3. Confirm the 3 seeded initiatives appear with progress indicators

---

### 8.6 — Registrations work

**SQL check:**

```sql
-- Confirm Registration references fc-allschwil tenant
SELECT r.id, r.type, r.status, t.key AS tenant_key
FROM "Registration" r
JOIN "Tenant" t ON t.id = r."tenantId"
LIMIT 5;
```

Expected: query succeeds (0 rows is fine if no registrations have been submitted yet).

**API smoke test:**

```bash
# GET /api/registrations — expects 200 with JSON
curl -s -o /dev/null -w "%{http_code}" \
  -H "Cookie: <session-cookie>" \
  https://<stage-domain>/api/registrations
# Expected: 200

# POST a test registration to the public endpoint (no session required)
curl -s -o /dev/null -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "fc-allschwil",
    "type": "PROBETRAINING",
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com"
  }' \
  https://<stage-domain>/api/registrations/public
# Expected: 200 or 201
```

**Browser test:**

1. Navigate to `https://<stage-domain>/admin/tenant/fc-allschwil/cockpit/registrations`
2. Confirm the registration inbox page loads without error
3. If a test registration was submitted above, confirm it appears with status `NEW`

---

### 8.7 — Login works

**SQL prerequisite:**

```sql
-- Confirm admin user exists
SELECT id, email, "isActive", "lastLoginAt"
FROM "User"
WHERE email = 'admin@fcallschwil.ch';
```

Expected: 1 row with `isActive = true`.

**Confirm PermissionModule enum has all 17 values (login crashes if TENANTS is missing):**

```sql
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'PermissionModule'
ORDER BY enumsortorder;
```

Expected 17 values in this order:
`USERS`, `TEAMS`, `PEOPLE`, `FIXTURES`, `WOCHENPLAN`, `NEWS`, `WEBSITE`, `INFOBOARD`, `FUNCTIONS`, `SEASONS`, `EVENTS`, `TARGETS`, `MEETINGS`, `INITIATIVES`, `TEMPLATES`, `REGISTRATIONS`, `TENANTS`

> **Critical:** The absence of `TENANTS` was the root cause of the STAGE login crash. Migration 16 (`20260602000000_add_tenants_permission_module`) adds this value. If the login test fails with a database enum error, verify this value is present.

**Browser login test:**

1. Open `https://<stage-domain>/login` in a fresh incognito window
2. Enter credentials: `admin@fcallschwil.ch` / `<stage-admin-password>`
3. Expected: redirect to the admin dashboard `/admin` or `/vereinsleitung` without error
4. Confirm no 500 or database error is displayed

**API login test:**

```bash
curl -s -c /tmp/stage_cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fcallschwil.ch","password":"<password>"}' \
  https://<stage-domain>/api/auth/callback/credentials
# Expected: redirect (302) to dashboard, not an error page
```

---

### 8.8 — Logout works

**Browser logout test:**

1. While logged in to STAGE as admin
2. Navigate to the user menu or profile dropdown
3. Click "Abmelden" (logout)
4. Expected: session is invalidated; redirect to `/login`
5. Attempt to navigate to a protected route (e.g. `/admin/vereinsleitung`) while logged out
6. Expected: redirect back to `/login` (auth guard working)

**NextAuth session invalidation check:**

```bash
# After logout, the session cookie should be absent or expired
# If using a cookie file from the login test above:
curl -s -b /tmp/stage_cookies.txt \
  https://<stage-domain>/api/auth/session
# Expected: {} (empty session — logged out)
```

---

### 8.9 — Migration history integrity (master check)

```sql
-- All 23 migrations applied, none failed, none rolled back
SELECT
  COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied,
  COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)                         AS rolled_back,
  COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)     AS pending
FROM _prisma_migrations;
```

Expected: `applied = 23`, `rolled_back = 0`, `pending = 0`.

---

### 8.10 — Full table inventory

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name != '_prisma_migrations'
ORDER BY table_name;
```

Expected exactly 31 tables:

```
AuditLog
CommunicationTemplate
Event
EventImportRun
Initiative
Meeting
MeetingAction
MeetingAgendaItem
MeetingDecision
MeetingParticipant
OrgUnit
OrgUnitMembership
Permission
Person
PlayerSquadMember
Registration
Role
RolePermission
RoleWorkflowReviewAssignment
RoleWorkflowRule
Season
Target
TargetDataPoint
TargetGroup
TargetMetric
Team
TeamSeason
Tenant
TrainerTeamMember
User
UserRole
```

---

## Execution Flowchart

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PRE-EXECUTION                                                              │
│  pg_dump backup → verify 7 applied + 16 pending → verify 16 data tables    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEPLOY 1 → FAILS on migration 1 (ALTER TYPE PermissionModule)              │
│  → 3.1.1 psql: ALTER TYPE PermissionModule ADD VALUE 'TARGETS'              │
│  → 3.1.2 psql: CREATE TYPE ×5 + CREATE TABLE ×3 + indexes + FKs            │
│  → resolve: 20260518120000_add_targets_module                               │
│  → verify 7.2                                                               │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEPLOY 2 → FAILS on migration 2 (ALTER TYPE WorkflowDomain ×3)            │
│  → 3.2.1 psql: ALTER TYPE WorkflowDomain ADD VALUE ×3                      │
│  → 3.2.2 psql: ALTER TABLE ADD COLUMN ×4 + CREATE INDEX                    │
│  → resolve: 20260518130000_add_governance_foundation                        │
│  → verify 7.3                                                               │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEPLOY 3 → APPLIES migrations 3–7, FAILS on migration 8                   │
│  (cross_module_links, meeting_model, initiative_model,                      │
│   visibility_scope, target_visibility_scope)                                │
│  → verify 7.4                                                               │
│  → 3.3 psql: ALTER TYPE PermissionModule ADD VALUE 'MEETINGS' + 'INITIATIVES'│
│  → resolve: 20260518190000_add_meeting_initiative_permission_modules        │
│  → verify 7.5                                                               │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEPLOY 4 → APPLIES migrations 9–10, FAILS on migration 11                 │
│  (meeting_sub_entities, communication_template)                             │
│  → verify 7.6                                                               │
│  → 3.4 psql: ALTER TYPE PermissionModule ADD VALUE 'TEMPLATES'              │
│  → resolve: 20260518220000_add_templates_permission_module                  │
│  → verify 7.7                                                               │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEPLOY 5 → APPLIES migrations 12–13, FAILS on migration 14                │
│  (org_builder_foundation, tenant_foundation)                                │
│  → verify 7.8                                                               │
│  → 3.5.1 psql: ALTER TYPE PermissionModule ADD VALUE 'REGISTRATIONS'       │
│  → 3.5.2 psql: CREATE TYPE ×2 + CREATE TABLE + FKs + indexes               │
│  → resolve: 20260601093400_add_registration_inbox                           │
│  → verify 7.9                                                               │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEPLOY 6 → APPLIES migration 15, FAILS on migration 16                    │
│  (org_membership_relations_tenant_backfill)                                 │
│  → verify 7.10                                                              │
│  → 3.6 psql: ALTER TYPE PermissionModule ADD VALUE 'TENANTS'               │
│  → resolve: 20260602000000_add_tenants_permission_module                    │
│  → verify 7.11                                                              │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEPLOY 7 → "All migrations have been successfully applied."                │
│  → verify 7.12                                                              │
│  npx prisma db seed                                                         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FINAL VALIDATION CHECKLIST (Section 8)                                     │
│  8.1 Tenant table ✓  8.2 Registration table ✓  8.3 OrgUnit tables ✓       │
│  8.4 Meetings ✓       8.5 Initiatives ✓         8.6 Registrations ✓       │
│  8.7 Login ✓          8.8 Logout ✓              8.9 Migration history ✓   │
│  8.10 31 tables ✓                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Card

```bash
# ── BACKUP ────────────────────────────────────────────────────────────────
export DATABASE_URL="<neon-stage-connection-string>"
pg_dump $DATABASE_URL > stage_backup_$(date +%Y%m%d_%H%M%S).sql

# ── DEPLOY 1 (fails) ──────────────────────────────────────────────────────
npx prisma migrate deploy

# ── MANUAL 1: add_targets_module ─────────────────────────────────────────
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TARGETS';"
# ... run Section 3.1.2 heredoc ...
npx prisma migrate resolve --applied 20260518120000_add_targets_module

# ── DEPLOY 2 (fails) ──────────────────────────────────────────────────────
npx prisma migrate deploy

# ── MANUAL 2: add_governance_foundation ──────────────────────────────────
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'TARGETS';"
# ... run Section 3.2.2 heredoc ...
npx prisma migrate resolve --applied 20260518130000_add_governance_foundation

# ── DEPLOY 3 (applies 5, then fails on migration 8) ───────────────────────
npx prisma migrate deploy

# ── MANUAL 8: add_meeting_initiative_permission_modules ──────────────────
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
npx prisma migrate resolve --applied 20260518190000_add_meeting_initiative_permission_modules

# ── DEPLOY 4 (applies 2, then fails on migration 11) ──────────────────────
npx prisma migrate deploy

# ── MANUAL 11: add_templates_permission_module ───────────────────────────
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TEMPLATES';"
npx prisma migrate resolve --applied 20260518220000_add_templates_permission_module

# ── DEPLOY 5 (applies 2, then fails on migration 14) ──────────────────────
npx prisma migrate deploy

# ── MANUAL 14: add_registration_inbox ────────────────────────────────────
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'REGISTRATIONS';"
# ... run Section 3.5.2 heredoc ...
npx prisma migrate resolve --applied 20260601093400_add_registration_inbox

# ── DEPLOY 6 (applies 1, then fails on migration 16) ──────────────────────
npx prisma migrate deploy

# ── MANUAL 16: add_tenants_permission_module ──────────────────────────────
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TENANTS';"
npx prisma migrate resolve --applied 20260602000000_add_tenants_permission_module

# ── DEPLOY 7 (clean — all done) ───────────────────────────────────────────
npx prisma migrate deploy
# → "All migrations have been successfully applied."

# ── SEED ──────────────────────────────────────────────────────────────────
npx prisma db seed

# ── FINAL STATUS ─────────────────────────────────────────────────────────
npx prisma migrate status
# → 23 Applied, 0 Pending
```
