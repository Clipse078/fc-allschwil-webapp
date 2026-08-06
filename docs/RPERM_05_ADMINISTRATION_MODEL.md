# RPERM-05 — Roles & Permissions Administration Model

**Status:** Implemented
**Depends on:** RPERM-02 (schema foundation), RPERM-03 (`EffectivePermissionResolver`),
RPERM-04 (canonical tenant context / `TenantMembership`)

This document explains the administration model delivered by RPERM-05: the first
complete Roles & Permissions management UI for SportClubEvo, built entirely on the
existing, already-accepted authorization foundation (`Role`, `Permission`,
`RolePermission`, `UserRole`, `TenantMembership`, `Role.scope`, `Permission.scope`,
`EffectivePermissionResolver`). No part of that foundation was redesigned or replaced.

## 1. Platform vs. tenant role management — two separate surfaces

| | Platform | Tenant |
|---|---|---|
| Route | `/dashboard/roles`, `/dashboard/roles/[id]`, `/dashboard/permissions` | `/dashboard/administration/roles` (+ `/new`, `/[id]`, `/assignments`, `/effective-access`) |
| Nav entry | "Rollen" (Administration → Rollen) | "Rollen & Berechtigungen" (Administration → Rollen & Berechtigungen) |
| Gate | `PERMISSIONS.USERS_MANAGE` (PLATFORM permission) | `roles.view` / `roles.manage` (TENANT permissions), checked against the caller's own `activeTenantId` |
| Query scope | `Role.scope === "PLATFORM"` only (RPERM-05 fix — previously unscoped) | `Role.scope === "TENANT" AND Role.tenantId === <caller's active tenant>` only |
| API | `/api/roles/**` (RPERM-05 fix: every lookup now filters `scope: "PLATFORM"`) | `/api/tenant/roles/**`, `/api/tenant/members`, `/api/tenant/effective-access` |

These are two **independent** code paths — the tenant module (`lib/roles/tenant-queries.ts`,
`lib/roles/mutations.ts`) never reads or writes a PLATFORM role, and the platform module
(`lib/roles/queries.ts`, `/api/roles/**`) never reads or writes a TENANT role. A platform
Super Admin without a tenant membership resolves no `activeTenantId` and is redirected
before any tenant role data is ever fetched (`requireActiveTenantId()` in
`app/(admin)/dashboard/administration/roles/layout.tsx`). Holding `USERS_MANAGE` never
implies tenant role access, and holding `roles.manage` in one tenant never implies
access to another tenant's roles or to any PLATFORM role — both because
`EffectivePermissionResolver` already enforces this (RPERM-03) and because every new
query/mutation in this slice re-derives and re-checks `tenantId` and `scope` from the
database on every call.

## 2. Tenant id and permission resolution — always server-side, always live

Every RPERM-05 page and API route follows the exact same two-step gate:

```ts
const tenantId = await requireActiveTenantId();       // never a client-submitted value
await requireAnyPermission(TENANT_ROLES_VIEW, tenantId); // live EffectivePermissionResolver check
```

(API routes use the equivalent `requireTenantRoleApiContext()` helper in
`lib/roles/api-context.ts`, which combines `requireApiAnyPermission` with the session's
`activeTenantId`.) No handler ever reads `tenantId`, `roleId`'s scope, `tenantId`'s
ownership, or "is this role protected" from the request body — every one of those facts
is re-derived from the database inside `lib/roles/mutations.ts`/`lib/roles/tenant-queries.ts`
on every call. A request body attempting to set `scope: "PLATFORM"` or a different
`tenantId` is simply ignored (there is no code path that reads those fields for those
purposes), not merely rejected.

## 3. Permission grouping — presentation only

The permission matrix (`components/admin/roles/PermissionMatrixFields.tsx`) groups
permissions by `Permission.module` (the existing `PermissionModule` enum) purely for
layout. Every checkbox corresponds to one real, individually-addressable
`Permission.key`; a bulk "select all" / "clear" action in a module toggles exactly the
`Permission.key`s that belong to that module — there is no separate, opaque "module
access" boolean anywhere. The persisted authorization fact is always a `RolePermission`
row, resolved live by `EffectivePermissionResolver`. `lib/roles/module-labels.ts` centralizes
the German module labels that were previously duplicated between
`RolePermissionEditor.tsx` and the platform `/dashboard/permissions` page.

## 4. Effective access resolution

`lib/roles/effective-access.ts` (`getUserEffectiveAccessView`) is a read-only view over
`EffectivePermissionResolver.getEffectivePermissions()` — it never recalculates a
permission grant. Module visibility (`visibleNavItems` / `deniedNavItems`) is derived by
feeding the resolver's live permission keys into the **same** `getVisibleNavSections()`
helper the sidebar itself uses (`lib/nav/nav-config.ts`), so the preview can never drift
from what the sidebar/route guards actually decide. Platform roles held by the same user
are listed in a separate `platformRoles` array and never merged into the tenant grant
list; archived-role assignments are still listed (so an admin can see they exist) but
excluded from `effectiveTenantPermissionKeys`, exactly matching
`EffectivePermissionResolver`'s own exclusion rule.

## 5. Role assignment model

`getEligibleTenantMembers()` (`lib/roles/tenant-queries.ts`) is the **sole** source for
the assignment picker: active `TenantMembership` rows for the caller's tenant. A user
whose legacy `User.tenantId` happens to point at the tenant but who has no
`TenantMembership` row is not eligible (covered by test `TQ-05`). Assignment
(`assignTenantRoleToUser`) is idempotent — assigning an already-assigned user is a
no-op success, never a duplicate `UserRole` row (enforced by the pre-existing
`@@unique([userId, roleId])` constraint plus an explicit existence check). Removal
(`removeTenantRoleAssignment`) never touches `TenantMembership` — only the `UserRole`
row.

## 6. Protected-role safeguards

`Role.isSystem` (already in the schema since RPERM-02) is the sole, stable identifier
used for protection — never a display-label match. `lib/roles/protected.ts` defines the
narrowest safe rule set:

- An `isSystem` role can never be renamed, re-described, archived, or restored through
  the tenant UI (`ProtectedRoleError`).
- An `isSystem` **TENANT** role additionally has three "essential" permissions that can
  never be unchecked — `roles.manage`, `roles.assign`, `users.manage_memberships` — the
  minimum needed to retain recovery access to the Roles & Permissions module itself.
  Every other permission on an `isSystem` role remains fully editable.
- Removing the last active assignee of an `isSystem` role within a tenant is blocked
  (`LastRequiredAdminError`) — generalized to any protected system role, not
  hard-coded to a "Club Admin" display label, so it also protects any future
  `isSystem` role the same way.

## 7. Mutation safety and audit

Every multi-record write (`createTenantRole`, `setTenantRolePermissions`) runs inside
`prisma.$transaction`. Every mutation throws a typed `RoleDomainError` subclass
(`lib/roles/errors.ts`) instead of a generic `Error`, which the API layer maps to a
stable `{ error, code }` response and HTTP status via `toRoleApiErrorResponse()`. Every
successful mutation emits a best-effort audit entry through the pre-existing
`lib/audit/log-action.ts` infrastructure (`moduleKey: "roles"`) — no new audit framework
was introduced, matching the task's explicit instruction to reuse an established
pattern when one exists.

## 8. Documents (Workspace) module

See `docs/RPERM_05_DISCOVERY.md` §3 for the root-cause analysis. In one sentence: the
Documents module was never a UI, navigation, or route-authorization bug — the
`workspace.view`/`workspace.manage` `Permission` rows were simply never part of the
canonical seed list that every tenant `club_admin` role's permission set is derived
from. RPERM-05 fixes the seed (`prisma/seed.ts`, `scripts/rperm-03b-bootstrap-admin-separation.ts`)
so every tenant club_admin role — including FC Allschwil's — now owns
`workspace.view`/`workspace.manage` automatically, and exposes those same two keys in
the RPERM-05 permission matrix so any tenant admin can grant or revoke them on any
tenant role (e.g. a custom "Documents Manager" role) through ordinary `RolePermission`
writes. The Documents route/API (`app/(admin)/dashboard/workspace/**`,
`app/api/workspace/**`) was never touched — it already enforced `workspace.view`/
`workspace.manage` live, correctly.
