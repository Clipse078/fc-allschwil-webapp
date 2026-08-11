/**
 * lib/permissions/planning-modules-delete-permission-reconciliation.ts
 *
 * ADMIN-DELETE-02A — idempotent trainings.delete / matches.delete /
 * tournaments.delete permission backfill.
 *
 * Mirrors lib/permissions/teams-delete-permission-reconciliation.ts
 * (ADMIN-DELETE-01A/01B) — the established, already-accepted pattern for
 * patching a single newly-added "<module>.delete" permission onto an
 * already-seeded database, reused here for the three core planning module
 * permissions rolled out in ADMIN-DELETE-02A rather than reinvented.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * prisma/seed.ts is NOT automatically re-run after a deploy (see
 * package.json's `build` script). Any STAGE/production database that was
 * seeded before the ADMIN-DELETE-02A commit added trainings.delete /
 * matches.delete / tournaments.delete to prisma/seed.ts is missing:
 *   - the three Permission rows entirely, and
 *   - their RolePermission assignment to `super_admin` and to every
 *     tenant's already-materialized Club Admin role.
 *
 * ── What this reconciles, per permission ─────────────────────────────────────
 *   - Permission row (module/scope/grantableByAdmin — matches prisma/seed.ts
 *     exactly).
 *   - RolePermission: super_admin (PLATFORM role) → permission. Mirrors the
 *     existing, already-accepted seed policy that super_admin owns every
 *     permission key.
 *   - RolePermission: every already-materialized per-tenant Club Admin role
 *     (Role rows with scope=TENANT, isSystem=true, key matching the
 *     `club_admin__<tenantKey>` convention from
 *     lib/roles/tenant-role-keys.ts) → permission.
 *
 * Deliberately does NOT touch any other role — delegated/custom tenant
 * roles only receive these permissions through the existing Roles &
 * Permissions delegation UI (grantableByAdmin: true), never automatically
 * here.
 *
 * ── No FC Allschwil legacy Club Admin compatibility step ────────────────────
 * teams-delete-permission-reconciliation.ts (ADMIN-DELETE-01B-C1) added a
 * narrow compatibility grant for a legacy, divergent `club_admin_fc_allschwil`
 * Role row that predated RPERM-05-C1's role-key consolidation
 * (scripts/rperm-05c1-consolidate-club-admin-roles.ts). By ADMIN-DELETE-02A,
 * FC Allschwil's Club Admin role is the canonical
 * `club_admin__fc-allschwil` (isSystem=true) — repository evidence does not
 * show the legacy row is still the one actually assigned to any user, so
 * this reconciliation intentionally does NOT reintroduce that shim.
 *
 * All writes use upsert — safe to re-run any number of times. No deletes.
 *
 * After applying, affected users must log out and log back in for the new
 * permissions to appear in their session JWT (permissions are embedded at
 * sign-in time — see lib/auth/session-context.ts), though the authoritative
 * resolver-backed checks (requireApiPermission, hasTenantDeletionAuthority)
 * take effect immediately regardless of session cache staleness.
 */

import type { PermissionModule, PermissionScope, PrismaClient } from "@prisma/client";
import { CLUB_ADMIN_TEMPLATE_KEY } from "@/lib/roles/tenant-role-keys";

// ── Constants ──────────────────────────────────────────────────────────────────

// String literals rather than the generated PermissionModule/PermissionScope
// enum members, mirroring lib/permissions/teams-delete-permission-
// reconciliation.ts's TEAMS_MODULE convention — keeps this robust even if it
// ever runs against a Prisma client generated before these values existed.
const TENANT_SCOPE = "TENANT" as PermissionScope;
const TRAININGS_MODULE = "TRAININGS" as PermissionModule;
const EVENTS_MODULE = "EVENTS" as PermissionModule;

/** Automatic bootstrap recipient: the PLATFORM super_admin role. */
export const PLANNING_DELETE_SUPER_ADMIN_ROLE_KEY = "super_admin";

/** Prefix identifying an already-materialized per-tenant Club Admin role (lib/roles/tenant-role-keys.ts). */
export const TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX = `${CLUB_ADMIN_TEMPLATE_KEY}__`;

export type PlanningDeletePermissionDef = {
  key: string;
  name: string;
  module: PermissionModule;
  scope: PermissionScope;
  grantableByAdmin: boolean;
};

export const TRAININGS_DELETE_PERMISSION_DEF: PlanningDeletePermissionDef = {
  key: "trainings.delete",
  name: "Permanently delete trainings",
  module: TRAININGS_MODULE,
  scope: TENANT_SCOPE,
  grantableByAdmin: true,
};

export const MATCHES_DELETE_PERMISSION_DEF: PlanningDeletePermissionDef = {
  key: "matches.delete",
  name: "Permanently delete matches",
  module: EVENTS_MODULE,
  scope: TENANT_SCOPE,
  grantableByAdmin: true,
};

export const TOURNAMENTS_DELETE_PERMISSION_DEF: PlanningDeletePermissionDef = {
  key: "tournaments.delete",
  name: "Permanently delete tournaments",
  module: EVENTS_MODULE,
  scope: TENANT_SCOPE,
  grantableByAdmin: true,
};

/** The fixed, known set of ADMIN-DELETE-02A permissions this reconciliation covers — never generalized to arbitrary future keys. */
export const PLANNING_DELETE_PERMISSION_DEFS: readonly PlanningDeletePermissionDef[] = [
  TRAININGS_DELETE_PERMISSION_DEF,
  MATCHES_DELETE_PERMISSION_DEF,
  TOURNAMENTS_DELETE_PERMISSION_DEF,
];

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

export type PlanningDeletePermissionReconciliationResult = {
  key: string;
  permission: PermissionSyncOutcome;
  superAdmin: RolePermissionSyncOutcome;
  tenantClubAdminRoles: RolePermissionSyncOutcome[];
};

// ── Reconciliation ─────────────────────────────────────────────────────────────

/**
 * Reconciles a single ADMIN-DELETE-02A "<module>.delete" permission and its
 * bootstrap role grants. Idempotent: safe to call multiple times without
 * side effects. Does NOT commit any changes when `dryRun` is true.
 */
export async function reconcilePlanningDeletePermission(
  prisma: PrismaClient,
  def: PlanningDeletePermissionDef,
  dryRun = false,
): Promise<Omit<PlanningDeletePermissionReconciliationResult, "key">> {
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
    PLANNING_DELETE_SUPER_ADMIN_ROLE_KEY,
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
    tenantClubAdminOutcomes.push(await assignPermissionToRole(prisma, role.key, def.key, dryRun));
  }

  return {
    permission: permissionOutcome,
    superAdmin: superAdminOutcome,
    tenantClubAdminRoles: tenantClubAdminOutcomes,
  };
}

/**
 * Reconciles all three ADMIN-DELETE-02A planning-module delete permissions
 * (trainings.delete, matches.delete, tournaments.delete) in one pass.
 */
export async function reconcilePlanningDeletePermissions(
  prisma: PrismaClient,
  dryRun = false,
): Promise<PlanningDeletePermissionReconciliationResult[]> {
  const results: PlanningDeletePermissionReconciliationResult[] = [];

  for (const def of PLANNING_DELETE_PERMISSION_DEFS) {
    const result = await reconcilePlanningDeletePermission(prisma, def, dryRun);
    results.push({ key: def.key, ...result });
  }

  return results;
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
