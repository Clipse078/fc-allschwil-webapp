# RPERM-05-C1 — Role Integrity and Legacy Assignment Safeguards

**Status:** Complete
**Scope:** Corrective delta on top of PR #295 (RPERM-05). Independent verification
uncovered three findings; this document records the fix for each. No part of the
RPERM-05 module was redesigned.

---

## Finding 1 — Divergent Club Admin role identities

**Problem:** `prisma/seed.ts` materialized the per-tenant Club Admin role as
`club_admin__<tenantKey>` (`isSystem: true`), while
`scripts/rperm-03b-bootstrap-admin-separation.ts` independently hardcoded a second key,
`club_admin_fc_allschwil` (`isSystem: false`), for the same tenant. Both existing in a
database at once meant only one was protected, permissions/assignments could land on
either, and last-admin safeguards could protect the wrong row.

**Fix:**

- `lib/roles/tenant-role-keys.ts` — new shared helper, `getTenantClubAdminRoleKey(tenantKey)`,
  returning the canonical `club_admin__<tenantKey>` identity (the format already used by
  RPERM-04's tenant-role materialization in `prisma/seed.ts`).
- `prisma/seed.ts`, `prisma/bootstrap-admin.ts`,
  `scripts/rperm-03b-bootstrap-admin-separation.ts`,
  `scripts/stage-cleanup-01-fca-canonical-data.ts` all now import this single helper —
  no file constructs the key independently anymore.
- `scripts/rperm-03b-bootstrap-admin-separation.ts` now **resolves** the canonical role by
  this key (never generates a second one); if it finds a pre-existing role at that key with
  `isSystem: false` or `isArchived: true` (drift from before this fix), it self-heals both
  flags to the correct, protected values in the same transaction — it never weakens
  protection.
- New script, `scripts/rperm-05c1-consolidate-club-admin-roles.ts` — `--inspect` /
  `--dry-run` / `--execute` (idempotent, transactional, tenant-scoped) — merges any
  pre-existing divergent pair for a given tenant: unique permissions and user assignments
  move to the canonical role, the duplicate is archived (never deleted outright) only after
  the merge is verified via in-transaction postconditions, and the whole operation rolls
  back on any postcondition failure. Safe if only one/neither role exists, safe with
  overlapping or disjoint users/permissions, safe across repeated runs. Never executed
  against `STAGE` as part of this task.

## Finding 2 — Platform permission-scope validation

**Problem:** The platform role permission editor's catalog
(`getPermissionEditorData()`, `lib/roles/queries.ts`) listed **every** permission
regardless of scope, and `PUT /api/roles/[id]/permissions` resolved any submitted key
without checking `Permission.scope`, so a TENANT permission (e.g. `workspace.manage`)
could be attached to a PLATFORM role — invalid `RolePermission` data, filtered out only by
the effective-permission resolver at read time (not an access bypass, but misleading and
unsafe to keep relying on).

**Fix:**

- `getPermissionEditorData()` now filters both the catalog **and** the currently-assigned
  keys to `Permission.scope === "PLATFORM"`. The second filter matters: some seed-created
  PLATFORM roles (`match_coordinator`, `website_publisher`, `trainer`, `viewer`) already
  carry legacy TENANT-scoped `RolePermission` rows from before this fix; without filtering
  `assignedKeys` too, the editor would show them pre-checked and resubmit them on save,
  which the corrected mutation now (correctly) rejects. Filtering both sides means the
  editor self-heals those legacy rows away the next time an admin saves that role.
- `lib/roles/platform-mutations.ts` — new `setPlatformRolePermissions()`, mirroring
  `lib/roles/mutations.ts`'s tenant-side `resolveTenantPermissions()` (which already
  rejects PLATFORM keys) with the scopes inverted: every requested key is re-validated as
  `scope === "PLATFORM"` **server-side**; a single TENANT key anywhere in the batch throws
  `InvalidPermissionScopeError` before any write (no partial persist), wrapped in a
  transaction for the actual replace.
- `app/api/roles/[id]/permissions/route.ts` `PUT` now delegates to this mutation instead of
  resolving permissions inline.

## Finding 3 — Legacy platform user-role endpoint

**Problem:** `PUT /api/users/[userId]/roles` (pre-existing, platform-admin-only) deleted
**every** `UserRole` row for the target user across all tenants and recreated from
submitted ids, silently upserting a `TenantMembership` for any TENANT-scoped role in the
request — bypassing every RPERM-05 tenant safeguard (active-membership check, tenant
isolation, protected-role rules, last-active-Club-Admin safeguard) and able to affect
multiple tenants in one call. Its only caller is
`components/admin/users/UserRolesForm.tsx` on the platform user detail page.

**Fix (chosen direction: platform-role assignments only; tenant assignments untouched):**

- `lib/roles/platform-mutations.ts` — new `setPlatformUserRoles()`: loads and accepts only
  `Role.scope === "PLATFORM"` ids (a TENANT id anywhere in the request is a hard,
  whole-batch rejection — `ScopeMismatchError`); reads/writes only `UserRole` rows where
  `role.scope === "PLATFORM"` (equivalently, `tenantId IS NULL`); never reads or writes
  `TenantMembership`; blocks removing the last platform-wide holder of an `isSystem`
  PLATFORM role; idempotent; transactional; audits via the existing `logAction()`
  infrastructure.
- `app/api/users/[userId]/roles/route.ts` — `GET` now returns only PLATFORM role ids;
  `PUT` delegates to `setPlatformUserRoles()`.
- `lib/users/queries.ts` — `getRolesListData()` renamed to `getPlatformRolesListData()`
  and filtered to `scope: "PLATFORM"` (previously listed every role, tenant included).
- `app/(admin)/dashboard/users/[userId]/page.tsx` — the user detail page now renders two
  separate sections: **Plattform-Rollen** (editable, backed by the corrected endpoint) and
  a read-only **Mandanten-Rollen** summary linking to the tenant's own role-management
  context (`/dashboard/administration/roles/[id]`) — never editable through this global
  form.
- A future platform support capability to *assign* tenant roles cross-tenant is explicitly
  deferred to `PLATFORM-TENANT-01` and not implemented here.

---

## Files changed

See the PR diff for the full list. Summary by concern:

- Canonical role identity: `lib/roles/tenant-role-keys.ts` (new), `prisma/seed.ts`,
  `prisma/bootstrap-admin.ts`, `scripts/rperm-03b-bootstrap-admin-separation.ts`,
  `scripts/stage-cleanup-01-fca-canonical-data.ts`.
- Consolidation tooling: `scripts/rperm-05c1-consolidate-club-admin-roles.ts` (new).
- Platform permission scope: `lib/roles/queries.ts`, `lib/roles/platform-mutations.ts`
  (new), `app/api/roles/[id]/permissions/route.ts`.
- Legacy endpoint: `lib/roles/platform-mutations.ts` (new), `lib/users/queries.ts`,
  `app/api/users/[userId]/roles/route.ts`, `app/(admin)/dashboard/users/[userId]/page.tsx`,
  `app/(admin)/dashboard/users/page.tsx`, `components/admin/users/UserRolesForm.tsx`.
- Tests: see `**/__tests__/rperm-05c1-*` and `**/__tests__/rperm-03b-*` /
  `**/__tests__/stage-cleanup-01-*` (updated for the canonical key).

## Database impact

No Prisma schema change. No migration. All fixture creation and the one consolidation run
performed for manual verification were executed against a disposable local PostgreSQL
database — never against `STAGE_DB_URL` or `STAGE` itself.
