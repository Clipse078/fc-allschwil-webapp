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

## Slice 11.6 — Target Groups Foundation (Complete, merged STAGE 9a3497f)

- `TargetGroup` model already in schema (since `20260518230000_add_org_builder_foundation`); application layer was missing.
- **Safety fix applied:** `TargetGroup.key` uniqueness corrected from global `@unique` to tenant-scoped `@@unique([tenantId, key])` — matching OrgUnit pattern from Slice 11.2. Migration `20260604063500_target_group_tenant_scoped_key` drops `TargetGroup_key_key` and creates `TargetGroup_tenantId_key_key`.
- `lib/org/queries.ts`: `getTargetGroups(tenantId?)`, `getTargetGroupById(id)`, `TargetGroupListItem` type added.
- `app/api/target-groups/route.ts`: GET (tenant-scoped list), POST (key auto-gen, `findFirst({ tenantId, key })` for uniqueness).
- `app/api/target-groups/[id]/route.ts`: GET + PATCH (`Prisma.DbNull` for ruleJson clear) + DELETE, all with tenant guard.
- Dashboard: list page, create page, detail/edit page (hero, inline edit, sidebar metadata, ruleJson viewer).
- `TargetGroupForm` component: name/key/description/status; key auto-gen from name; key locked in edit mode.
- Nav: `Zielgruppen` child item under Admin with `Target` icon; `AppTopNav` + `AdminPageHeader` metadata added.
- `ruleJson` stored as `Json?`; rule evaluation deferred to a later slice.
- `ORG_VIEW` → view access (dashboard pages). `ORG_MANAGE` → create/edit/delete (API routes). No auth changes.
- Migration `20260604063500_target_group_tenant_scoped_key` required (safe DDL: drop+create index only).
- `tsc --noEmit`: 0 errors. Build: clean (71 routes, +3). PR #91.

---

## Slice 11.4 — Membership Role Picker (Complete, merged STAGE b3b7c5f)

- `OrgMembershipPicker`: `<input type="text">` for `roleKey` replaced with `<select>` populated from all `Role` records (`id`, `key`, `name`); stores `role.key`, not `role.id`. Default option: `— Keine Rolle —`.
- `OrgMembershipManagementCard`: accepts `roles: RoleSummary[]` prop; `resolveRoleName(roleKey, roles)` resolves `roleKey` → `Role.name` for display with raw-key fallback for legacy free-text values; inline pencil-icon role edit per row → PATCH endpoint → `router.refresh()`.
- `/dashboard/org-units/[id]` page: `roles` loaded server-side in existing `Promise.all` (`prisma.role.findMany`); passed to `OrgMembershipManagementCard` — no client-side fetch, no extra API endpoints.
- `POST /api/org-units/[id]/memberships`: validates `roleKey` against `Role` table when non-empty; rejects unknown keys with HTTP 400.
- `PATCH /api/org-units/[id]/memberships/[membershipId]`: same `roleKey` validation.
- Permission system **unchanged**: `ActorContext.permissionKeys`, `UserRole`, `RolePermission` — all untouched. `roleKey` is organisational metadata only.
- No schema migration. `OrgUnitMembership.roleKey String?` field unchanged.
- Backward compatible: existing memberships without `roleKey` render without issue; legacy free-text `roleKey` values display as raw key fallback.
- `tsc --noEmit`: 0 errors. Build: clean (68 routes). No migration required.
- Merge commit: `b3b7c5f4511c34259f531f3a1089329edeb86779`. PR #90.

---

## Slice 11.2 — Tenant Isolation Hardening (Complete, merged STAGE d41e66b)

- `OrgUnit.key` uniqueness changed from global `@unique` to tenant-scoped `@@unique([tenantId, key])`.
- All org-unit API routes and dashboard pages are now scoped to the resolved tenant.
- `loadOrgUnitIds(userId, tenantId?)` and `getActorContext(user, tenantId?)` accept tenant context.
- Cross-tenant access returns 404 (not 403, not 500) — existence not disclosed.
- `getDefaultTenant()` is retained as the current tenant resolver (session does not carry tenantId).

---

## Slice 11.5 — Hierarchy Management (Complete, merged STAGE 8bb9cf6)

- `PUT /api/org-units/[id]`: `parentId` field accepted for re-parenting.
  - Self-reference guard (400), cycle detection via ancestor chain walk (400), cross-tenant guard (404), max-depth guard (400 if new level + subtree depth > 2), cascading `level` update to all descendants.
- `POST /api/org-units/[id]/sort`: new endpoint — `{ direction: "up" | "down" }` swaps `sortOrder` with adjacent sibling (same `parentId`, ordered by `sortOrder ASC, name ASC`). Boundary guard (400 at first/last). Equal-sortOrder disambiguation.
- `/dashboard/org-units/[id]` (server page): ancestor breadcrumb (root → … → current, linked), sibling reorder card (position N/total, up/down arrows, client mutation → `router.refresh()`). Siblings and ancestor chain loaded server-side.
- `OrgUnitSearchableList`: parent name shown (with `GitBranch` icon) for non-root units in search mode (level indent hidden during search).
- Runtime validation: 26/26 assertions passed on live Postgres — all 9 checks PASS.
- No schema changes. No migration required.
- Merge commit: `8bb9cf698148eee51961090ab814b9670f5c4973`. PR #89.

---

## Slice 11.3b — Team Create OrgUnit Picker (Complete, merged STAGE b00d287)

- `TeamCreateForm` extended with optional `Organisationseinheit` `<select>` picker (pre-selects nothing; clearable).
- `/dashboard/teams/new` page preloads tenant-scoped OrgUnits via `getOrgUnits(tenant?.id)` and passes as `availableOrgUnits` prop.
- `POST /api/teams`: accepts optional `orgUnitId`; validates against active tenant (403 cross-tenant, 404 not-found); persists on `team.create`. For `season_assignment` path, updates existing team's OrgUnit when non-null `orgUnitId` is provided.
- `PATCH /api/teams/[teamId]`: `orgUnitId` in body = set/clear; field absent from body = leave existing unchanged. Cross-tenant guard: 403; not-found: 404.
- `TeamSettingsCard.handleSave` now includes `orgUnitId: form.orgUnitId` in PATCH body — closes wiring gap from Slice 11.3 where the edit picker was rendered but did not persist.
- No schema changes. No migration. `Team.orgUnitId` FK was established in Slice 11.3.
- Merge commit: `b00d287d0c63a755694e91f3d1abf94aa1f33571`. PR #88.

---

## Slice 11.3 — Team ↔ OrgUnit Linking (Complete, merged STAGE 8e99d22)

- `Team.orgUnitId String?` FK → `OrgUnit.id`, `onDelete: SetNull`.
- `OrgUnit.teams Team[]` inverse relation added.
- `getTeamDetailData` now selects `orgUnitId` + `orgUnit { id, name, key, type }`.
- `getOrgUnitById` now selects `teams[]` with active season context.
- `/dashboard/teams/[teamId]` shows linked OrgUnit card or empty-state; includes OrgUnit picker in edit form.
- `/dashboard/org-units/[id]` shows Teams section with linked teams list or empty-state.
- `PATCH /api/teams/[teamId]` accepts `orgUnitId`, validates against active tenant (403 for cross-tenant, 404 for not-found).
- Migration `20260603200000_team_orgunit_bridge` applied to STAGE (Neon).
- Bridge is purely optional — no Team is forced to carry an `orgUnitId`.
- Hardening note: the 403 for cross-tenant orgUnitId may later be changed to 404 for non-disclosure consistency (currently 404 is used for cross-tenant OrgUnit page access per Slice 11.2, but 403 for PATCH is acceptable for now since it differentiates "not mine" from "not found").

---

## Tenant Branding Runtime Adoption (Complete, merged STAGE 1933b69)

- **Problem fixed:** `app/(admin)/layout.tsx` and `app/(admin)/dashboard/page.tsx` both called `getCurrentTenantContext()` with no argument, which hard-coded `DEFAULT_TENANT_KEY = "fc-allschwil"`. Tenant B users saw Tenant A branding.
- `lib/tenants/context.ts`: `getCurrentTenantContextById(id)` added (PK lookup, O(1)); `getTenantContextFromSession(tenantId?)` added (session-aware: PK lookup if tenantId present, `getCurrentTenantContext()` fallback for legacy JWTs).
- `app/(admin)/layout.tsx`: `getCurrentTenantContext()` → `getTenantContextFromSession(session.user.tenantId)`. Sidebar logo (`ctx.logoUrl`), club name (`ctx.name`), and CSS vars (`--tenant-primary`, `--tenant-secondary`) now per-user's tenant.
- `app/(admin)/dashboard/page.tsx`: `auth()` added; `getCurrentTenantContext()` → `getTenantContextFromSession(session?.user?.tenantId)`. Locale, timezone, season label now per-user's tenant.
- No schema changes. No migration. 3 files. tsc: 0 errors. Build: 71 routes. PR #93.

---

## Slice 11.2b — Session Tenant Context (Complete, merged STAGE b8dfc4b)

- `User.tenantId String?` FK → `Tenant.id` added (onDelete: SetNull). `Tenant.users User[]` inverse relation added.
- Migration `20260604064000_user_tenant_fk`: `ALTER TABLE "User" ADD COLUMN "tenantId" TEXT` (nullable); backfill `UPDATE "User" SET tenantId = fc-allschwil.id`; FK `User_tenantId_fkey` (SET NULL on delete); index `User_tenantId_idx`.
- `lib/tenants/queries.ts`: `getTenantById(id)` + `getTenantFromSession(tenantId?)` — uses `getTenantById` when tenantId present; falls back to `getDefaultTenant()` for null (legacy session safety).
- `types/next-auth.d.ts`: `tenantId?: string | null` added to `Session.user`, `User`, `JWT`.
- `auth.ts`: `authorize` reads `user.tenantId`; `jwt` callback stores on token; `session` callback surfaces as `session.user.tenantId`.
- 18 files migrated: 9 API routes + 9 dashboard server components — all `getDefaultTenant()` calls replaced with `getTenantFromSession(session.user?.tenantId)`.
- 0 remaining `getDefaultTenant()` calls in application paths (only in `lib/tenants/queries.ts` as internal fallback).
- Old-session safety: `getTenantFromSession(null)` → `getDefaultTenant()` → zero breakage for existing JWTs without tenantId.
- Tenant isolation confirmed: `getOrgUnits(tenant.id)`, `getTargetGroups(tenant.id)`, `requireOrgUnitForTenant`, `requireTargetGroupForTenant` all enforce `WHERE tenantId = resolved.id`.
- No permission changes. Migration required (safe additive DDL + backfill). PR #92.

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

## Slice 12.1 — Admin Branding Management UI (Complete, merged STAGE ff62f14)

**PR:** #94 | **Branch:** `cursor/admin-branding-ui-4b4f` → `STAGE`  
**Merge commit:** `ff62f14`

**Goal:** Self-service branding management for club admins (USERS_MANAGE) without requiring TENANTS_MANAGE.

**What was built:**
- `GET/PATCH /api/branding` — tenant resolved from `session.user.tenantId`; explicit tenantId guard (HTTP 401 if absent)
- `POST /api/branding/logo` — multipart upload; same permission + tenant isolation model
- `/dashboard/admin/branding` — server page; `requireAnyPermission([USERS_MANAGE])`
- `BrandingSettingsForm` — logo upload + URL field + color pickers + live `BrandingPreviewCard`
- Nav: `Darstellung` under Admin sidebar (Palette icon, USERS_MANAGE)
- "Darstellung" in AppTopNav + AdminPageHeader

**Key design decisions:**
- Tenant resolved from `session.user.tenantId` exclusively — no body override, no DEFAULT_TENANT_KEY fallback
- Explicit guard added before `getTenantFromSession()` call in all three routes
- Permission: `USERS_MANAGE` (club-admin level, not `TENANTS_MANAGE`)
- Build: 74 routes (+3), 0 tsc errors

---

## Slice 12.2 — Tenant Branding Audit + Non-Duplication Cleanup (Complete, merged STAGE 09dc5ed)

**PR:** #95 | **Branch:** `cursor/branding-audit-dedup-97c8` → `STAGE`  
**Merge commit:** `09dc5ed`

**Goal:** Eliminate all duplication in branding resolution logic; 100% canonical chain.

**New canonical helpers:**
- `lib/tenant-runtime/branding-patch.ts` — `parseBrandingPatch()`: single source of truth for PATCH body parsing across `/api/branding` and `/api/tenants/[slug]`
- `lib/assets/logo-upload.ts` — `executeLogoUpload()`: single source of truth for the multipart upload pipeline across `/api/branding/logo` and `/api/tenants/[slug]/logo`

**Changes:**
- Both PATCH routes now delegate branding field parsing to `parseBrandingPatch()`
- Both logo upload routes now delegate to `executeLogoUpload()`
- Both branding forms (`BrandingSettingsForm`, `TenantConfigForm`) init via `resolveTenantBranding(defaultValues)` instead of `?? PLATFORM_BRANDING`
- `TenantConfigForm` gains `isValidHexColor` client-side validation before submit (parity)
- Dead code removed: `tenantCssVarString()` (theme.ts), `getTenantLogoPublicPath()` (tenant-paths.ts)

**Build:** 74 routes, 0 tsc errors

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
