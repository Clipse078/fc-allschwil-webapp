# STAGE Recovery Runbook

> Version: 1.0 — 2026-06-02  
> Basis: STAGE_DRIFT_REPORT.md + DB_MIGRATION_READINESS.md + migration SQL files  
> Scope: **STAGE environment only. Do NOT run against Production.**  
> Type: In-place repair — applies 16 missing migrations without destroying existing April data.

---

## Overview

STAGE is frozen at April 2026. All 16 migrations committed since 2026-05-18 are absent from `_prisma_migrations` and have never been applied to the database. The migration history is clean; no failed or partial entries exist. This runbook applies all 16 in strict chronological order.

**Time estimate:** 15–30 minutes of active work, depending on psql connectivity latency.

**Risk level:** Low. Every missing migration is purely additive (CREATE TABLE, ADD COLUMN, ADD ENUM VALUE). No existing April table is structurally altered.

---

## Migration Classification

| # | Migration | Execution mode | Why |
|---|-----------|---------------|-----|
| 1 | `20260518120000_add_targets_module` | **MANUAL-HYBRID** | `ALTER TYPE` + CREATE TABLE — mixed; Prisma transaction would roll back everything |
| 2 | `20260518130000_add_governance_foundation` | **MANUAL-HYBRID** | `ALTER TYPE` ×3 + ALTER TABLE — mixed |
| 3 | `20260518140000_add_cross_module_links` | Prisma | Pure ALTER TABLE ADD COLUMN, transaction-safe |
| 4 | `20260518150000_add_meeting_model` | Prisma | CREATE TYPE + CREATE TABLE |
| 5 | `20260518160000_add_initiative_model` | Prisma | CREATE TYPE + CREATE TABLE |
| 6 | `20260518170000_add_visibility_scope` | Prisma | CREATE TYPE + ALTER TABLE |
| 7 | `20260518180000_add_target_visibility_scope` | Prisma | ALTER TABLE ADD COLUMN |
| 8 | `20260518190000_add_meeting_initiative_permission_modules` | **MANUAL-ENUM-ONLY** | `ALTER TYPE` only (IF NOT EXISTS) |
| 9 | `20260518200000_add_meeting_sub_entities` | Prisma | CREATE TYPE ×4 + CREATE TABLE ×4 |
| 10 | `20260518210000_add_communication_template` | Prisma | CREATE TYPE ×2 + CREATE TABLE |
| 11 | `20260518220000_add_templates_permission_module` | **MANUAL-ENUM-ONLY** | `ALTER TYPE` only (IF NOT EXISTS) |
| 12 | `20260518230000_add_org_builder_foundation` | Prisma | CREATE TYPE ×3 + CREATE TABLE ×3 |
| 13 | `20260601083400_add_tenant_foundation` | Prisma | CREATE TYPE + CREATE TABLE |
| 14 | `20260601093400_add_registration_inbox` | **MANUAL-HYBRID** | `ALTER TYPE` + CREATE TABLE — mixed |
| 15 | `20260601124700_add_org_membership_relations_tenant_backfill` | Prisma | UPDATE ×4 (no-op) + CREATE INDEX + ADD FK |
| 16 | `20260602000000_add_tenants_permission_module` | **MANUAL-ENUM-ONLY** | `ALTER TYPE` only (IF NOT EXISTS) |

**Why MANUAL-HYBRID is distinct from MANUAL-ENUM-ONLY:**  
PostgreSQL cannot run `ALTER TYPE … ADD VALUE` inside a transaction. Prisma wraps every migration in `BEGIN … COMMIT`. When the `ALTER TYPE` line fails, the entire transaction rolls back — including any `CREATE TABLE` statements that appear later in the same file. For MANUAL-HYBRID migrations, you must therefore apply **all SQL in that file manually** (ALTER TYPE first, then the remaining DDL), and then call `prisma migrate resolve --applied` to register completion. For MANUAL-ENUM-ONLY migrations, the file contains nothing but `ALTER TYPE`, so applying it manually and marking resolved is sufficient.

---

## Prerequisites

Before starting:

- [ ] You have `psql` and `npx` available in your shell.
- [ ] `DATABASE_URL` is set and points to **STAGE** (not production).  
  `echo $DATABASE_URL` — confirm it contains your Neon STAGE connection string.
- [ ] The local repo is on the `STAGE` branch and is clean.  
  `git status` — should show nothing unexpected.
- [ ] PostgreSQL version on STAGE is ≥ 13.  
  `psql $DATABASE_URL -c "SELECT version();"` — confirm.
- [ ] No long-running transactions or locks are blocking schema changes.  
  `psql $DATABASE_URL -c "SELECT pid, state, query_start, query FROM pg_stat_activity WHERE state != 'idle';"` — should be empty or only show your own session.

---

## Phase 1 — Backup and Snapshot

**Do not skip this phase.** Prisma does not support rollback of applied migrations. If anything goes wrong, the only recovery path is restoration from this backup.

### Step 1.1 — Full database dump

```bash
pg_dump $DATABASE_URL > stage_backup_$(date +%Y%m%d_%H%M%S).sql
echo "Backup size: $(du -sh stage_backup_*.sql | tail -1)"
```

Confirm the file is non-zero and ends with `--` PostgreSQL dump footer before continuing.

### Step 1.2 — Confirm current migration state

```bash
npx prisma migrate status
```

Expected output: exactly 7 migrations shown as **Applied**, all others as **Pending**:

```
Following migration(s) have been applied:
  migrations/
    └─ 20260410225355_init/
    └─ 20260411142054_add_team_audit_and_trainingsgruppe/
    └─ 20260411191906_add_player_squad_model/
    └─ 20260413100139_add_seasons_permission_module/
    └─ 20260413101943_add_events_foundation/
    └─ 20260413134413_add_event_import_runs/
    └─ 20260418-194927_deployment_catchup/

Following migration(s) are not yet applied:
  migrations/
    └─ 20260518120000_add_targets_module/
    ... (16 pending)
```

If the output does not match this exactly, stop and investigate before proceeding.

### Step 1.3 — Record current table count

```sql
-- Run in Neon SQL Editor or psql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

Expected: `16` (data tables, excluding `_prisma_migrations`).

---

## Phase 2 — Migration Execution

### How this section is organised

The 16 migrations are split into **7 deployment segments**. Each segment ends when `prisma migrate deploy` either completes all pending migrations or stops at the next `ALTER TYPE` barrier. Manual intervention steps are interspersed between segments.

Set your `DATABASE_URL` once for the session:

```bash
export DATABASE_URL="<your-neon-stage-connection-string>"
```

---

### Segment A — First deploy attempt (will fail on migration 1)

```bash
npx prisma migrate deploy
```

**Expected:** Prisma attempts migration `20260518120000_add_targets_module`, fails with an error similar to:

```
ERROR: ALTER TYPE ... cannot run inside a transaction block
```

Migration 1 is rolled back entirely. Nothing is applied. `_prisma_migrations` is unchanged.

---

### Step A1 — Manual intervention: migration 1 `20260518120000_add_targets_module`

**Purpose:** Adds the Targets module — PermissionModule enum value `TARGETS`, five target-related enums, and three tables (`Target`, `TargetMetric`, `TargetDataPoint`).  
**Dependencies:** `ReviewWorkflowStage` enum (applied in April by `deployment_catchup`).  
**Mode:** MANUAL-HYBRID — apply ALTER TYPE first, then all remaining DDL, then mark resolved.

#### A1a — Apply the enum value (outside any transaction)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TARGETS';"
```

Expected: `ALTER TYPE`

#### A1b — Apply remaining DDL (transaction-safe; can run as a block)

```bash
psql $DATABASE_URL << 'SQL'
CREATE TYPE "TargetCategory" AS ENUM (
  'SPORTLICHE_ENTWICKLUNG', 'MITGLIEDERWACHSTUM', 'FINANZEN',
  'AUSBILDUNG', 'MEDIEN_SOZIALES', 'GOVERNANCE'
);
CREATE TYPE "TargetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TargetPeriod" AS ENUM ('SEASON', 'QUARTER', 'YEAR', 'CUSTOM');
CREATE TYPE "TargetMetricType" AS ENUM ('PERCENTAGE', 'NUMERIC', 'CURRENCY', 'BOOLEAN');
CREATE TYPE "TargetDirection" AS ENUM ('INCREASE', 'DECREASE', 'MAINTAIN');

CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TargetCategory" NOT NULL DEFAULT 'SPORTLICHE_ENTWICKLUNG',
    "status" "TargetStatus" NOT NULL DEFAULT 'ACTIVE',
    "period" "TargetPeriod" NOT NULL DEFAULT 'SEASON',
    "periodLabel" TEXT,
    "moduleKey" TEXT,
    "sportCategory" TEXT,
    "ageGroupHint" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "nudgeJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TargetMetric" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TargetMetricType" NOT NULL DEFAULT 'PERCENTAGE',
    "direction" "TargetDirection" NOT NULL DEFAULT 'INCREASE',
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TargetMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TargetDataPoint" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TargetDataPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Target_category_idx" ON "Target"("category");
CREATE INDEX "Target_status_idx" ON "Target"("status");
CREATE INDEX "Target_period_idx" ON "Target"("period");
CREATE INDEX "TargetMetric_targetId_idx" ON "TargetMetric"("targetId");
CREATE INDEX "TargetMetric_targetId_sortOrder_idx" ON "TargetMetric"("targetId", "sortOrder");
CREATE INDEX "TargetDataPoint_metricId_idx" ON "TargetDataPoint"("metricId");
CREATE INDEX "TargetDataPoint_measuredAt_idx" ON "TargetDataPoint"("measuredAt");

ALTER TABLE "TargetMetric"
    ADD CONSTRAINT "TargetMetric_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TargetDataPoint"
    ADD CONSTRAINT "TargetDataPoint_metricId_fkey"
    FOREIGN KEY ("metricId") REFERENCES "TargetMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
SQL
```

Expected: each statement prints its type (`CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`).

#### A1c — Mark migration as applied

```bash
npx prisma migrate resolve --applied 20260518120000_add_targets_module
```

Expected: `Migration 20260518120000_add_targets_module marked as applied.`

---

### Segment B — Second deploy attempt (will fail on migration 2)

```bash
npx prisma migrate deploy
```

**Expected:** Prisma attempts migration `20260518130000_add_governance_foundation`, fails on its first `ALTER TYPE … ADD VALUE 'MEETINGS'` line. Transaction rolls back. Nothing applied.

---

### Step B1 — Manual intervention: migration 2 `20260518130000_add_governance_foundation`

**Purpose:** Adds `MEETINGS`, `INITIATIVES`, `TARGETS` to `WorkflowDomain` enum; adds governance columns (`reviewStage`, `requiresFourEyeReview`, `reviewedByUserId`, `reviewedAt`) to `Target`.  
**Dependencies:** `Target` table (created in Step A1); `ReviewWorkflowStage` enum (April).  
**Mode:** MANUAL-HYBRID.

#### B1a — Apply the three enum values

```bash
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'TARGETS';"
```

Expected: `ALTER TYPE` three times.

#### B1b — Apply remaining DDL

```bash
psql $DATABASE_URL << 'SQL'
ALTER TABLE "Target"
  ADD COLUMN "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "requiresFourEyeReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "Target_reviewStage_idx" ON "Target"("reviewStage");
SQL
```

Expected: `ALTER TABLE`, `CREATE INDEX`.

#### B1c — Mark migration as applied

```bash
npx prisma migrate resolve --applied 20260518130000_add_governance_foundation
```

---

### Segment C — Third deploy attempt (applies migrations 3–7, then fails on 8)

```bash
npx prisma migrate deploy
```

**Expected flow:**

| Migration | Action | Tables/columns created |
|-----------|--------|----------------------|
| `20260518140000_add_cross_module_links` | ✅ Applied | Adds `linkedInitiativeRefs`, `linkedMeetingRefs` (JSONB) to `Target` |
| `20260518150000_add_meeting_model` | ✅ Applied | Creates `Meeting` table + `MeetingStatus` enum |
| `20260518160000_add_initiative_model` | ✅ Applied | Creates `Initiative` table + `InitiativeStatus` enum |
| `20260518170000_add_visibility_scope` | ✅ Applied | Creates `VisibilityScope` enum; adds visibility columns to `Meeting` and `Initiative` |
| `20260518180000_add_target_visibility_scope` | ✅ Applied | Adds visibility columns to `Target` |
| `20260518190000_add_meeting_initiative_permission_modules` | ❌ Fails at ALTER TYPE | Transaction rolls back |

Prisma stops after 5 successful migrations. Current pending: 11 migrations (8–16).

---

### Step C1 — Manual intervention: migration 8 `20260518190000_add_meeting_initiative_permission_modules`

**Purpose:** Adds `MEETINGS` and `INITIATIVES` to `PermissionModule` enum.  
**Dependencies:** None (enum values only).  
**Mode:** MANUAL-ENUM-ONLY — file contains only ALTER TYPE statements; nothing else to apply.

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
npx prisma migrate resolve --applied 20260518190000_add_meeting_initiative_permission_modules
```

---

### Segment D — Fourth deploy attempt (applies migrations 9–10, then fails on 11)

```bash
npx prisma migrate deploy
```

**Expected flow:**

| Migration | Action | Tables/columns created |
|-----------|--------|----------------------|
| `20260518200000_add_meeting_sub_entities` | ✅ Applied | Creates `MeetingAgendaItem`, `MeetingDecision`, `MeetingAction`, `MeetingParticipant` + 4 enums |
| `20260518210000_add_communication_template` | ✅ Applied | Creates `CommunicationTemplate` + 2 enums |
| `20260518220000_add_templates_permission_module` | ❌ Fails at ALTER TYPE | Transaction rolls back |

Prisma stops after 2 successful migrations. Current pending: 6 migrations (11–16).

---

### Step D1 — Manual intervention: migration 11 `20260518220000_add_templates_permission_module`

**Purpose:** Adds `TEMPLATES` to `PermissionModule` enum.  
**Dependencies:** None (enum value only).  
**Mode:** MANUAL-ENUM-ONLY.

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TEMPLATES';"
npx prisma migrate resolve --applied 20260518220000_add_templates_permission_module
```

---

### Segment E — Fifth deploy attempt (applies migrations 12–13, then fails on 14)

```bash
npx prisma migrate deploy
```

**Expected flow:**

| Migration | Action | Tables/columns created |
|-----------|--------|----------------------|
| `20260518230000_add_org_builder_foundation` | ✅ Applied | Creates `OrgUnit`, `OrgUnitMembership`, `TargetGroup` + 3 enums |
| `20260601083400_add_tenant_foundation` | ✅ Applied | Creates `Tenant` + `TenantStatus` enum |
| `20260601093400_add_registration_inbox` | ❌ Fails at ALTER TYPE | Transaction rolls back |

Prisma stops after 2 successful migrations. Current pending: 3 migrations (14–16).

---

### Step E1 — Manual intervention: migration 14 `20260601093400_add_registration_inbox`

**Purpose:** Adds `REGISTRATIONS` to `PermissionModule` enum; creates `RegistrationType` and `RegistrationStatus` enums; creates `Registration` table with FK to `Tenant` and `User`.  
**Dependencies:** `Tenant` table (created in Segment E, migration 13); `User` table (April).  
**Mode:** MANUAL-HYBRID.

#### E1a — Apply the enum value

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'REGISTRATIONS';"
```

Expected: `ALTER TYPE`

#### E1b — Apply remaining DDL

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
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "RegistrationType" NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'NEW',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthYear" INTEGER,
    "message" TEXT,
    "payloadJson" JSONB,
    "source" TEXT,
    "assignedToUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
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

CREATE INDEX "Registration_tenantId_status_idx" ON "Registration"("tenantId", "status");
CREATE INDEX "Registration_tenantId_type_idx" ON "Registration"("tenantId", "type");
CREATE INDEX "Registration_tenantId_createdAt_idx" ON "Registration"("tenantId", "createdAt");
CREATE INDEX "Registration_assignedToUserId_idx" ON "Registration"("assignedToUserId");
SQL
```

Expected: `CREATE TYPE` ×2, `CREATE TABLE`, `ALTER TABLE` ×2, `CREATE INDEX` ×4.

#### E1c — Mark migration as applied

```bash
npx prisma migrate resolve --applied 20260601093400_add_registration_inbox
```

---

### Segment F — Sixth deploy attempt (applies migration 15, then fails on 16)

```bash
npx prisma migrate deploy
```

**Expected flow:**

| Migration | Action | What it does |
|-----------|--------|-------------|
| `20260601124700_add_org_membership_relations_tenant_backfill` | ✅ Applied | 4 UPDATE statements (no-op on empty tables) + 1 CREATE INDEX + 2 ADD FK on `OrgUnitMembership` |
| `20260602000000_add_tenants_permission_module` | ❌ Fails at ALTER TYPE | Transaction rolls back |

**Note on the backfill migration:** The four UPDATE statements set `tenantId` on `OrgUnit` and `OrgUnitMembership` rows where a `fc-allschwil` tenant exists. Because both tables were just created in Segment E and contain zero rows, all UPDATE statements will report `UPDATE 0` — this is expected and correct.

Prisma stops after 1 successful migration. Current pending: 1 migration (16).

---

### Step F1 — Manual intervention: migration 16 `20260602000000_add_tenants_permission_module`

**Purpose:** Adds `TENANTS` to `PermissionModule` enum. This was the hotfix that resolved the STAGE login crash (PR #61).  
**Dependencies:** None (enum value only).  
**Mode:** MANUAL-ENUM-ONLY.

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TENANTS';"
npx prisma migrate resolve --applied 20260602000000_add_tenants_permission_module
```

---

### Segment G — Final deploy attempt (should complete with nothing pending)

```bash
npx prisma migrate deploy
```

**Expected output:**

```
All migrations have been successfully applied.
```

If any migration is still pending, stop and re-check the step that should have resolved it.

---

### Post-migration seed

Once all 23 migrations are applied, seed the new tables with demo data:

```bash
npx prisma db seed
```

The seed is fully idempotent. It will skip entity types that already have data (e.g. existing Targets if count > 0) and upsert everything else.

---

## Phase 3 — Verification Queries

Run all queries in Neon SQL Editor or `psql`.

### 3.1 — Migration history completeness

```sql
SELECT COUNT(*) AS total_migrations_applied
FROM _prisma_migrations
WHERE finished_at IS NOT NULL
  AND rolled_back_at IS NULL;
```

**Expected: `23`**

### 3.2 — Check for any failed or rolled-back migrations

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM _prisma_migrations
WHERE rolled_back_at IS NOT NULL
   OR finished_at IS NULL;
```

**Expected: 0 rows.** Any row here indicates a problem that needs investigation before proceeding.

### 3.3 — Confirm the last 16 migrations are recorded

```sql
SELECT migration_name, finished_at
FROM _prisma_migrations
WHERE migration_name >= '20260518120000'
ORDER BY migration_name;
```

**Expected: exactly 16 rows**, all with a non-null `finished_at`.

### 3.4 — Total table count

```sql
SELECT COUNT(*) AS data_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name != '_prisma_migrations';
```

**Expected: `31`**

### 3.5 — Confirm all expected tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected 31 tables (alphabetical):**

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

### 3.6 — Confirm Tenant table structure

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Tenant'
ORDER BY ordinal_position;
```

**Expected columns:** `id`, `key`, `name`, `status`, `createdAt`, `updatedAt`

### 3.7 — Confirm Registration has tenantId

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Registration'
  AND column_name = 'tenantId';
```

**Expected: 1 row** with `data_type = 'text'`, `is_nullable = 'NO'`.

### 3.8 — Confirm Target has governance and visibility columns

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Target'
  AND column_name IN (
    'reviewStage', 'requiresFourEyeReview', 'reviewedByUserId', 'reviewedAt',
    'visibilityScope', 'createdByUserId',
    'linkedInitiativeRefs', 'linkedMeetingRefs'
  )
ORDER BY column_name;
```

**Expected: 8 rows** — all columns listed above.

### 3.9 — Confirm PermissionModule enum values

```sql
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'PermissionModule'
ORDER BY enumsortorder;
```

**Expected 17 values:** `USERS`, `TEAMS`, `PEOPLE`, `FIXTURES`, `WOCHENPLAN`, `NEWS`, `WEBSITE`, `INFOBOARD`, `FUNCTIONS`, `SEASONS`, `EVENTS`, `TARGETS`, `MEETINGS`, `INITIATIVES`, `TEMPLATES`, `REGISTRATIONS`, `TENANTS`

### 3.10 — Confirm WorkflowDomain enum values include new entries

```sql
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'WorkflowDomain'
ORDER BY enumsortorder;
```

**Expected 16 values** including `MEETINGS`, `INITIATIVES`, `TARGETS` (added by migration 2).

### 3.11 — Confirm FK constraints on Registration

```sql
SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'Registration'
  AND tc.constraint_type = 'FOREIGN KEY';
```

**Expected: 2 rows** — `tenantId → Tenant.id` and `assignedToUserId → User.id`.

### 3.12 — Prisma migrate status (final check)

```bash
npx prisma migrate status
```

**Expected:** All 23 migrations shown as `Applied`. Zero pending migrations.

---

## Phase 4 — Expected Final Schema State

After successful recovery, STAGE will match `schema.prisma` exactly.

### Tables: 31

| # | Table | Created by |
|---|-------|-----------|
| 1 | `User` | April init |
| 2 | `Role` | April init |
| 3 | `Permission` | April init |
| 4 | `UserRole` | April init |
| 5 | `RolePermission` | April init |
| 6 | `Season` | April init |
| 7 | `Person` | April init |
| 8 | `Team` | April init |
| 9 | `TeamSeason` | April init |
| 10 | `AuditLog` | April |
| 11 | `PlayerSquadMember` | April |
| 12 | `TrainerTeamMember` | April |
| 13 | `Event` | April |
| 14 | `EventImportRun` | April |
| 15 | `RoleWorkflowRule` | April |
| 16 | `RoleWorkflowReviewAssignment` | April |
| 17 | `Target` | Migration 1 (Step A1) |
| 18 | `TargetMetric` | Migration 1 (Step A1) |
| 19 | `TargetDataPoint` | Migration 1 (Step A1) |
| 20 | `Meeting` | Migration 4 (Segment C) |
| 21 | `Initiative` | Migration 5 (Segment C) |
| 22 | `MeetingAgendaItem` | Migration 9 (Segment D) |
| 23 | `MeetingDecision` | Migration 9 (Segment D) |
| 24 | `MeetingAction` | Migration 9 (Segment D) |
| 25 | `MeetingParticipant` | Migration 9 (Segment D) |
| 26 | `CommunicationTemplate` | Migration 10 (Segment D) |
| 27 | `OrgUnit` | Migration 12 (Segment E) |
| 28 | `OrgUnitMembership` | Migration 12 (Segment E) |
| 29 | `TargetGroup` | Migration 12 (Segment E) |
| 30 | `Tenant` | Migration 13 (Segment E) |
| 31 | `Registration` | Migration 14 (Step E1) |

### Enum types: 31 total

New enums added by this recovery (not present in April STAGE):

| Enum | Values | Added by |
|------|--------|---------|
| `TargetCategory` | 6 values | Migration 1 |
| `TargetStatus` | 5 values | Migration 1 |
| `TargetPeriod` | 4 values | Migration 1 |
| `TargetMetricType` | 4 values | Migration 1 |
| `TargetDirection` | 3 values | Migration 1 |
| `MeetingStatus` | 3 values | Migration 4 |
| `InitiativeStatus` | 6 values | Migration 5 |
| `VisibilityScope` | 3 values | Migration 6 |
| `MeetingAgendaItemStatus` | 3 values | Migration 9 |
| `MeetingDecisionStatus` | 3 values | Migration 9 |
| `MeetingActionStatus` | 4 values | Migration 9 |
| `MeetingParticipantStatus` | 4 values | Migration 9 |
| `CommunicationTemplateCategory` | 9 values | Migration 10 |
| `CommunicationTemplateStatus` | 3 values | Migration 10 |
| `OrgUnitType` | 8 values | Migration 12 |
| `OrgUnitStatus` | 3 values | Migration 12 |
| `OrgUnitMembershipStatus` | 3 values | Migration 12 |
| `TenantStatus` | 3 values | Migration 13 |
| `RegistrationType` | 6 values | Migration 14 |
| `RegistrationStatus` | 6 values | Migration 14 |

New enum values added to existing enums:

| Enum | New value(s) | Added by |
|------|-------------|---------|
| `PermissionModule` | `TARGETS` | Migration 1 |
| `WorkflowDomain` | `MEETINGS`, `INITIATIVES`, `TARGETS` | Migration 2 |
| `PermissionModule` | `MEETINGS`, `INITIATIVES` | Migration 8 |
| `PermissionModule` | `TEMPLATES` | Migration 11 |
| `PermissionModule` | `REGISTRATIONS` | Migration 14 |
| `PermissionModule` | `TENANTS` | Migration 16 |

### _prisma_migrations: 23 rows

All 23 entries with non-null `finished_at` and null `rolled_back_at`.

---

## Rollback Plan

> Prisma does not support rollback of applied migrations. The only recovery path is restoration from the Phase 1 backup.

### If any step fails

1. **Stop immediately.** Do not re-run `prisma migrate deploy` without understanding the failure.
2. `npx prisma migrate status` — identify which migrations applied before the failure.
3. Decide whether the partially applied state is safe to continue from or whether a restore is needed.
4. If restoring: `psql $DATABASE_URL < stage_backup_<timestamp>.sql`
5. After restore, confirm table count returns to 16 data tables before retrying.

### If a hybrid migration applies the ALTER TYPE but then fails on the DDL block

This leaves the enum value added but the table not yet created, with the migration NOT recorded in `_prisma_migrations`. You can safely re-run the DDL block from step `B` of the affected intervention — the `IF NOT EXISTS` guard on the ALTER TYPE means it will be a no-op on the second attempt for enum values. For the CREATE TABLE block, if any table was partially created, PostgreSQL will error; use `DROP TABLE IF EXISTS "<name>"` to clean it up before retrying.

---

## Quick Reference — All 6 Manual Interventions

```bash
# --- Migration 1: MANUAL-HYBRID (after first deploy attempt fails) ---
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TARGETS';"
# ... then apply the A1b DDL block above ...
npx prisma migrate resolve --applied 20260518120000_add_targets_module

# --- Migration 2: MANUAL-HYBRID (after second deploy attempt fails) ---
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'TARGETS';"
# ... then apply the B1b DDL block above ...
npx prisma migrate resolve --applied 20260518130000_add_governance_foundation

# --- Migration 8: MANUAL-ENUM-ONLY (after third deploy attempt fails) ---
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
npx prisma migrate resolve --applied 20260518190000_add_meeting_initiative_permission_modules

# --- Migration 11: MANUAL-ENUM-ONLY (after fourth deploy attempt fails) ---
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TEMPLATES';"
npx prisma migrate resolve --applied 20260518220000_add_templates_permission_module

# --- Migration 14: MANUAL-HYBRID (after fifth deploy attempt fails) ---
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'REGISTRATIONS';"
# ... then apply the E1b DDL block above ...
npx prisma migrate resolve --applied 20260601093400_add_registration_inbox

# --- Migration 16: MANUAL-ENUM-ONLY (after sixth deploy attempt fails) ---
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TENANTS';"
npx prisma migrate resolve --applied 20260602000000_add_tenants_permission_module
```

---

## Execution Summary

```
Phase 1:  pg_dump backup → confirm 7 applied + 16 pending migrations

Phase 2:
  attempt 1 → FAILS on migration 1 → apply A1 manually
  attempt 2 → FAILS on migration 2 → apply B1 manually
  attempt 3 → applies migrations 3–7, FAILS on 8 → apply C1 manually
  attempt 4 → applies migrations 9–10, FAILS on 11 → apply D1 manually
  attempt 5 → applies migrations 12–13, FAILS on 14 → apply E1 manually
  attempt 6 → applies migration 15, FAILS on 16 → apply F1 manually
  attempt 7 → completes cleanly — all 23 migrations applied

  npx prisma db seed

Phase 3:  Run all 12 verification queries — expect zero failures

Phase 4:  31 tables, 23 migration records, schema in sync with schema.prisma
```
