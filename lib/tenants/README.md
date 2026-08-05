# RPERM-04 — Tenant Context Integration

## Overview

RPERM-04 makes the entire application use **exactly one tenant-resolution
model**, replacing the legacy `User.tenantId` runtime dependency introduced
in Slice 11.2b with `TenantMembership` (the canonical model introduced in
RPERM-02) and the RPERM-03 `EffectivePermissionResolver`.

This closes a real security gap: because a platform role's `rolePermissions`
often includes every permission in the system (e.g. `super_admin`), and
`session.permissionKeys` used to be a flat union of every role a user held
regardless of scope or tenant ownership, a **Platform Super Admin silently
inherited full operational access to every tenant** without ever holding a
`TenantMembership` or a tenant-scoped role.

## The single model

```
Login (auth.ts)
  └─ lib/auth/session-context.ts
       ├─ resolveTenantMembershipContext(prisma, userId)
       │    → activeTenantId, activeMembershipId, availableTenants
       │      (derived EXCLUSIVELY from active TenantMembership rows)
       └─ resolveSessionPermissionKeys(prisma, userId, activeTenantId)
            → session.permissionKeys (platform ∪ tenant, via
              EffectivePermissionResolver.getEffectivePermissions)
```

The same two functions are used by the impersonation route
(`app/api/users/[userId]/impersonate`) and stop-impersonation route
(`app/api/auth/stop-impersonation`) so an impersonated session is built
through the identical rules as a real login.

### Session shape

```ts
session.user.activeTenantId: string | null;       // TenantMembership-derived
session.user.activeMembershipId: string | null;   // backing TenantMembership row
session.user.availableTenants: { id, key, name }[]; // every active membership
session.user.permissionKeys: string[];             // platform ∪ activeTenantId (cache)
```

`session.user.tenantId` **no longer exists**. Reading it directly is a
compile error — this is intentional; it forced every call site in the
codebase to be migrated to the new model as part of this slice.

## Where to get tenant context

**Dashboard pages / Server Components** — use the single helper
(`lib/tenants/active-tenant.ts`):

```ts
import { requireTenantContext, getActiveTenant } from "@/lib/tenants/active-tenant";

const tenant = await requireTenantContext(); // redirects to /dashboard if none
// or, when the page wants to render its own "no tenant" state:
const tenant = await getActiveTenant(); // TenantContext | null
```

Lightweight variants that skip the extra tenant-record DB query when only
the id is needed:

```ts
import { getActiveTenantId, requireActiveTenantId } from "@/lib/tenants/active-tenant";
```

**API routes** — after `requireApiPermission`/`requireApiAnyPermission`,
read `access.session.user.activeTenantId` directly, or use the API-safe
helper `requireApiActiveTenantId()` (never calls `redirect()`, which is
only valid in Server Components):

```ts
const access = await requireApiPermission(PERMISSIONS.EVENTS_MANAGE);
if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
const tenantId = access.session.user.activeTenantId;
```

Never read `session.user.tenantId` (removed) or query `User.tenantId` to
determine a user's tenant scope at runtime.

## Effective Permission Resolver: `(permission, tenant)`

`requirePermission` / `requireAnyPermission` / `requireApiPermission` /
`requireApiAnyPermission` (`lib/permissions/require-*.ts`) are the
authorization boundary. They evaluate live against the RPERM-03
`EffectivePermissionResolver`:

```ts
const { platform, tenant } = await resolver.getEffectivePermissions({
  userId: session.user.id,
  tenantId: tenantId ?? session.user.activeTenantId ?? undefined,
});
const allowed = platform.includes(permissionKey) || tenant.includes(permissionKey);
```

A permission is granted only when the resolver actually finds a valid grant
path for that exact tenant — a `PLATFORM` role's permissions never satisfy a
`TENANT`-scoped check, closing the accidental-inheritance bug. All four
functions accept an optional `tenantId` argument to check a tenant other
than the caller's active one (default case for nearly all call sites).

`hasPermission` / `hasAnyPermission` remain synchronous, session-cache-based
checks for **non-authoritative** UI decisions (nav visibility, conditional
buttons) — the cache itself is now correctly scoped, but only refreshes at
next sign-in.

## User provisioning

- **Create User** (`app/api/users/create`) provisions the new user with a
  `TenantMembership` for the creating admin's `activeTenantId`. `User.tenantId`
  is never written for new users.
- **Assign Role** (`app/api/users/[userId]/roles`, `PUT`) inspects each
  selected role's `scope`:
  - `TENANT` → creates `UserRole.tenantId = role.tenantId` and ensures an
    active `TenantMembership` for that tenant.
  - `PLATFORM` → creates `UserRole.tenantId = null`; no membership touched.
  - Archived and template roles (`isArchived`/`isTemplate`) are never
    assignable.

## Tenant-scoped `club_admin` role

The `PLATFORM` `club_admin` role seeded historically is a **template only**
(`isTemplate: true`) — it is never directly assignable. `prisma/seed.ts`
materializes a real, `TENANT`-scoped `club_admin` role per tenant (key:
`club_admin__<tenant-key>`), holding every `TENANT`-scoped permission.
`prisma/bootstrap-admin.ts` grants the bootstrap admin both:

- the `PLATFORM` `super_admin` `UserRole` (`tenantId: null`) — platform
  administration (`users.manage`, `tenants.manage`, `users.impersonate`,
  `tenants.view`).
- an active `TenantMembership` + the tenant `club_admin` `UserRole` — real
  operational access to that club (`teams.manage`, `events.manage`, …).

New tenants provisioned in the future must materialize their own
`club_admin` role the same way (future work: automate this in tenant
provisioning; currently done in `prisma/seed.ts`).

## Multi-tenant readiness

`availableTenants` already lists every tenant a user holds an active
membership in — the data model supports multi-club administrators and
tenant switching. `activeTenantId` selection currently picks the
earliest-joined active membership (a stable, deterministic default); a
future slice can add an explicit "switch active tenant" action without any
further model changes.

## What is intentionally deferred

- Tenant custom-role CRUD UI (`/dashboard/roles` remains platform-only)
- A tenant-switcher UI
- Automated `club_admin` materialization during tenant provisioning
- Full removal of the legacy `User.tenantId` column (kept for now; unused at
  runtime by any code path introduced or touched by this slice)
