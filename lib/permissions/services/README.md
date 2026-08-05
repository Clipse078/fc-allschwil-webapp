# RPERM-03 — Effective Permission Resolver

## Overview

`effective-permission-resolver.ts` is the canonical backend authorization service
introduced by RPERM-03. It determines whether a user holds a specific permission
at platform level or within a specific tenant, using the RPERM-02 schema foundation.

## Responsibility

Resolve the union of permissions a user holds by traversing:

```
UserRole → Role → RolePermission → Permission
```

The resolver enforces:

- Platform vs. tenant scope boundaries
- Exact tenant isolation (Tenant A cannot authorize Tenant B)
- Role and membership validity (archived roles, inactive memberships excluded)
- Fail-closed behavior for all invalid or incomplete authorization paths

## Public API

```typescript
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { prisma } from "@/lib/db/prisma";

const resolver = createEffectivePermissionResolver(prisma);

// Check a single permission
await resolver.hasPermission({ userId, permission: "trainings.view", tenantId });

// Check if user holds at least one of several permissions
await resolver.hasAnyPermission({ userId, permissions: ["news.manage", "website.manage"], tenantId });

// Check if user holds every listed permission
await resolver.hasAllPermissions({ userId, permissions: ["roles.view", "roles.assign"], tenantId });

// List all effective permissions (structured)
const { platform, tenant } = await resolver.getEffectivePermissions({ userId, tenantId });
```

## Platform vs. Tenant Rules

### Platform Permission Check (no tenantId)

Granted only when ALL hold:
1. Permission `scope = PLATFORM` in the database.
2. User has a `UserRole` with `tenantId = NULL` (platform-level assignment).
3. Assigned role has `scope = PLATFORM`, `tenantId = NULL`, and `isArchived = false`.
4. Role includes the requested permission.

**Tenant roles never satisfy a platform permission check.**
**A role with `scope = PLATFORM` but `tenantId ≠ null` (inconsistent data) is also excluded.**
Both `UserRole.tenantId = null` and `role.tenantId = null` are required.

### Tenant Permission Check (tenantId provided)

Granted only when ALL hold:
1. A valid `tenantId` is supplied.
2. Permission `scope = TENANT` in the database.
3. User has an active `TenantMembership` (`isActive = true`) for that exact tenant.
4. User has a `UserRole` scoped to that exact tenant (`UserRole.tenantId = tenantId`).
5. Assigned role has `scope = TENANT`, `tenantId = tenantId`, and `isArchived = false`.
6. Role includes the requested permission.

**Role ownership is enforced:** a role owned by Tenant B cannot authorize access in Tenant A,
even if `UserRole.tenantId = Tenant A`. The filter `role.tenantId = tenantId` is applied at DB
query level, closing the inconsistent-data attack vector without requiring schema constraints.

**A role membership from Tenant A does NOT authorize access in Tenant B.**
**Platform roles do NOT implicitly grant tenant operational permissions.**

## Fail-Closed Behavior

Every method returns `false` / empty result when:

- `userId` is empty
- No applicable role or membership exists
- The tenant does not exist or does not match the membership
- The role is archived
- The tenant membership is inactive
- The permission is unknown or scope-incompatible
- A required `tenantId` is missing for a tenant-scoped check

Database or infrastructure failures propagate as exceptions — they are NEVER
silently converted into permission grants.

## Membership Validity

The following RPERM-02 fields are inspected:

| Model              | Field      | Effect                              |
|--------------------|------------|-------------------------------------|
| `TenantMembership` | `isActive` | `false` → tenant check denied       |
| `Role`             | `isArchived` | `true` → role excluded at DB level  |

No other validity fields exist in the RPERM-02 schema (no expiry, no revocation
dates on memberships or roles). If such fields are added in future slices, the
resolver should be extended to respect them.

## Aggregate Method Semantics

| Method                     | Empty input | Rationale                              |
|----------------------------|-------------|----------------------------------------|
| `hasAnyPermission([])`     | `false`     | No permission can satisfy empty list   |
| `hasAllPermissions([])`    | `true`      | Vacuous truth — all zero reqs. met    |

These semantics are tested explicitly and must not be changed without updating
the tests to document the new intentional behavior.

## Query Strategy

- **Platform check** (`hasPermission` / `hasAnyPermission` / `hasAllPermissions`, no tenantId):
  1 `userRole.findMany` with filters `UserRole.tenantId = null`, `role.scope = PLATFORM`,
  `role.tenantId = null`, `role.isArchived = false`, nested `rolePermissions → permission`.

- **Tenant check** (`hasPermission` / `hasAnyPermission` / `hasAllPermissions`, tenantId provided):
  1 `tenantMembership.findUnique` (membership gate), then 1 `userRole.findMany` with filters
  `UserRole.tenantId = tenantId`, `role.scope = TENANT`, `role.tenantId = tenantId`,
  `role.isArchived = false`, nested `rolePermissions → permission`.
  **Max 2 DB queries per call.**

- **Combined effective listing** (`getEffectivePermissions`, tenantId provided):
  1 platform `userRole.findMany` + 1 `tenantMembership.findUnique` + 1 tenant `userRole.findMany`.
  **Max 3 DB queries per call.** (This is intentional — platform and tenant grants are resolved
  independently and returned as separate structured collections.)

- **Combined effective listing** (`getEffectivePermissions`, no tenantId):
  1 platform `userRole.findMany`. **1 DB query.**

Deduplication uses `Set<string>` internally. Returned arrays are sorted for
stable output. No N+1 queries, no full role-table scans, no cross-tenant data loaded.

## No Automatic Operational Role Assignment

The resolver answers authorization questions only. It never assigns roles or
permissions automatically. Operational roles (Trainer, Website Publisher, etc.)
must be assigned explicitly by authorized administrators.

## RPERM-04 — Tenant Context Integration

RPERM-04 made this resolver the canonical authorization boundary. See
`lib/tenants/README.md` for the full slice writeup. In short:

- `requirePermission` / `requireAnyPermission` / `requireApiPermission` /
  `requireApiAnyPermission` (`lib/permissions/require-*.ts`) now call
  `getEffectivePermissions({ userId, tenantId })` live on every check —
  `tenantId` defaults to `session.user.activeTenantId`, itself derived
  exclusively from active `TenantMembership` rows (never `User.tenantId`).
- The session-cached `permissionKeys` array (used by `hasPermission` /
  `hasAnyPermission` for non-authoritative UI decisions) is now built the
  same way at sign-in, closing the "Platform Super Admin inherits every
  tenant permission" bug described below.
- `Create User` / `Assign Role` (`app/api/users/create`,
  `app/api/users/[userId]/roles`) always provision `TenantMembership` +
  tenant-scoped `UserRole` rows for TENANT-scoped role assignments.

## Deferred Work (post-RPERM-04)

The following remain intentionally out of scope:

- Roles & Permissions management UI
- Tenant custom-role CRUD via `/dashboard/roles` (tenant `club_admin` roles
  are currently materialized by `prisma/seed.ts`, one per tenant)
- Multi-tenant switching UI (the data model — `availableTenants` — already
  supports it; see `lib/tenants/README.md`)
- Permission caching infrastructure (request-scoped or distributed)
- Organization-unit / team / target-group permission inheritance
- Audit log integration for permission resolutions
- Full removal of the legacy `User.tenantId` column
