/**
 * lib/permissions/registrations-delete-permission-reconciliation.ts
 *
 * ADMIN-DELETE-03B — idempotent registrations.delete permission backfill.
 *
 * Mirrors lib/permissions/workspace-delete-permission-reconciliation.ts
 * (ADMIN-DELETE-03A) — the established, already-accepted pattern for patching
 * a single newly-added "<module>.delete" permission onto an already-seeded
 * database, reused here for the registrations.delete permission rather than
 * reinvented.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * prisma/seed.ts is NOT automatically re-run after a deploy. Any STAGE/
 * production database seeded before the ADMIN-DELETE-03B commit added
 * registrations.delete to prisma/seed.ts is missing:
 *   - the Permission row entirely, and
 *   - its RolePermission assignment to `super_admin` and to every tenant's
 *     already-materialized Club Admin role.
 *
 * ── What this reconciles ─────────────────────────────────────────────────────
 *   - Permission row (module=REGISTRATIONS / scope=TENANT / grantableByAdmin=true —
 *     matches prisma/seed.ts exactly).
 *   - RolePermission: super_admin (PLATFORM role) → registrations.delete.
 *   - RolePermission: every already-materialized per-tenant Club Admin role
 *     (scope=TENANT, isSystem=true, key matching `club_admin__<tenantKey>`
 *     from lib/roles/tenant-role-keys.ts) → registrations.delete.
 *
 * Deliberately does NOT touch any other role — delegated/custom tenant roles
 * only receive this permission through the existing Roles & Permissions
 * delegation UI (grantableByAdmin: true), never automatically here.
 *
 * All writes use upsert — safe to re-run any number of times. No deletes.
 *
 * IMPORTANT: Do NOT execute this reconciliation against the STAGE database
 * as part of this implementation task. The script
 * scripts/sync-registrations-delete-permission.ts wraps it for controlled,
 * deliberate execution.
 */

import type { PermissionModule, PermissionScope, PrismaClient } from "@prisma/client";
import { CLUB_ADMIN_TEMPLATE_KEY } from "@/lib/roles/tenant-role-keys";

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_SCOPE = "TENANT" as PermissionScope;
const REGISTRATIONS_MODULE = "REGISTRATIONS" as PermissionModule;

export const REGISTRATIONS_DELETE_SUPER_ADMIN_ROLE_KEY = "super_admin";
export const REGISTRATIONS_DELETE_CLUB_ADMIN_KEY_PREFIX = `${CLUB_ADMIN_TEMPLATE_KEY}__`;

export const REGISTRATIONS_DELETE_PERMISSION_DEF = {
  key: "registrations.delete",
  name: "Permanently delete registrations",
  module: REGISTRATIONS_MODULE,
  scope: TENANT_SCOPE,
  grantableByAdmin: true,
} as const;

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

export type RegistrationsDeletePermissionReconciliationResult = {
  permission: PermissionSyncOutcome;
  superAdmin: RolePermissionSyncOutcome;
  tenantClubAdminRoles: RolePermissionSyncOutcome[];
};

// ── Reconciliation ─────────────────────────────────────────────────────────────

/**
 * Reconciles the ADMIN-DELETE-03B registrations.delete permission and its
 * bootstrap role grants. Idempotent: safe to call multiple times without
 * side effects. Does NOT commit any changes when `dryRun` is true.
 */
export async function reconcileRegistrationsDeletePermission(
  prisma: PrismaClient,
  dryRun = false,
): Promise<RegistrationsDeletePermissionReconciliationResult> {
  const def = REGISTRATIONS_DELETE_PERMISSION_DEF;

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

    permissionOutcome = {
      action: needsUpdate ? "updated" : "already_exists",
      key: def.key,
    };
  } else {
    permissionOutcome = { action: "created", key: def.key };
  }

  if (!dryRun) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: {
        name: def.name,
        module: def.module,
        scope: def.scope,
        grantableByAdmin: def.grantableByAdmin,
      },
      create: {
        key: def.key,
        name: def.name,
        module: def.module,
        scope: def.scope,
        grantableByAdmin: def.grantableByAdmin,
      },
    });
  }

  // ── Step 2: Grant to super_admin (PLATFORM) ─────────────────────────────────
  const superAdminOutcome = await assignPermissionToRole(
    prisma,
    REGISTRATIONS_DELETE_SUPER_ADMIN_ROLE_KEY,
    def.key,
    dryRun,
  );

  // ── Step 3: Grant to every already-materialized tenant Club Admin role ─────
  const tenantClubAdminRoles = await prisma.role.findMany({
    where: {
      scope: "TENANT",
      isSystem: true,
      key: { startsWith: REGISTRATIONS_DELETE_CLUB_ADMIN_KEY_PREFIX },
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
  const role = await prisma.role.findUnique({
    where: { key: roleKey },
    select: { id: true },
  });

  if (!role) {
    return { action: "role_not_found", roleKey, permissionKey };
  }

  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    select: { id: true },
  });

  if (!permission) {
    return { action: "permission_not_in_db", roleKey, permissionKey };
  }

  const existing = await prisma.rolePermission.findUnique({
    where: {
      roleId_permissionId: { roleId: role.id, permissionId: permission.id },
    },
    select: { roleId: true },
  });

  const outcome: RolePermissionSyncOutcome = existing
    ? { action: "already_assigned", roleKey, permissionKey }
    : { action: "assigned", roleKey, permissionKey };

  if (!dryRun) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  return outcome;
}
