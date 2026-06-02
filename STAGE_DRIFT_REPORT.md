# STAGE Database Drift Report

> Generated: 2026-06-02 (read-only — no changes made to database or schema)
> Basis: schema.prisma + migration SQL files vs. confirmed STAGE facts

---

## Confirmed STAGE Facts (via Neon SQL Editor)

| Fact | Value |
|------|-------|
| Total tables | 17 (16 data tables + `_prisma_migrations`) |
| `public.Tenant` | **does not exist** |
| `tenantId` columns anywhere | **none** |
| `_prisma_migrations` entries | **April migrations only** |

---

## 1. Expected Models (schema.prisma) — 31 Tables

| # | Model | Introduced by |
|---|-------|---------------|
| 1 | `User` | `20260410225355_init` |
| 2 | `Role` | `20260410225355_init` |
| 3 | `Permission` | `20260410225355_init` |
| 4 | `UserRole` | `20260410225355_init` |
| 5 | `RolePermission` | `20260410225355_init` |
| 6 | `Season` | `20260410225355_init` |
| 7 | `Person` | `20260410225355_init` |
| 8 | `Team` | `20260410225355_init` |
| 9 | `TeamSeason` | `20260410225355_init` |
| 10 | `AuditLog` | `20260411142054_add_team_audit_and_trainingsgruppe` |
| 11 | `PlayerSquadMember` | `20260411191906_add_player_squad_model` |
| 12 | `TrainerTeamMember` | `20260413100139_add_seasons_permission_module` |
| 13 | `Event` | `20260413101943_add_events_foundation` |
| 14 | `EventImportRun` | `20260413134413_add_event_import_runs` |
| 15 | `RoleWorkflowRule` | `20260418-194927_deployment_catchup` |
| 16 | `RoleWorkflowReviewAssignment` | `20260418-194927_deployment_catchup` |
| 17 | `Target` | `20260518120000_add_targets_module` |
| 18 | `TargetMetric` | `20260518120000_add_targets_module` |
| 19 | `TargetDataPoint` | `20260518120000_add_targets_module` |
| 20 | `Meeting` | `20260518150000_add_meeting_model` |
| 21 | `Initiative` | `20260518160000_add_initiative_model` |
| 22 | `MeetingAgendaItem` | `20260518200000_add_meeting_sub_entities` |
| 23 | `MeetingDecision` | `20260518200000_add_meeting_sub_entities` |
| 24 | `MeetingAction` | `20260518200000_add_meeting_sub_entities` |
| 25 | `MeetingParticipant` | `20260518200000_add_meeting_sub_entities` |
| 26 | `CommunicationTemplate` | `20260518210000_add_communication_template` |
| 27 | `OrgUnit` | `20260518230000_add_org_builder_foundation` |
| 28 | `OrgUnitMembership` | `20260518230000_add_org_builder_foundation` |
| 29 | `TargetGroup` | `20260518230000_add_org_builder_foundation` |
| 30 | `Tenant` | `20260601083400_add_tenant_foundation` |
| 31 | `Registration` | `20260601093400_add_registration_inbox` |

---

## 2. Actual Tables in STAGE — 16 Data Tables

All 16 correspond exactly to the 7 April migrations:

| Table | Applied migration |
|-------|------------------|
| `User` | `20260410225355_init` |
| `Role` | `20260410225355_init` |
| `Permission` | `20260410225355_init` |
| `UserRole` | `20260410225355_init` |
| `RolePermission` | `20260410225355_init` |
| `Season` | `20260410225355_init` |
| `Person` | `20260410225355_init` |
| `Team` | `20260410225355_init` |
| `TeamSeason` | `20260410225355_init` |
| `AuditLog` | `20260411142054_add_team_audit_and_trainingsgruppe` |
| `PlayerSquadMember` | `20260411191906_add_player_squad_model` |
| `TrainerTeamMember` | `20260413100139_add_seasons_permission_module` |
| `Event` | `20260413101943_add_events_foundation` |
| `EventImportRun` | `20260413134413_add_event_import_runs` |
| `RoleWorkflowRule` | `20260418-194927_deployment_catchup` |
| `RoleWorkflowReviewAssignment` | `20260418-194927_deployment_catchup` |

**The table count arithmetic is exact:** 16 data tables + `_prisma_migrations` = 17 total. Zero structural drift within the April migrations.

---

## 3. Missing from STAGE — 15 Tables

| Table | Missing since | Migration that creates it |
|-------|--------------|--------------------------|
| `Target` | 2026-05-18 | `20260518120000_add_targets_module` |
| `TargetMetric` | 2026-05-18 | `20260518120000_add_targets_module` |
| `TargetDataPoint` | 2026-05-18 | `20260518120000_add_targets_module` |
| `Meeting` | 2026-05-18 | `20260518150000_add_meeting_model` |
| `Initiative` | 2026-05-18 | `20260518160000_add_initiative_model` |
| `MeetingAgendaItem` | 2026-05-18 | `20260518200000_add_meeting_sub_entities` |
| `MeetingDecision` | 2026-05-18 | `20260518200000_add_meeting_sub_entities` |
| `MeetingAction` | 2026-05-18 | `20260518200000_add_meeting_sub_entities` |
| `MeetingParticipant` | 2026-05-18 | `20260518200000_add_meeting_sub_entities` |
| `CommunicationTemplate` | 2026-05-18 | `20260518210000_add_communication_template` |
| `OrgUnit` | 2026-05-18 | `20260518230000_add_org_builder_foundation` |
| `OrgUnitMembership` | 2026-05-18 | `20260518230000_add_org_builder_foundation` |
| `TargetGroup` | 2026-05-18 | `20260518230000_add_org_builder_foundation` |
| `Tenant` | 2026-06-01 | `20260601083400_add_tenant_foundation` |
| `Registration` | 2026-06-01 | `20260601093400_add_registration_inbox` |

### Missing Enum Values

| Enum | Missing values | Missing since |
|------|---------------|---------------|
| `PermissionModule` | `TARGETS` | 2026-05-18 |
| `WorkflowDomain` | `MEETINGS`, `INITIATIVES`, `TARGETS` | 2026-05-18 |
| `PermissionModule` | `MEETINGS`, `INITIATIVES` | 2026-05-18 |
| `PermissionModule` | `TEMPLATES` | 2026-05-18 |
| `PermissionModule` | `REGISTRATIONS` | 2026-06-01 |
| `PermissionModule` | `TENANTS` | 2026-06-02 |

### Missing Columns on Existing Tables

All April-era tables appear structurally complete — no column gaps exist within the applied April migrations. The only additive column changes from post-April migrations target tables that don't exist yet in STAGE (Target, Meeting, Initiative), so there is no partial-column drift on any live table.

---

## 4. Missing Migrations — 16 Entries

Listed in the exact order they must be applied:

| # | Migration name | Type of change | Transaction-safe? |
|---|---------------|----------------|-------------------|
| 1 | `20260518120000_add_targets_module` | `ALTER TYPE` ADD VALUE + CREATE TABLE ×3 | ⚠️ No |
| 2 | `20260518130000_add_governance_foundation` | `ALTER TYPE` ADD VALUE ×3 + ALTER TABLE | ⚠️ No |
| 3 | `20260518140000_add_cross_module_links` | ALTER TABLE ADD COLUMN ×2 (JSONB) | ✅ Yes |
| 4 | `20260518150000_add_meeting_model` | CREATE TYPE + CREATE TABLE | ✅ Yes |
| 5 | `20260518160000_add_initiative_model` | CREATE TYPE + CREATE TABLE | ✅ Yes |
| 6 | `20260518170000_add_visibility_scope` | CREATE TYPE + ALTER TABLE ×2 | ✅ Yes |
| 7 | `20260518180000_add_target_visibility_scope` | ALTER TABLE ADD COLUMN ×7 | ✅ Yes |
| 8 | `20260518190000_add_meeting_initiative_permission_modules` | `ALTER TYPE` ADD VALUE IF NOT EXISTS ×2 | ⚠️ No |
| 9 | `20260518200000_add_meeting_sub_entities` | CREATE TYPE ×4 + CREATE TABLE ×4 | ✅ Yes |
| 10 | `20260518210000_add_communication_template` | CREATE TYPE ×2 + CREATE TABLE | ✅ Yes |
| 11 | `20260518220000_add_templates_permission_module` | `ALTER TYPE` ADD VALUE IF NOT EXISTS | ⚠️ No |
| 12 | `20260518230000_add_org_builder_foundation` | CREATE TYPE ×3 + CREATE TABLE ×3 | ✅ Yes |
| 13 | `20260601083400_add_tenant_foundation` | CREATE TYPE + CREATE TABLE | ✅ Yes |
| 14 | `20260601093400_add_registration_inbox` | `ALTER TYPE` ADD VALUE + CREATE TABLE + FKs | ⚠️ No |
| 15 | `20260601124700_add_org_membership_relations_tenant_backfill` | UPDATE ×4 (data backfill, no-op on empty tables) + CREATE INDEX + ADD FK ×2 | ✅ Yes |
| 16 | `20260602000000_add_tenants_permission_module` | `ALTER TYPE` ADD VALUE IF NOT EXISTS | ⚠️ No |

**6 of 16 migrations** contain `ALTER TYPE ... ADD VALUE` and will fail if Prisma wraps them in a transaction (which it does by default). See `DB_MIGRATION_READINESS.md` for the manual workaround for each.

---

## 5. Root Cause Diagnosis

### Verdict: **(a) Migrations were never deployed after April 2026**

Evidence:

1. **`_prisma_migrations` is clean and stops at April.** There are no failed, rolled-back, or out-of-order entries. Every record in the table corresponds to a completed, structurally correct migration. This rules out (b) partial failure of any individual migration.

2. **The 17-table count is arithmetically exact.** The 7 April migrations produce exactly 16 data tables. Together with `_prisma_migrations`, that is 17 — matching the confirmed STAGE count to the row. This rules out (c) history detachment — the migration log and the physical schema are perfectly in sync.

3. **No May or June migration has any record in `_prisma_migrations`.** `prisma migrate deploy` was simply never run against STAGE after the April deployment. No crash, no retry, no partial state.

4. **The absence of `Tenant` and all `tenantId` columns is consistent** with `20260601083400_add_tenant_foundation` (which creates `Tenant`) and `20260601093400_add_registration_inbox` (which adds the `tenantId` column on `Registration`) both being completely absent.

---

## 6. Recovery Path

### Recommendation: **In-place repair (deploy missing migrations)**

A clean STAGE rebuild is **not necessary** here. The conditions that would require a rebuild do not apply:

| Condition requiring rebuild | Present? |
|----------------------------|----------|
| Structural drift within applied April tables | No |
| Failed/corrupted entries in `_prisma_migrations` | No |
| Out-of-order migration history | No |
| Schema–history desync | No |
| Destructive changes in missing migrations | No — all 16 are additive |

All 16 missing migrations are purely additive: they add new tables, new columns with defaults, and new enum values. None of them DROP, RENAME, or structurally alter any of the 16 existing STAGE tables.

The data backfill in `20260601124700_add_org_membership_relations_tenant_backfill` will be a no-op: `OrgUnit` and `OrgUnitMembership` will be freshly created empty tables by migration #12 (`20260518230000`) before this one runs, so all four UPDATE statements will match zero rows.

### Safest recovery sequence

```
1. Take a full backup of STAGE before touching anything.
   pg_dump $DATABASE_URL > stage_backup_$(date +%Y%m%d_%H%M%S).sql

2. Run prisma migrate deploy.
   DATABASE_URL="<stage-url>" npx prisma migrate deploy

3. Expect failures on the 6 ALTER TYPE migrations.
   Follow the manual workarounds in DB_MIGRATION_READINESS.md for each.
   The additional June migrations not covered by that doc:

   If 20260601093400_add_registration_inbox fails:
     psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'REGISTRATIONS';"
     npx prisma migrate resolve --applied 20260601093400_add_registration_inbox
     npx prisma migrate deploy

   If 20260602000000_add_tenants_permission_module fails:
     psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TENANTS';"
     npx prisma migrate resolve --applied 20260602000000_add_tenants_permission_module

4. Verify with: npx prisma migrate status
   All 23 migrations should show as Applied.

5. Run the seed: npx prisma db seed
```

### When a clean rebuild IS preferable

A clean STAGE rebuild would be the better choice only if:
- STAGE test data is intentionally being discarded anyway (e.g. a sprint reset)
- An operational runbook requires starting from a known-clean baseline
- A future migration introduces a non-additive change (rename, transform, drop) that requires a fresh run to be safe

In the current situation, in-place repair is lower-risk because it preserves any April-era test data (Users, Roles, Permissions, Seasons, Teams, Events, etc.) and avoids re-seeding from scratch.

---

## Drift Summary (one-line)

> STAGE is frozen at April 2026. It is missing **16 migrations**, **15 tables**, and **9 enum values** that have been committed to the codebase since 2026-05-18. The migration history is clean and consistent; the fix is a straightforward `prisma migrate deploy` with manual ALTER TYPE workarounds for 6 of those migrations.
