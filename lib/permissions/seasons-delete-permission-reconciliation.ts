/**
 * lib/permissions/seasons-delete-permission-reconciliation.ts
 *
 * ADMIN-DELETE-SEASON-01 — idempotent seasons.delete backfill.
 *
 * Mirrors lib/permissions/planning-modules-delete-permission-reconciliation.ts
 * (ADMIN-DELETE-02A) — the established, already-accepted pattern for patching a
 * single newly-added "<module>.delete" permission onto an already-seeded database.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * prisma/seed.ts is NOT automatically re-run after a deploy. Any STAGE/production
 * database seeded before the ADMIN-DELETE-SEASON-01 commit added `seasons.delete`
 * to prisma/seed.ts is missing:
 *   - the `seasons.delete` Permission row entirely, and
 *   - its RolePermission assignment to `super_admin` and to every tenant's
 *     already-materialized Club Admin role.
 *
 * ── What this reconciles ─────────────────────────────────────────────────────
 *   - Permission row: seasons.delete (module=SEASONS, scope=TENANT,
 *     grantableByAdmin=true) — matches prisma/seed.ts exactly.
 *   - RolePermission: super_admin (PLATFORM role) → seasons.delete.
 *   - RolePermission: every already-materialized per-tenant Club Admin role
 *     (Role rows with scope=TENANT, isSystem=true, key matching the
 *     `club_admin__<tenantKey>` convention) → seasons.delete.
 *
 * All writes use upsert — safe to re-run any number of times. No deletes.
 */

import type { PermissionModule, PermissionScope, PrismaClient } from "@prisma/client";
import { CLUB_ADMIN_TEMPLATE_KEY } from "@/lib/roles/tenant-role-keys";

const SEASONS_MODULE = "SEASONS" as PermissionModule;
const TENANT_SCOPE = "TENANT" as PermissionScope;

export const SEASONS_DELETE_PERMISSION_DEF = {
  key: "seasons.delete",
  name: "Permanently delete seasons",
  module: SEASONS_MODULE,
  scope: TENANT_SCOPE,
  grantableByAdmin: true,
} as const;

export const SEASONS_DELETE_SUPER_ADMIN_ROLE_KEY = "super_admin";
export const TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX = `${CLUB_ADMIN_TEMPLATE_KEY}__`;

export type PermissionSyncOutcome =
  | { action: "created"; key: string }
  | { action: "already_exists"; key: string }
  | { action: "updated"; key: string };

export type RolePermissionSyncOutcome =
  | { action: "assigned"; roleKey: string; permissionKey: string }
  | { action: "already_assigned"; roleKey: string; permissionKey: string }
  | { action: "role_not_found"; roleKey: string; permissionKey: string }
  | { action: "permission_not_in_db"; roleKey: string; permissionKey: string };

export type SeasonsDeleteReconciliationResult = {
  permission: PermissionSyncOutcome;
  superAdmin: RolePermissionSyncOutcome;
  tenantClubAdminRoles: RolePermissionSyncOutcome[];
};

export async function reconcileSeasonsDeletePermission(
  prisma: PrismaClient,
  dryRun = false,
): Promise<SeasonsDeleteReconciliationResult> {
  const def = SEASONS_DELETE_PERMISSION_DEF;

  // Step 1: Ensure the Permission row exists
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

  // Step 2: Grant to super_admin (PLATFORM)
  const superAdminOutcome = await assignPermissionToRole(
    prisma,
    SEASONS_DELETE_SUPER_ADMIN_ROLE_KEY,
    def.key,
    dryRun,
  );

  // Step 3: Grant to every already-materialized tenant Club Admin role
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
