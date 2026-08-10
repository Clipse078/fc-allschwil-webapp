/**
 * lib/permissions/teams-delete-permission-reconciliation.ts
 *
 * ADMIN-DELETE-01A-C1 — idempotent teams.delete backfill.
 *
 * Extracted reconciliation logic for scripts/sync-teams-delete-permission.ts,
 * mirroring the existing lib/permissions/training-permission-reconciliation.ts
 * pattern (STAGE-OPS-01/03/03A/03B) — this is the smallest already-established
 * idempotent permission-backfill mechanism in this repository, reused rather
 * than reinvented.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * prisma/seed.ts is NOT automatically re-run after a deploy (see
 * package.json's `build` script and scripts/sync-training-permissions.ts's own
 * doc comment for the identical, previously-diagnosed gap with
 * trainings.view/trainings.manage). Any STAGE/production database that was
 * seeded BEFORE the ADMIN-DELETE-01A commit added `teams.delete` to
 * prisma/seed.ts is missing:
 *   - the `teams.delete` Permission row entirely, and
 *   - its RolePermission assignment to `super_admin` and to every tenant's
 *     already-materialized Club Admin role.
 * Re-running prisma/seed.ts in full is possible (it is idempotent — all
 * writes are upserts) but is not how this repository normally patches a
 * single newly-added permission onto an already-seeded database; the
 * established, minimal pattern is a small, independently testable,
 * dry-run-by-default reconciliation script (see sync-workspace-permissions.ts,
 * sync-training-permissions.ts).
 *
 * ── What this reconciles ─────────────────────────────────────────────────────
 *   - Permission row: teams.delete (module=TEAMS, scope=TENANT,
 *     grantableByAdmin=true) — matches prisma/seed.ts exactly.
 *   - RolePermission: super_admin (PLATFORM role) → teams.delete. Mirrors the
 *     existing, already-accepted seed policy that super_admin owns every
 *     permission key (prisma/seed.ts: `permissionKeys: permissions.map(...)`).
 *   - RolePermission: every already-materialized per-tenant Club Admin role
 *     (Role rows with scope=TENANT, isSystem=true, key matching the
 *     `club_admin__<tenantKey>` convention from
 *     lib/roles/tenant-role-keys.ts) → teams.delete. Mirrors the existing,
 *     already-accepted seed policy that a tenant's Club Admin role owns every
 *     TENANT-scoped permission (prisma/seed.ts's `tenantPermissionKeys`
 *     materialization step).
 *
 * Deliberately does NOT touch any other role — delegated/custom tenant roles
 * only receive teams.delete through the existing Roles & Permissions
 * delegation UI (grantableByAdmin: true), never automatically here.
 *
 * All writes use upsert — safe to re-run any number of times. No deletes.
 *
 * After applying, affected users must log out and log back in for the new
 * permission to appear in their session JWT (permissions are embedded at
 * sign-in time — see lib/auth/session-context.ts), though the authoritative
 * resolver-backed checks (requireApiPermission, hasTenantDeletionAuthority)
 * take effect immediately regardless of session cache staleness.
 */

import type { PermissionModule, PermissionScope, PrismaClient } from "@prisma/client";
import { CLUB_ADMIN_TEMPLATE_KEY } from "@/lib/roles/tenant-role-keys";

// ── Constants ──────────────────────────────────────────────────────────────────

// Use the string literal rather than the generated PermissionScope/
// PermissionModule enum members, mirroring
// lib/permissions/training-permission-reconciliation.ts's TRAINING_MODULE
// convention — this keeps the reconciliation robust even if it ever runs
// against a Prisma client generated before this key's migration/module value
// existed.
const TEAMS_MODULE = "TEAMS" as PermissionModule;
const TENANT_SCOPE = "TENANT" as PermissionScope;

export const TEAMS_DELETE_PERMISSION_DEF = {
  key: "teams.delete",
  name: "Permanently delete teams",
  module: TEAMS_MODULE,
  scope: TENANT_SCOPE,
  grantableByAdmin: true,
} as const;

/** Automatic bootstrap recipient: the PLATFORM super_admin role. */
export const TEAMS_DELETE_SUPER_ADMIN_ROLE_KEY = "super_admin";

/** Prefix identifying an already-materialized per-tenant Club Admin role (lib/roles/tenant-role-keys.ts). */
export const TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX = `${CLUB_ADMIN_TEMPLATE_KEY}__`;

// ── Result types ───────────────────────────────────────────────────────────────

export type PermissionSyncOutcome =
  | { action: "created"; key: string }
  | { action: "already_exists"; key: string }
  | { action: "updated"; key: string };

export type RolePermissionSyncOutcome =
  | { action: "assigned"; roleKey: string; permissionKey: string }
  | { action: "already_assigned"; roleKey: string; permissionKey: string }
  | { action: "role_not_found"; roleKey: string; permissionKey: string }
  | { action: "permission_not_in_db"; roleKey: string; permissionKey: string };

export type TeamsDeleteReconciliationResult = {
  permission: PermissionSyncOutcome;
  superAdmin: RolePermissionSyncOutcome;
  tenantClubAdminRoles: RolePermissionSyncOutcome[];
};

// ── Reconciliation ─────────────────────────────────────────────────────────────

/**
 * Reconciles the `teams.delete` permission and its bootstrap role grants.
 *
 * Idempotent: safe to call multiple times without side effects. Does NOT
 * commit any changes when `dryRun` is true.
 *
 * Step 1: Ensure the `teams.delete` Permission row exists.
 * Step 2: Grant it to `super_admin` (PLATFORM).
 * Step 3: Grant it to every already-materialized per-tenant Club Admin role.
 */
export async function reconcileTeamsDeletePermission(
  prisma: PrismaClient,
  dryRun = false,
): Promise<TeamsDeleteReconciliationResult> {
  const def = TEAMS_DELETE_PERMISSION_DEF;

  // ── Step 1: Ensure the Permission row exists ────────────────────────────────
  const existingPermission = await prisma.permission.findUnique({
    where: { key: def.key },
    select: { id: true, name: true, module: true, scope: true, grantableByAdmin: true },
  });

  let permissionOutcome: PermissionSyncOutcome;
  if (existingPermission) {
    const needsUpdate =
      existingPermission.name !== def.name ||
      existingPermission.module !== def.module ||
      existingPermission.scope !== def.scope ||
      existingPermission.grantableByAdmin !== def.grantableByAdmin;
    permissionOutcome = { action: needsUpdate ? "updated" : "already_exists", key: def.key };
  } else {
    permissionOutcome = { action: "created", key: def.key };
  }

  if (!dryRun) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: { name: def.name, module: def.module, scope: def.scope, grantableByAdmin: def.grantableByAdmin },
      create: { key: def.key, name: def.name, module: def.module, scope: def.scope, grantableByAdmin: def.grantableByAdmin },
    });
  }

  // ── Step 2: Grant to super_admin (PLATFORM) ─────────────────────────────────
  const superAdminOutcome = await assignPermissionToRole(
    prisma,
    TEAMS_DELETE_SUPER_ADMIN_ROLE_KEY,
    def.key,
    dryRun,
  );

  // ── Step 3: Grant to every already-materialized tenant Club Admin role ─────
  const tenantClubAdminRoles = await prisma.role.findMany({
    where: {
      scope: "TENANT",
      isSystem: true,
      key: { startsWith: TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX },
    },
    select: { key: true },
  });

  const tenantClubAdminOutcomes: RolePermissionSyncOutcome[] = [];
  for (const role of tenantClubAdminRoles) {
    tenantClubAdminOutcomes.push(
      await assignPermissionToRole(prisma, role.key, def.key, dryRun),
    );
  }

  return {
    permission: permissionOutcome,
    superAdmin: superAdminOutcome,
    tenantClubAdminRoles: tenantClubAdminOutcomes,
  };
}

async function assignPermissionToRole(
  prisma: PrismaClient,
  roleKey: string,
  permissionKey: string,
  dryRun: boolean,
): Promise<RolePermissionSyncOutcome> {
  const role = await prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } });

  if (!role) {
    return { action: "role_not_found", roleKey, permissionKey };
  }

  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    select: { id: true },
  });

  if (!permission) {
    // Only reachable in dry-run mode — apply mode upserts the permission
    // row in Step 1 before this function is ever called.
    return { action: "permission_not_in_db", roleKey, permissionKey };
  }

  const existing = await prisma.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    select: { roleId: true },
  });

  const outcome: RolePermissionSyncOutcome = existing
    ? { action: "already_assigned", roleKey, permissionKey }
    : { action: "assigned", roleKey, permissionKey };

  if (!dryRun) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  return outcome;
}
