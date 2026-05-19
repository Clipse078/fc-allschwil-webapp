# DB Migration & Seed Readiness

> Sprint: Governance Hardening
> Date: 2026-05-19
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
- [ ] Confirm PostgreSQL version ≥ 13.

---

## Migration Order — All Sprint Migrations

All migrations must be applied in strict ascending timestamp order.

### Pre-existing (must already be applied before sprint migrations)

| Timestamp | Name | Notes |
|-----------|------|-------|
| `20260410225355` | `init` | Base schema — User, Role, Permission, Season, Person, Team, TeamSeason |
| `20260411142054` | `add_team_audit_and_trainingsgruppe` | `ALTER TYPE TeamCategory ADD VALUE 'TRAININGSGRUPPE'` ⚠️; AuditLog table |
| `20260411191906` | `add_player_squad_model` | PlayerSquadMember table |
| `20260413100139` | `add_seasons_permission_module` | `ALTER TYPE PermissionModule ADD VALUE 'SEASONS'` ⚠️; TrainerTeamMember |
| `20260413101943` | `add_events_foundation` | `ALTER TYPE PermissionModule ADD VALUE 'EVENTS'` ⚠️; **defines ReviewWorkflowStage enum** |
| `20260413134413` | `add_event_import_runs` | EventImportRun table |
| `20260418-194927` | `deployment_catchup` | WorkflowDomain / WorkflowAction enums; RoleWorkflowRule / RoleWorkflowReviewAssignment |

### Sprint migrations (apply in this exact order)

| # | Timestamp | Name | Key operations | Transaction-safe? |
|---|-----------|------|----------------|-------------------|
| 1 | `20260518120000` | `add_targets_module` | `ALTER TYPE PermissionModule ADD VALUE 'TARGETS'` ⚠️; 5 CREATE TYPE; Target / TargetMetric / TargetDataPoint tables | ⚠️ No — ALTER TYPE |
| 2 | `20260518130000` | `add_governance_foundation` | `ALTER TYPE WorkflowDomain ADD VALUE 'MEETINGS'/'INITIATIVES'/'TARGETS'` ⚠️; ADD COLUMN governance fields to Target | ⚠️ No — ALTER TYPE |
| 3 | `20260518140000` | `add_cross_module_links` | ADD COLUMN linkedInitiativeRefs / linkedMeetingRefs (JSONB) to Target | ✅ Yes |
| 4 | `20260518150000` | `add_meeting_model` | CREATE TYPE MeetingStatus; CREATE TABLE Meeting | ✅ Yes |
| 5 | `20260518160000` | `add_initiative_model` | CREATE TYPE InitiativeStatus; CREATE TABLE Initiative | ✅ Yes |
| 6 | `20260518170000` | `add_visibility_scope` | CREATE TYPE VisibilityScope; ADD COLUMN visibility fields to Meeting + Initiative | ✅ Yes |
| 7 | `20260518180000` | `add_target_visibility_scope` | ADD COLUMN visibility fields to Target | ✅ Yes |
| 8 | `20260518190000` | `add_meeting_initiative_permission_modules` | `ALTER TYPE PermissionModule ADD VALUE IF NOT EXISTS 'MEETINGS'/'INITIATIVES'` ⚠️ | ⚠️ No — ALTER TYPE |
| 9 | `20260518200000` | `add_meeting_sub_entities` | 4 CREATE TYPE; MeetingAgendaItem / MeetingDecision / MeetingAction / MeetingParticipant tables | ✅ Yes |
| 10 | `20260518210000` | `add_communication_template` | 2 CREATE TYPE; CommunicationTemplate table | ✅ Yes |
| 11 | `20260518220000` | `add_templates_permission_module` | `ALTER TYPE PermissionModule ADD VALUE IF NOT EXISTS 'TEMPLATES'` ⚠️ | ⚠️ No — ALTER TYPE |
| 12 | `20260518230000` | `add_org_builder_foundation` | 3 CREATE TYPE; OrgUnit / OrgUnitMembership / TargetGroup tables | ✅ Yes |

**All operations are additive. No DROP, no destructive transforms, no renames.**

---

## Standard Deploy Command

```bash
DATABASE_URL="<your-stage-db-url>" npx prisma migrate deploy
```

This applies all pending migrations in order. If it fails on an ALTER TYPE migration, use the manual workaround below.

---

## ⚠️ ALTER TYPE … ADD VALUE — Manual Workaround

PostgreSQL cannot execute `ALTER TYPE ... ADD VALUE` inside a transaction block. Prisma wraps each migration in a transaction, so these will fail. There are **5 affected migrations** across the full sprint chain.

### If `prisma migrate deploy` fails on `20260518120000`

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE 'TARGETS';"
npx prisma migrate resolve --applied 20260518120000_add_targets_module
```

### If it fails on `20260518130000`

```bash
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE 'TARGETS';"
npx prisma migrate resolve --applied 20260518130000_add_governance_foundation
```

### If it fails on `20260518190000`

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
npx prisma migrate resolve --applied 20260518190000_add_meeting_initiative_permission_modules
```

### If it fails on `20260518220000`

```bash
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TEMPLATES';"
npx prisma migrate resolve --applied 20260518220000_add_templates_permission_module
```

After each manual step, resume with `npx prisma migrate deploy` to continue with the remaining files.

---

## Seed

```bash
# Standard (uses DATABASE_URL from .env):
npx prisma db seed

# Or directly:
npx tsx prisma/seed.ts
```

The seed is idempotent and safe to re-run at any time.

### Seed coverage

| Entity | Strategy | Re-run safe |
|--------|----------|-------------|
| Permissions | `upsert` by `key` | ✅ |
| Roles | `upsert` by `key` | ✅ |
| Role permissions | `upsert` by composite key | ✅ |
| Seasons | `upsert` by `key` | ✅ |
| Teams | `upsert` by `slug` | ✅ |
| Team seasons | `upsert` by composite key | ✅ |
| Demo events | `deleteMany` matching titles + `create` | ✅ |
| Admin user | `upsert` by `email` | ✅ |
| Targets (3 demo) | Skip if `moduleKey = "demo"` count > 0 | ✅ |
| Meetings (3 demo) | `upsert` by `slug` | ✅ |
| Initiatives (3 demo) | `upsert` by `slug` | ✅ |
| OrgUnits (2 demo) | `upsert` by `key` | ✅ |
| CommunicationTemplates (2 demo) | `upsert` by `slug` | ✅ |

### What gets seeded (strategic modules)

**Targets** (seeded only once — skipped on re-run if demo targets exist):

| Title | Category | Status |
|-------|----------|--------|
| Frauenfussball ausbauen | MITGLIEDERWACHSTUM | ACTIVE |
| Sponsoring-Einnahmen steigern | FINANZEN | ACTIVE |
| Junioren Techniktraining steigern | SPORTLICHE_ENTWICKLUNG | ACTIVE |

**Meetings** (upserted by slug):

| Slug | Title | Status |
|------|-------|--------|
| `vorstandssitzung-april` | Vorstandssitzung April | COMPLETED |
| `trainer-rapport-rueckrunde` | Trainer-Rapport Rückrunde | COMPLETED |
| `medienkoordination-saisonstart` | Medienkoordination Saisonstart | COMPLETED |

**Initiatives** (upserted by slug):

| Slug | Title | Status |
|------|-------|--------|
| `website-relaunch` | Website Relaunch | IN_PROGRESS |
| `neues-clubhaus-konzept` | Neues Clubhaus Konzept | PLANNED |
| `sponsorenlauf-2025` | Sponsorenlauf 2025 | ON_TRACK |

**OrgUnits** (upserted by key):

| Key | Name | Type |
|-----|------|------|
| `vorstand` | Vorstand | COMMITTEE |
| `sportkommission` | Sportkommission | COMMITTEE |

**CommunicationTemplates** (upserted by slug):

| Slug | Title | Category |
|------|-------|----------|
| `einladung-vorstandssitzung` | Einladung Vorstandssitzung | MEETING_FOLLOWUP |
| `update-initiative` | Initiative Update | INITIATIVE_UPDATE |

---

## Routes to Verify After Migration + Seed

Log in as `admin@fcallschwil.ch` and verify:

### Strategic modules

| Route | Expected |
|-------|----------|
| `/vereinsleitung` | Dashboard loads; KPI cards show counts |
| `/vereinsleitung/targets` | 3 demo targets with progress bars + ReviewStageBadge |
| `/vereinsleitung/targets/[id]` | Detail with governance sidebar + metrics + data point form |
| `/vereinsleitung/targets/new` | New target form + template catalog |
| `/vereinsleitung/meetings` | 3 demo meetings with date + ReviewStageBadge |
| `/vereinsleitung/meetings/vorstandssitzung-april` | Detail with MeetingGovernanceBanner |
| `/vereinsleitung/initiativen` | 3 demo initiatives with progress + ReviewStageBadge |
| `/vereinsleitung/initiativen/website-relaunch` | Detail with InitiativeGovernanceBanner |
| `/vereinsleitung/templates` | 2 demo templates listed |
| `/vereinsleitung/templates/new` | New template form |

### Org Builder

| Route | Expected |
|-------|----------|
| `/dashboard/org-units` | 2 demo org units listed (Vorstand, Sportkommission) |
| `/dashboard/org-units/new` | New org unit form |

### API smoke tests

```bash
# Requires a valid session cookie from browser DevTools

# Strategic modules (GET = session only, visibility-filtered)
curl -b "<session>" https://<stage>/api/targets
curl -b "<session>" https://<stage>/api/meetings
curl -b "<session>" https://<stage>/api/initiatives
curl -b "<session>" https://<stage>/api/templates

# Org units
curl -b "<session>" https://<stage>/api/org-units

# Permission guard on create — expect 403 from a session without *.manage
curl -b "<session>" -X POST https://<stage>/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","meetingDate":"2026-06-01"}'
```

### Visibility smoke test

1. Create a second test user without `meetings.manage` permission.
2. Create a meeting with `visibilityScope = RESTRICTED` + the admin user's role in `visibleRoleRefs`.
3. Log in as the second user — the restricted meeting should NOT appear in the list.
4. Add the second user's userId to `visibleUserRefs` — it SHOULD now appear.

### Governance stage transition smoke test

1. Create a target with `requiresFourEyeReview = true`.
2. Submit it to `SUBMITTED` stage (POST as creator).
3. Try to advance to `APPROVED` as the same creator — expect 403.
4. Advance to `APPROVED` as a different admin user — expect 200.

---

## Rollback Plan

> ⚠️ Prisma does not support rollback of applied migrations. Always restore from backup.

**If a migration fails mid-way:**

1. Do NOT re-run `prisma migrate deploy` without understanding the failure.
2. Check `prisma migrate status` to see which migrations applied.
3. Restore from the backup taken in the pre-migration checklist.
4. Apply the ALTER TYPE manually if needed, then mark resolved.

**Emergency drop of sprint tables only (last resort — data loss):**

```sql
-- Sub-entities first (FK dependents)
DROP TABLE IF EXISTS "MeetingParticipant";
DROP TABLE IF EXISTS "MeetingAction";
DROP TABLE IF EXISTS "MeetingDecision";
DROP TABLE IF EXISTS "MeetingAgendaItem";
DROP TABLE IF EXISTS "OrgUnitMembership";
DROP TABLE IF EXISTS "OrgUnit";
DROP TABLE IF EXISTS "TargetGroup";
DROP TABLE IF EXISTS "TargetDataPoint";
DROP TABLE IF EXISTS "TargetMetric";
DROP TABLE IF EXISTS "Target";
DROP TABLE IF EXISTS "Meeting";
DROP TABLE IF EXISTS "Initiative";
DROP TABLE IF EXISTS "CommunicationTemplate";

-- Enums (safe — not referenced once tables are gone)
DROP TYPE IF EXISTS "MeetingParticipantStatus";
DROP TYPE IF EXISTS "MeetingActionStatus";
DROP TYPE IF EXISTS "MeetingDecisionStatus";
DROP TYPE IF EXISTS "MeetingAgendaItemStatus";
DROP TYPE IF EXISTS "OrgUnitMembershipStatus";
DROP TYPE IF EXISTS "OrgUnitStatus";
DROP TYPE IF EXISTS "OrgUnitType";
DROP TYPE IF EXISTS "CommunicationTemplateStatus";
DROP TYPE IF EXISTS "CommunicationTemplateCategory";
DROP TYPE IF EXISTS "TargetDirection";
DROP TYPE IF EXISTS "TargetMetricType";
DROP TYPE IF EXISTS "TargetPeriod";
DROP TYPE IF EXISTS "TargetStatus";
DROP TYPE IF EXISTS "TargetCategory";
DROP TYPE IF EXISTS "MeetingStatus";
DROP TYPE IF EXISTS "InitiativeStatus";
DROP TYPE IF EXISTS "VisibilityScope";

-- Note: PermissionModule / WorkflowDomain enum values (TARGETS, MEETINGS,
-- INITIATIVES, TEMPLATES) cannot be removed in PostgreSQL. They are inert
-- without the associated tables.
```

---

## Summary

```
1.  Take a database backup.
2.  Run:  DATABASE_URL="..." npx prisma migrate deploy
3.  On ALTER TYPE failure: apply manually via psql, then prisma migrate resolve --applied <name>
4.  Resume:  npx prisma migrate deploy
5.  Seed:  npx prisma db seed
6.  Verify routes in the checklist above.
```
