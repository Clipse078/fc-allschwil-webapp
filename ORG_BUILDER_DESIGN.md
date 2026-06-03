# Organisation Builder — Architecture Design Document

> Status: **DESIGN PHASE** — no implementation yet  
> Date: 2026-05-18  
> Principle: No AI. Deterministic platform intelligence.

---

## 1. Purpose Statement

The Organisation Builder is a **platform graph layer**, not a module.

Its purpose is to model the club's organisational structure in a way that every
existing platform system (Governance, Visibility, RBAC, Communication, Workflow)
can consume automatically, without each module needing to reinvent audience logic.

Today, visibility allowlists (`visibleRoleRefs`, `visibleUserRefs`, `visibleOrgUnitRefs`,
`visibleTeamRefs`, `visiblePersonRefs`) must be populated manually. The Org Builder
resolves them from the organisational graph instead.

**Before Org Builder:**
> "Who can see this meeting?" → creator picks users by hand from a dropdown.

**After Org Builder:**
> "Who can see this meeting?" → creator picks an audience group ("Vorstand",
> "Finance Committee") and all members resolve automatically from the graph.

---

## 2. Data Model Proposal

### 2.1 OrgUnit

The fundamental node in the graph. Flexible enough to model:
clubs, divisions, departments, sub-departments, committees, project groups, teams.

```prisma
model OrgUnit {
  id          String      @id @default(cuid())
  slug        String      @unique
  name        String
  type        OrgUnitType @default(DEPARTMENT)
  parentId    String?
  sortOrder   Int         @default(0)
  isActive    Boolean     @default(true)
  description String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  parent      OrgUnit?    @relation("OrgUnitHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children    OrgUnit[]   @relation("OrgUnitHierarchy")
  memberships OrgUnitMembership[]

  @@index([parentId])
  @@index([type, isActive])
}

enum OrgUnitType {
  CLUB           // Verein / Club (top-level, one per tenant in v1)
  DIVISION       // Abteilung (e.g. Fussball, Leichtathletik)
  DEPARTMENT     // Ressort (e.g. Vorstand, Marketing, Finanzen)
  COMMITTEE      // Ausschuss (e.g. Disziplinarkommission)
  TEAM           // Mannschaft (links to Team model later)
  PROJECT_GROUP  // Projektgruppe (temporary)
  CUSTOM         // Freie Organisationseinheit
}
```

### 2.2 OrgUnitMembership

Connects users and persons to org units, optionally with a role within that unit.

```prisma
model OrgUnitMembership {
  id         String                   @id @default(cuid())
  orgUnitId  String
  userId     String?
  personId   String?
  roleKey    String?   // role within the unit (e.g. "chair", "secretary")
  isPrimary  Boolean   @default(false)
  startDate  DateTime?
  endDate    DateTime?
  status     OrgUnitMembershipStatus  @default(ACTIVE)
  createdAt  DateTime                 @default(now())
  updatedAt  DateTime                 @updatedAt

  orgUnit    OrgUnit  @relation(...)

  @@index([orgUnitId])
  @@index([userId])
  @@index([personId])
  @@index([orgUnitId, status])
}

enum OrgUnitMembershipStatus {
  ACTIVE
  INACTIVE
  PENDING
}
```

### 2.3 TargetGroup (Reusable Audience Groups)

Named, reusable groups that resolve to a set of users/persons at query time.
These are the primary input to visibility, communication, and workflow routing.

```prisma
model TargetGroup {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?
  isActive    Boolean  @default(true)
  // Resolution rules stored as JSON (see Section 5)
  ruleJson    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isActive])
}
```

Example `ruleJson`:
```json
{
  "type": "union",
  "rules": [
    { "type": "orgUnit", "orgUnitId": "cuid-vorstand" },
    { "type": "orgUnit", "orgUnitId": "cuid-kassier" },
    { "type": "role", "roleKey": "super_admin" }
  ]
}
```

### 2.4 Role inheritance — v1 approach

Keep it simple. No complex inheritance graph in v1.

**v1 rule:**
- A user has roles assigned directly (existing `UserRole` model).
- A user may also have roles implied by their org unit membership (`roleKey` on `OrgUnitMembership`).
- `ActorContext` gains `orgUnitIds: string[]` derived at session time from membership.
- `canSeeEntity()` checks `visibleOrgUnitRefs` against `actor.orgUnitIds`.

**No recursive inheritance.** Parent org unit roles do NOT automatically flow to children in v1. That's Phase 2.

---

## 3. Relationship to Existing Platform Systems

### 3.1 Visibility

Today `visibleOrgUnitRefs Json?` exists on Meeting, Initiative, Target, CommunicationTemplate but is never populated (always null).

After Org Builder:
1. UI lets creator select org units from a picker (replaces manual user/role lists for RESTRICTED scope).
2. `canSeeEntity()` adds: `orgUnitIds = parseStringArray(entity.visibleOrgUnitRefs)` → check against `actor.orgUnitIds`.
3. `buildVisibilityWhere()` adds JSONB overlap check or in-app filter (same Phase 1 pattern as today).

The `visiblePersonRefs` field also activates when `personId` is on `ActorContext`.

### 3.2 RBAC

Guards (`requireMeetingAccess`, etc.) today check `actor.permissionKeys`. After Org Builder:
- `actor.orgUnitIds` added to `ActorContext` from `OrgUnitMembership` at session time.
- Guards can optionally check org-unit membership for write access (e.g. only Vorstand members can manage board meetings).

### 3.3 Communication

`resolveContext(moduleKey, entityId)` today returns entity fields.
After Org Builder, it can also resolve:
- audience groups from `TargetGroup`
- recipient lists for delivery from org unit membership

`POST /api/templates/[id]/preview` can accept `{ targetGroupId }` to resolve the recipient count and sample recipient context.

### 3.4 Workflow Routing

Future examples:
- New player registration → routes to `KiFu Coordinator` (resolved via OrgUnit type = COMMITTEE)
- Finance approval → routes to `Kassier` (resolved via org unit membership roleKey = "kassier")
- Meeting review → routes to users in `Vorstand` target group

Routing rules stored as `ruleJson` on workflow nodes (future sprint).

### 3.5 Meeting Sub-entities

`MeetingParticipant.userId` today is a nullable string.
After Org Builder: participants can be auto-populated from target group membership when creating a meeting, or manually added.

---

## 4. v1 Scope

### In scope for v1

- `OrgUnit` model + CRUD API
- `OrgUnitMembership` model + CRUD API
- `TargetGroup` model + simple static membership rules
- `ActorContext` extended: `orgUnitIds?: string[]` (loaded from memberships at session time or lazily)
- `canSeeEntity()` updated: activate `visibleOrgUnitRefs` check
- `buildVisibilityWhere()` updated: include org-unit-based filter
- Basic org unit picker in AllowlistPanel (for RESTRICTED scope selection)
- Org unit list page under admin settings
- Membership management (add/remove user from org unit)

### Not in scope for v1

- Role inheritance across parent/child hierarchy
- Dynamic audience resolution from TargetGroup rules at send time
- Workflow routing via org unit
- Mobile-aware membership
- Multi-tenant org graph isolation (comes after tenant model matures)
- OrgUnit ↔ Team model linking (Team already exists; linking is Phase 2)

---

## 5. Explicit Non-Goals

| Non-Goal | Why |
|----------|-----|
| Azure AD / LDAP integration | Overengineered for club scale; complexity far exceeds value |
| Recursive role inheritance | Creates invisible permission explosion; explicitly deferred |
| ACL matrix UI | SharePoint-style complexity violates UX principle |
| AI-powered org suggestions | No AI. Platform intelligence is deterministic. |
| Full multi-tenancy in v1 | Tenant model must mature independently first |
| Real-time membership sync | Club roster changes slowly; eventual consistency is fine |
| SCIM provisioning | Not a club-scale concern |

---

## 6. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `ActorContext.orgUnitIds` adds latency to every auth-gated request | Medium | Cache membership in JWT at login; refresh on membership change |
| `visibleOrgUnitRefs` JSONB overlap check is slow at scale | Low | In-app filter (current pattern) is fine for club scale; DB-side GIN index in Phase 2 |
| OrgUnit hierarchy depth becomes inconsistent | Medium | Enforce max depth = 3 in v1 UI; no recursive parent traversal |
| TargetGroup rule evaluation complexity | Medium | Keep v1 rules to: union of {orgUnitId, roleKey, userId} only; no nested logic |
| Membership endDate not enforced automatically | Low | Add nightly job to deactivate expired memberships; or filter at query time |
| OrgUnit ↔ Team Model coupling | Medium | Keep them separate in v1; link is optional FK in Phase 2 |
| Permission explosion via org-unit role inheritance | High if allowed | v1 explicitly blocks inheritance; direct assignment only |

---

## 7. Recommended Implementation Phases

### Phase 1 — Graph Foundation
1. Schema: `OrgUnit` + `OrgUnitMembership` + enums
2. Migration (safe: CREATE TYPE + CREATE TABLE)
3. `lib/org/queries.ts`: `getOrgUnits()`, `getMembershipsForUser(userId)`
4. API: `GET/POST /api/org-units`, `GET/PUT/DELETE /api/org-units/[id]`
5. API: `GET/POST /api/org-units/[id]/members`, `DELETE /api/org-units/[id]/members/[membershipId]`
6. `ActorContext` extended with `orgUnitIds` (loaded from `OrgUnitMembership`)
7. `canSeeEntity()` updated: activate `visibleOrgUnitRefs` check
8. Admin page: `/settings/org` — org unit list + member management

### Phase 2 — Visibility Integration
1. AllowlistPanel gains `VisibleOrgUnitsSelect` (beside VisibleRolesSelect + VisibleUsersSelect)
2. `buildVisibilityWhere()` updated with org-unit filter
3. Meeting/Initiative/Target visibility properly resolves org-unit memberships

### Phase 3 — TargetGroups
1. Schema: `TargetGroup` + `ruleJson`
2. API: CRUD + rule evaluation endpoint
3. Communication context resolver gains `{ targetGroupId }` support
4. AllowlistPanel gains TargetGroup selector

### Phase 4 — Workflow Routing
1. OrgUnit-based reviewer assignment for `requiresFourEyeReview`
2. `RoleWorkflowReviewAssignment` linked to OrgUnit memberships
3. Meeting participant auto-population from TargetGroup

---

## 8. First Coding Sprint Prompt

```
SPORTCLUBEVO — ORG BUILDER PHASE 1

GOAL
Implement the OrgUnit graph foundation:
- OrgUnit model
- OrgUnitMembership model
- CRUD API
- ActorContext.orgUnitIds extension
- canSeeEntity() update for visibleOrgUnitRefs

SCHEMA
Add:
- OrgUnitType enum (CLUB/DIVISION/DEPARTMENT/COMMITTEE/TEAM/PROJECT_GROUP/CUSTOM)
- OrgUnitMembershipStatus enum (ACTIVE/INACTIVE/PENDING)
- OrgUnit model (id, slug, name, type, parentId, sortOrder, isActive, description)
- OrgUnitMembership model (id, orgUnitId, userId, personId, roleKey, isPrimary,
  startDate, endDate, status)

MIGRATION
20260519000000_add_org_unit_graph
Pure CREATE TYPE + CREATE TABLE — transaction-safe.

GOVERNANCE
No VisibilityScope on OrgUnit in v1 — all org units are ORGANISATION-visible.
OrgUnitMembership is managed by super_admin or users with org.manage permission.

API
GET/POST /api/org-units
GET/PUT/DELETE /api/org-units/[id]
GET/POST /api/org-units/[id]/members
DELETE /api/org-units/[id]/members/[membershipId]

ACTOR CONTEXT
Add orgUnitIds?: string[] to ActorContext.
buildActorContext() derives it from OrgUnitMembership.findMany({ userId }).
Keep it as a lazy async load (not embedded in JWT yet).

VISIBILITY
canSeeEntity(): uncomment and activate the orgUnit check.
buildVisibilityWhere(): add RESTRICTED path for orgUnit filter (in-app).

ADMIN UI
/settings/org — org unit list with hierarchy view
/settings/org/[id] — member management

NO
- Role inheritance
- TargetGroups
- Workflow routing
- AI
- Multi-tenant isolation (deferred — see Slice 11.2 and 11.2b below)
```

---

## Slice 11.2 — Tenant Isolation Hardening (Complete, merged STAGE d41e66b)

- `OrgUnit.key` uniqueness changed from global `@unique` to tenant-scoped `@@unique([tenantId, key])`.
- All org-unit API routes and dashboard pages are now scoped to the resolved tenant.
- `loadOrgUnitIds(userId, tenantId?)` and `getActorContext(user, tenantId?)` accept tenant context.
- Cross-tenant access returns 404 (not 403, not 500) — existence not disclosed.
- `getDefaultTenant()` is retained as the current tenant resolver (session does not carry tenantId).

---

## Roadmap Item: Slice 11.2b — Session Tenant Context

**Goal:** `JWT → tenantId → ActorContext → Queries → APIs`

**Motivation:**
All org-unit (and other tenant-sensitive) code currently resolves tenant via `getDefaultTenant()`,
which hard-codes `DEFAULT_TENANT_KEY = "fc-allschwil"`. This is safe while SportClubEvo serves a
single club, but must be replaced before multi-tenant rollout.

**Required changes:**
1. Add `tenantId` to `User` model (FK to `Tenant`); assign on user creation.
2. Include `tenantId` in the JWT (populate in `auth.ts` `authorize` callback).
3. Include `tenantId` in the session callback so `session.user.tenantId` is available.
4. Update `requireApiPermission` return type to expose `session.user.tenantId`.
5. Update `requireAnyPermission` to return `tenantId` alongside the session.
6. Replace all `getDefaultTenant()` calls in org-unit (and other tenant-sensitive) paths
   with `getTenantById(session.user.tenantId)`.
7. Update `getActorContext` callers to pass `session.user.tenantId`.
8. Remove `DEFAULT_TENANT_KEY` from all tenant-sensitive request paths.
9. `getDefaultTenant()` may be retained only for legacy/bootstrap paths (e.g. seed scripts).

**Scope:** Auth, session, User model, all tenant-sensitive API routes and server components.

**Prerequisite:** `User.tenantId` must be populated before deploy; a backfill migration is needed.

---

## Operator Commands (Post-Merge)

```bash
# Apply all 11 sprint migrations (120000–220000)
DATABASE_URL="<stage>" npx prisma migrate deploy

# Manual workaround for ALTER TYPE ADD VALUE migrations if deploy fails:
# (120000, 130000, 190000, 220000 — all use IF NOT EXISTS in 190000 and 220000)
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TARGETS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE IF NOT EXISTS 'TARGETS';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TEMPLATES';"

# Mark fixed migrations as applied
DATABASE_URL="<stage>" npx prisma migrate resolve --applied 20260518120000_add_targets_module
DATABASE_URL="<stage>" npx prisma migrate resolve --applied 20260518130000_add_governance_foundation
DATABASE_URL="<stage>" npx prisma migrate resolve --applied 20260518190000_add_meeting_initiative_permission_modules
DATABASE_URL="<stage>" npx prisma migrate resolve --applied 20260518220000_add_templates_permission_module

# Resume deploy for remaining safe migrations
DATABASE_URL="<stage>" npx prisma migrate deploy

# Seed
DATABASE_URL="<stage>" npx prisma db seed
```
