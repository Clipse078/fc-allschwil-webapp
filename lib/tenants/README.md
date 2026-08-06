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

## RPERM-04-C1 — Archived tenant & route tenant isolation corrections

Two corrections were made to the model above after independent security
verification of RPERM-04:

### 1. Archived/inactive tenants no longer grant access

An active `TenantMembership` was previously sufficient to establish tenant
context and pass tenant permission checks — the related `Tenant.status` was
never checked. A membership linked to an `ARCHIVED` or `INACTIVE` tenant
could still produce `activeTenantId`, tenant permissions, and page/API
access.

Fixed at the two canonical choke points, so the fix applies everywhere
consistently (session resolution, available tenant lists, default active
tenant, explicit tenant ID, tenant-slug resolution, permission
authorization, impersonation, and stop-impersonation all funnel through
these):

- `resolveTenantMembershipContext()` (`lib/auth/session-context.ts`) now
  filters `tenant: { status: "ACTIVE" }` at the DB level — an
  archived/inactive tenant's membership row is excluded before any
  selection logic runs.
- `EffectivePermissionResolver`'s `resolveTenantPermissions()`
  (`lib/permissions/services/effective-permission-resolver.ts`) now also
  requires `membership.tenant.status === "ACTIVE"`, in addition to
  `membership.isActive`. Since `requirePermission`/`requireAnyPermission`/
  `requireApiPermission`/`requireApiAnyPermission` all evaluate live against
  this resolver on every request (never a JWT-cached value), archiving a
  tenant takes effect immediately for every protected page and API — even
  for a session whose JWT still carries the old `activeTenantId`. Only the
  session's cached *display* fields (`permissionKeys`, etc.) remain stale
  until next sign-in/refresh; they are never used as the authorization
  boundary.

### 2. Tenant-slug routes authorize against the route tenant, not the session tenant

Routes identified by a URL `tenantSlug` param (`/tenant/[tenantSlug]/...`,
`/api/tenants/[tenantSlug]/...`) must authorize against the tenant named by
the slug — never `session.user.activeTenantId`. Registrations previously
called `requireAnyPermission()`/`requireApiAnyPermission()` without an
explicit `tenantId`, so the permission check silently defaulted to the
caller's own active tenant while the actual data query used the
slug-resolved tenant — allowing a user authorized in Tenant A to read/write
Tenant B's registrations merely by editing the URL.

Fixed with a canonical resolver pair in `lib/tenants/active-tenant.ts`:

```ts
// Server Component / page — redirects to /dashboard if invalid
const tenantContext = await requireTenantContextForSlug(tenantSlug);
const session = await requireAnyPermission([...], tenantContext.id);

// API route — returns a discriminated result, never redirects
const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
if (!tenantResult.ok) return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
const access = await requireApiAnyPermission([...], tenantResult.tenantId);
```

`requireTenantContextForSlug()`/`requireApiTenantContextForSlug()` return a
tenant only when it exists, is operationally `ACTIVE`, and the caller has an
active `TenantMembership` in that *exact* tenant — resolved fresh from the
database on every call. All Registration pages/routes were migrated to this
pattern; the audit found no other authenticated tenant-slug route with the
same defect (see `app/api/tenants/[tenantSlug]/route.ts` and `logo/route.ts`,
which are `PLATFORM`-scoped and therefore unaffected).



- Tenant custom-role CRUD UI (`/dashboard/roles` remains platform-only)
- A tenant-switcher UI
- Automated `club_admin` materialization during tenant provisioning
- Full removal of the legacy `User.tenantId` column (kept for now; unused at
  runtime by any code path introduced or touched by this slice)
