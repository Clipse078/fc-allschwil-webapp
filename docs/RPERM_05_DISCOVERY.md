# RPERM-05 — Discovery & Audit

**Status:** Complete
**Module:** Roles & Permissions Management UI
**Depends on:** RPERM-02, RPERM-03, RPERM-04 (merged into `STAGE` via PR #294)

This document records the discovery pass performed before implementing RPERM-05, per
the task's "Required discovery before implementation" section. It is the
`audit(rperm-05)` commit referenced in the PR history.

---

## 1. Existing role-management components (reused, not replaced)

| Area | File(s) | Notes |
|---|---|---|
| Role/Permission/RolePermission/UserRole/TenantMembership models | `prisma/schema.prisma` | Already carry `Role.scope`, `Role.tenantId`, `Role.isSystem`, `Role.isArchived`, `Role.isTemplate`, `Permission.scope`, `Permission.grantableByAdmin`. No schema changes needed for RPERM-05. |
| `EffectivePermissionResolver` | `lib/permissions/services/effective-permission-resolver.ts` | Canonical, live, fail-closed resolver. Reused as-is for the Effective Access preview — never re-implemented. |
| `requirePermission` / `requireApiPermission` / `requireAnyPermission` / `requireApiAnyPermission` | `lib/permissions/*.ts` | Canonical live authorization gates. Reused for every new page/route. |
| Platform-only role/permission admin UI | `app/(admin)/dashboard/roles/**`, `app/(admin)/dashboard/permissions/page.tsx`, `app/api/roles/**` | **Pre-existing, functional, but not scope-isolated.** Gated only by `PERMISSIONS.USERS_MANAGE` (a `PermissionScope.PLATFORM` permission), so only a platform Super Admin can reach it today — but the underlying queries return **every** `Role` row regardless of `scope`/`tenantId`, and the mutation endpoints accept edits to **any** role, including tenant-owned roles. This violates the "platform and tenant scopes are visibly and technically separated" acceptance criterion once a genuine tenant-facing UI exists alongside it. RPERM-05 narrows these to `scope: "PLATFORM"` only (see §5) rather than replacing them. |
| Tenant-facing role/permission admin UI | — | **Did not exist.** There was no `/dashboard/administration/roles`-style route, no tenant-scoped role query, and no TenantMembership-based assignment UI. This is the primary net-new surface built by RPERM-05. |
| `TenantMembership`-based active-tenant resolution | `lib/tenants/active-tenant.ts`, `lib/tenants/context.ts` | Canonical, reused directly (`requireActiveTenantId()` / `getActiveTenantId()`) — RPERM-05 never re-derives tenant context from `session.user.tenantId`. |

## 2. Existing permission taxonomy

`lib/permissions/permissions.ts` (`PERMISSIONS` map) and `prisma/seed.ts` are the
canonical sources. Relevant pre-existing keys reused as-is (no invented keys):

- `roles.view`, `roles.manage`, `roles.assign` — defined in RPERM-02, **never previously
  wired into any guard**. RPERM-05 is the first consumer.
- `users.manage_memberships` — reused for the "who can assign roles" checks alongside
  `roles.assign`.
- `workspace.view`, `workspace.manage` — see §3, Documents gap.
- All other module permissions (`teams.*`, `events.*`, `website.*`, …) are grouped by
  `Permission.module` (`PermissionModule` enum) for the permission matrix. The module
  set is exactly the enum already declared in `prisma/schema.prisma` — no new groups
  were invented.

`Permission.scope` (`PLATFORM` | `TENANT`) is the sole authorization-relevant scope
signal. Module grouping is presentation-only, per the task's architectural principle 2.

## 3. Documents module gap — root cause

The task asked us to determine exactly why FC Allschwil's Club Admin cannot see the
Documents (Workspace) module. Findings:

1. `workspace.view` / `workspace.manage` (`PermissionModule.WORKSPACE`) **are** real,
   already-used permission keys — referenced by `lib/nav/nav-config.ts` for the
   "Dokumente" nav entry and by every Workspace route/API
   (`requireAnyPermission`/`requireApiPermission` calls in
   `app/(admin)/dashboard/workspace/page.tsx`, `app/api/workspace/**`). Navigation and
   route/API enforcement already use the **same** keys — there is no key mismatch and
   no hardcoded-to-another-role bug.
2. **The gap is upstream, in seeding.** `prisma/seed.ts`'s canonical `permissions` array
   — the same array whose `scope === "TENANT"` subset is copied verbatim onto every
   tenant's materialized `club_admin` role (see the seed's own comment: "owning every
   TENANT-scoped permission") — **never included `workspace.view` / `workspace.manage`**.
   A second, separate script (`scripts/sync-workspace-permissions.ts`) creates those two
   `Permission` rows and assigns them **only to `super_admin`**, and only when run with
   `APPLY_PERMISSION_SYNC=true`. It was never merged into the canonical seed and never
   touches any tenant role.
3. Net effect: even in an environment where `sync-workspace-permissions.ts` has been
   run, the FC Allschwil tenant `club_admin` role (and every other tenant role) still has
   zero `RolePermission` rows for the Workspace module, because tenant club_admin's
   permission set is built exclusively from the seed's own `permissions` array. Club
   Admin is missing the permission rows on the role, not because of a UI or
   navigation bug, but because of an incomplete canonical seed.

**Fix (see §5 and `lib/roles/__tests__` / `prisma/seed.ts` diff):** add
`workspace.view` / `workspace.manage` (`scope: TENANT`, `grantableByAdmin: true`) to the
canonical `permissions` array in `prisma/seed.ts`. This is a data-completeness fix to
the existing, already-accepted "tenant club_admin owns every TENANT permission" seeding
policy — not a new automatic-assignment policy and not a schema change. Once seeded,
the RPERM-05 permission matrix lets any tenant admin explicitly grant/revoke
`workspace.*` on any tenant role (including newly created custom roles such as a
"Documents Manager" role), through the same `RolePermission` writes.
`scripts/sync-workspace-permissions.ts` is left untouched (harmless, idempotent,
out of scope for this slice).

## 4. Navigation gating

`lib/nav/nav-config.ts` (`NAV_SECTIONS`, `MODULE_DEFINITIONS`) is the single source of
truth. `getVisibleNavSections()` filters against a caller-supplied `permissionKeys`
array. In practice this array is `session.user.permissionKeys` — the JWT-cached
snapshot computed at sign-in (`lib/auth/session-context.ts`), documented in
`lib/permissions/has-permission.ts` as **UI-only, not an authorization boundary**. This
pre-existing pattern (tracked separately as `AUTH-LIVE-PERM-01`) is intentionally not
touched by RPERM-05: every new page/route added by this slice performs its own live
`requirePermission`/`requireApiPermission` check against
`EffectivePermissionResolver`, so a stale nav entry can at most be a harmless dead link,
never a bypass.

## 5. Protected-role representation

`Role.isSystem: Boolean` already exists and is already set correctly by
`prisma/seed.ts` (`super_admin`: `isSystem: true`; tenant `club_admin`: `isSystem: true`
in the RPERM-04 seed block; `match_coordinator`/`trainer`/`viewer`/`website_publisher`:
`isSystem: false`). This is the "stable identifier" the task asks us to prefer over a
display-label check — **no schema change is required**. RPERM-05 introduces
`lib/roles/protected.ts` to centralize the protection predicate
(`role.isSystem === true` ⇒ cannot be archived, renamed, or have its scope/tenant
changed) and a narrow "essential permission lock" for the tenant `club_admin` system
role only (`roles.manage`, `roles.assign`, `users.manage_memberships` cannot be
unchecked in the permission matrix — this is the minimal set needed to retain recovery
access to the Roles & Permissions module itself), plus a live "last required admin"
guard (see `lib/roles/mutations.ts`) that blocks removing the last active assignment of
an `isSystem` `TENANT` role within a tenant.

## 6. Audit / activity infrastructure

`lib/audit/log-action.ts` (`AuditLog` model, already migrated) and the thin
`lib/audit/audit-log.ts` wrapper are the established, already-used pattern (see
`lib/audit/audit-log.ts` header comment: "Action vocabulary consistent across all
governance modules"). RPERM-05 reuses `logAction()` directly for every mutation (role
created/renamed/archived/restored, permissions changed, user assigned/removed) — no new
audit framework is introduced. Failures are best-effort (never block or roll back the
underlying mutation), matching the existing contract.

## 7. Two divergent tenant `club_admin` role keys (found, not fixed here)

Two different scripts materialize a tenant-scoped Club Admin role under **different**
`Role.key` values for the same FC Allschwil tenant:

- `prisma/seed.ts` → `club_admin__fc-allschwil` (via `tenantClubAdminRoleKey()`)
- `scripts/rperm-03b-bootstrap-admin-separation.ts` → `club_admin_fc_allschwil`

Both are `scope: TENANT`, `tenantId: <FC Allschwil>`, `isSystem: true`, so RPERM-05's
`isSystem`-based protection logic and last-admin guard behave correctly regardless of
which key is present in a given environment, and the new Roles overview lists whichever
row(s) actually exist. Reconciling the two scripts into one canonical bootstrap path is
a pre-existing, out-of-scope inconsistency (adjacent to `MIGRATION-ORDER-01`) — it does
not block RPERM-05 and is reported here as a non-blocking finding, not fixed in this PR.

## 8. Local verification environment

A disposable local PostgreSQL 16 database (`rperm05_dev`, local-only role/DB created for
this task) was used for all schema/seed verification and automated tests.
`prisma migrate deploy` against a byte-for-byte fresh database fails on the pre-existing
`20260606202204_news_cms_v2_1_editorial_workflow` migration
(`type "NewsArticleStatus" does not exist"`) — this is exactly the previously-catalogued
`MIGRATION-ORDER-01` issue, unrelated to RPERM-05. `prisma db push` (schema-sync,
no migration replay) was used instead to stand up the disposable database, per the
task's explicit instruction to use a disposable local database for mutation-heavy
development/tests. `STAGE_DB_URL` was never read or used.
