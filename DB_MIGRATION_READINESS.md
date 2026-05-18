# DB Migration & Seed Readiness

> Sprint: DB Migration + Seed Readiness  
> Date: 2026-05-18  
> Environment target: **Stage / Local dev only. Do NOT run against Production without a verified backup.**

---

## Pre-Migration Checklist

Before running any migration:

- [ ] **Take a full database backup.**
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Confirm `DATABASE_URL` points to the **correct stage/local** database.
- [ ] Confirm `npx prisma migrate status` shows all prior migrations as applied.
- [ ] Confirm no active long-running transactions are blocking schema changes.
- [ ] Confirm PostgreSQL version ≥ 12 (for `ALTER TYPE … ADD VALUE` in transactions — see caveat below).

---

## Migration Order

All 5 sprint migrations must be applied in strict ascending timestamp order.
They build on each other — applying out of order will fail.

| # | Timestamp | Name | Key operations |
|---|-----------|------|----------------|
| 1 | `20260518120000` | `add_targets_module` | `ALTER TYPE PermissionModule ADD VALUE 'TARGETS'` ⚠️; `CREATE TYPE` ×5; `CREATE TABLE Target/TargetMetric/TargetDataPoint` |
| 2 | `20260518130000` | `add_governance_foundation` | `ALTER TYPE WorkflowDomain ADD VALUE` ×3 ⚠️; `ALTER TABLE Target ADD COLUMN` ×4 |
| 3 | `20260518140000` | `add_cross_module_links` | `ALTER TABLE Target ADD COLUMN` ×2 (JSONB) |
| 4 | `20260518150000` | `add_meeting_model` | `CREATE TYPE MeetingStatus`; `CREATE TABLE Meeting` |
| 5 | `20260518160000` | `add_initiative_model` | `CREATE TYPE InitiativeStatus`; `CREATE TABLE Initiative` |

**Pre-existing migrations that must already be applied:**

```
20260410225355_init
20260411142054_add_team_audit_and_trainingsgruppe
20260411191906_add_player_squad_model
20260413100139_add_seasons_permission_module
20260413101943_add_events_foundation          ← defines ReviewWorkflowStage enum (required by sprints 1–5)
20260413134413_add_event_import_runs
20260418-194927_deployment_catchup
```

---

## Standard Deploy Command

```bash
DATABASE_URL="<your-stage-db-url>" npx prisma migrate deploy
```

This attempts to apply all pending migrations in order.

---

## ⚠️ ALTER TYPE … ADD VALUE Caveat

Migrations **`20260518120000`** and **`20260518130000`** contain `ALTER TYPE … ADD VALUE` statements. In PostgreSQL, this DDL cannot run inside a transaction block. Prisma's `migrate deploy` wraps each migration file in a transaction by default.

**Affected statements (4 total across 2 files):**

```sql
-- 20260518120000
ALTER TYPE "PermissionModule" ADD VALUE 'TARGETS';

-- 20260518130000
ALTER TYPE "WorkflowDomain" ADD VALUE 'MEETINGS';
ALTER TYPE "WorkflowDomain" ADD VALUE 'INITIATIVES';
ALTER TYPE "WorkflowDomain" ADD VALUE 'TARGETS';
```

**Behaviour by PostgreSQL version:**

| PG Version | Behaviour |
|-----------|-----------|
| < 12 | Fails inside a transaction — always use manual workaround |
| ≥ 12 | May succeed if the enum value is not referenced in the same transaction. In practice, `migrate deploy` may still fail depending on driver behaviour. **Test first.** |

### Workaround: Apply ALTER TYPE manually

If `prisma migrate deploy` fails on either of these two migrations, apply the enum additions manually and mark the migration as applied:

**Step 1 — Apply enum values manually (outside a transaction):**

```bash
psql $DATABASE_URL <<'SQL'
ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'TARGETS';
SQL

psql $DATABASE_URL <<'SQL'
ALTER TYPE "WorkflowDomain" ADD VALUE IF NOT EXISTS 'MEETINGS';
ALTER TYPE "WorkflowDomain" ADD VALUE IF NOT EXISTS 'INITIATIVES';
ALTER TYPE "WorkflowDomain" ADD VALUE IF NOT EXISTS 'TARGETS';
SQL
```

> Note: `IF NOT EXISTS` is supported from PostgreSQL 9.3+ and makes these statements idempotent.

**Step 2 — Apply the remaining SQL from each file** (skip the `ALTER TYPE` lines already run):

For `20260518120000`, the non-`ALTER TYPE` SQL is the `CREATE TYPE` + `CREATE TABLE` + `CREATE INDEX` + `ALTER TABLE … ADD CONSTRAINT` statements. You can paste the migration file contents minus the `ALTER TYPE` line.

For `20260518130000`, the remaining SQL is the `ALTER TABLE "Target" ADD COLUMN …` and `CREATE INDEX` statements.

**Step 3 — Mark migrations as applied in Prisma:**

```bash
DATABASE_URL="<stage-url>" npx prisma migrate resolve --applied 20260518120000_add_targets_module
DATABASE_URL="<stage-url>" npx prisma migrate resolve --applied 20260518130000_add_governance_foundation
```

**Step 4 — Resume normal deploy for remaining migrations:**

```bash
DATABASE_URL="<stage-url>" npx prisma migrate deploy
```

This will apply migrations `20260518140000`, `20260518150000`, `20260518160000` normally (none contain `ALTER TYPE … ADD VALUE`).

---

## Migration Safety Assessment

| Check | Result |
|-------|--------|
| Destructive operations (`DROP TABLE`, `DROP COLUMN`) | ✅ None |
| `ALTER COLUMN … SET NOT NULL` without default | ✅ None |
| New `NOT NULL` columns on populated tables | ✅ All have safe defaults (`DEFAULT 'DRAFT'`, `DEFAULT false`, `DEFAULT 0`) |
| Foreign keys | ✅ All `ON DELETE CASCADE` — no orphan risk |
| New models with no FKs to User | ⚠️ `reviewedByUserId` on Target/Meeting/Initiative is plain `TEXT`, not FK. Deleted user IDs may persist as dead references. Acceptable for phase 1. |
| Duplicate enum/model risk | ✅ None — all enums and models are genuinely new |
| JSONB columns | ✅ Nullable — no impact on existing rows |
| Migration order dependency | ✅ Migrations `20260518130000`–`20260518160000` depend on `ReviewWorkflowStage` (defined in `20260413101943_add_events_foundation`). Must already be applied. |

---

## Seed Command

Run after all migrations are applied:

```bash
DATABASE_URL="<stage-url>" npx tsx prisma/seed.ts
```

Or via the Prisma config seed command:

```bash
DATABASE_URL="<stage-url>" npx prisma db seed
```

### Seed Idempotency

The seed is safe to re-run multiple times:

| Entity | Strategy | Safe to re-run |
|--------|----------|----------------|
| Permissions | `upsert` by `key` | ✅ Yes |
| Roles | `upsert` by `key` | ✅ Yes |
| Role permissions | `upsert` by composite key | ✅ Yes |
| Seasons | `upsert` by `key` | ✅ Yes |
| Teams | `upsert` by `slug` | ✅ Yes |
| Team seasons | `upsert` by composite key | ✅ Yes |
| Demo events | `deleteMany` titles + `create` | ✅ Yes (demo events only) |
| Admin user | `upsert` by `email` | ✅ Yes |
| **Targets** (demo) | Skip if `moduleKey = "demo"` count > 0 | ✅ Yes |
| **Meetings** | `upsert` by `slug` | ✅ Yes |
| **Initiatives** | `upsert` by `slug` | ✅ Yes |

### What gets seeded

**Targets (3, seeded only once — skipped on re-run if demo targets exist):**

| Title | Category | Status | Metrics |
|-------|----------|--------|---------|
| Frauenfussball ausbauen | MITGLIEDERWACHSTUM | ACTIVE | 2 (Spielerinnen: 12/30, Teams: 0/2) |
| Sponsoring-Einnahmen steigern | FINANZEN | ACTIVE | 1 (CHF 18 500 / 30 000) |
| Junioren Techniktraining steigern | SPORTLICHE_ENTWICKLUNG | ACTIVE | 1 (25% / 40%) |

**Meetings (3, upserted by slug):**

| Slug | Title | Status | Date |
|------|-------|--------|------|
| `vorstandssitzung-april` | Vorstandssitzung April | COMPLETED | 16.04.2024 |
| `trainer-rapport-rueckrunde` | Trainer-Rapport Rückrunde | COMPLETED | 15.04.2024 |
| `medienkoordination-saisonstart` | Medienkoordination Saisonstart | COMPLETED | 10.04.2024 |

**Initiatives (3, upserted by slug):**

| Slug | Title | Status | Progress |
|------|-------|--------|----------|
| `website-relaunch` | Website Relaunch | IN_PROGRESS | 65% |
| `neues-clubhaus-konzept` | Neues Clubhaus Konzept | PLANNED | 10% |
| `sponsorenlauf-2025` | Sponsorenlauf 2025 | ON_TRACK | 80% |

---

## Routes to Verify After Migration + Seed

Log in as `admin@fcallschwil.ch` and verify these routes:

| Route | Expected |
|-------|----------|
| `/vereinsleitung` | Dashboard loads; VereinsleitungGoalsCard shows link to Ziele |
| `/vereinsleitung/targets` | 3 demo targets listed with progress bars and review stage badges |
| `/vereinsleitung/targets/[id]` | Detail page with governance sidebar, metrics, data point form |
| `/vereinsleitung/targets/new` | New target form + collapsible template catalog |
| `/vereinsleitung/meetings` | 3 meetings listed with date, attendee count, ReviewStageBadge |
| `/vereinsleitung/meetings/vorstandssitzung-april` | Detail page shows `MeetingGovernanceBanner` (DRAFT stage) + mock detail cards |
| `/vereinsleitung/initiativen` | 3 initiatives listed with progress bars and ReviewStageBadge |
| `/vereinsleitung/initiativen/website-relaunch` | Detail page shows `InitiativeGovernanceBanner` (DRAFT stage) + description + progress |

**API smoke tests (can use browser DevTools or curl):**

```bash
# List targets
curl -b <session-cookie> https://<stage-url>/api/targets

# List meetings
curl -b <session-cookie> https://<stage-url>/api/meetings

# List initiatives
curl -b <session-cookie> https://<stage-url>/api/initiatives
```

---

## Rollback Plan

> ⚠️ Rollback of applied migrations is not supported by Prisma and must be done manually.

**If a migration fails mid-way:**

1. Do NOT run `prisma migrate deploy` again without understanding the failure.
2. Check `prisma migrate status` to see which migrations applied.
3. Restore from the backup taken in the pre-migration checklist.
4. Investigate the failure, fix the migration or workaround (ALTER TYPE issue), then retry.

**If seed fails:**

The seed is idempotent — simply fix the error and re-run. No manual DB cleanup required unless the error left a partially-created record.

**Partial rollback of new tables only (if no backup):**

```sql
-- Emergency drop of new sprint tables (loses all data in these tables)
DROP TABLE IF EXISTS "TargetDataPoint";
DROP TABLE IF EXISTS "TargetMetric";
DROP TABLE IF EXISTS "Target";
DROP TABLE IF EXISTS "Meeting";
DROP TABLE IF EXISTS "Initiative";
DROP TYPE IF EXISTS "TargetCategory";
DROP TYPE IF EXISTS "TargetStatus";
DROP TYPE IF EXISTS "TargetPeriod";
DROP TYPE IF EXISTS "TargetMetricType";
DROP TYPE IF EXISTS "TargetDirection";
DROP TYPE IF EXISTS "MeetingStatus";
DROP TYPE IF EXISTS "InitiativeStatus";
-- Note: cannot easily reverse ALTER TYPE ADD VALUE in PostgreSQL
-- The PermissionModule and WorkflowDomain enum values TARGETS/MEETINGS/INITIATIVES
-- will remain; they are inert without the associated tables.
```

---

## Summary

1. Run `npx prisma migrate deploy` with the stage `DATABASE_URL`.
2. If it fails on `ALTER TYPE … ADD VALUE`, use the manual psql workaround above.
3. Resume with `npx prisma migrate deploy` for the remaining files.
4. Run `npx prisma db seed` (or `npx tsx prisma/seed.ts`).
5. Verify the 8 routes listed above.
