/**
 * lib/permissions/training-permission-reconciliation.ts
 *
 * Extracted reconciliation logic for training permissions.
 *
 * This module is the testable core of scripts/sync-training-permissions.ts.
 * The script is a CLI wrapper; this module contains the idempotent business logic.
 *
 * Reconciles:
 *   - trainings.view  (PermissionModule.TRAININGS)
 *   - trainings.manage (PermissionModule.TRAININGS)
 *
 * Automatic bootstrap policy (STAGE-OPS-03B):
 *   super_admin → trainings.view + trainings.manage   (only automatic recipient)
 *
 * No canonical club-admin role currently exists in this repository.
 * Automatic bootstrap therefore remains limited to super_admin until the
 * future Roles & Permissions module introduces club-admin support.
 *
 * Trainers and all other operational users receive training permissions only
 * through explicit assignment via a custom role created by a super_admin in
 * /dashboard/roles. No automatic grants to trainer or any other role.
 *
 * Cleanup (STAGE-OPS-03B): this script removes the previously-bootstrapped
 * trainer → trainings.view and trainer → trainings.manage RolePermission rows
 * to correct the over-permissive assignments introduced by STAGE-OPS-03 and
 * STAGE-OPS-03A. Permissions obtained through other custom roles are not touched.
 *
 * All writes use upsert — safe to re-run any number of times.
 * No destructive deletes beyond the explicit trainer revocation above.
 * No FC Allschwil tenant ID hardcoded — permissions are global (not tenant-scoped).
 */

import type { PermissionModule, PrismaClient } from "@prisma/client";

// ── Constants ──────────────────────────────────────────────────────────────────

// Use the string literal "TRAININGS" rather than PermissionModule.TRAININGS (the
// runtime enum object from the generated client) to guard against the case where
// the Prisma client was generated before migration
// 20260727400000_training_core_01_canonical_foundation was applied. In that
// stale-client scenario PermissionModule.TRAININGS is undefined, which Prisma
// rejects with "Argument `module` is missing." Using the canonical string value
// directly makes the reconciliation robust regardless of client generation time.
const TRAINING_MODULE = "TRAININGS" as PermissionModule;

export const TRAINING_PERMISSION_DEFS = [
  {
    key: "trainings.view",
    name: "View training allocations",
    module: TRAINING_MODULE,
  },
  {
    key: "trainings.manage",
    name: "Manage training allocations",
    module: TRAINING_MODULE,
  },
] as const;

/**
 * Per-role automatic bootstrap assignment policy.
 *
 * Only roles listed here receive training permissions during reconciliation.
 * No canonical club-admin role exists yet; super_admin is the sole automatic
 * recipient until the Roles & Permissions module adds club-admin support.
 */
export const TRAINING_ROLE_ASSIGNMENTS = [
  {
    roleKey: "super_admin",
    permissionKeys: ["trainings.view", "trainings.manage"] as const,
  },
  // No entry for trainer or any operational role:
  // trainer receives training permissions only via explicit custom-role assignment.
] as const;

/**
 * Role-permission pairs to revoke during reconciliation.
 *
 * Removes the over-permissive assignments bootstrapped by STAGE-OPS-03/03A.
 * Only the exact trainer assignments are targeted; custom-role grants are
 * untouched (the revocation matches by roleKey + permissionKey, not by role ID).
 */
export const TRAINING_PERMISSION_REVOCATIONS = [
  { roleKey: "trainer", permissionKey: "trainings.view" },
  { roleKey: "trainer", permissionKey: "trainings.manage" },
] as const;

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

export type RolePermissionRevocationOutcome =
  | { action: "revoked"; roleKey: string; permissionKey: string }
  | { action: "not_present"; roleKey: string; permissionKey: string }
  | { action: "role_not_found"; roleKey: string; permissionKey: string }
  | { action: "permission_not_in_db"; roleKey: string; permissionKey: string };

export type ReconciliationResult = {
  permissions: PermissionSyncOutcome[];
  rolePermissions: RolePermissionSyncOutcome[];
  revocations: RolePermissionRevocationOutcome[];
};

// ── Reconciliation ─────────────────────────────────────────────────────────────

/**
 * Reconciles training permissions in the database.
 *
 * Idempotent: safe to call multiple times without side effects.
 * Does NOT commit any changes when dryRun is true.
 *
 * Step 1: Ensure Permission rows exist (trainings.view, trainings.manage).
 * Step 2: Grant permissions to roles per TRAINING_ROLE_ASSIGNMENTS.
 * Step 3: Revoke obsolete trainer bootstrap grants per TRAINING_PERMISSION_REVOCATIONS.
 *
 * @param prisma - Prisma client to use for all DB operations
 * @param dryRun - When true, checks state but makes no writes
 */
export async function reconcileTrainingPermissions(
  prisma: PrismaClient,
  dryRun = false,
): Promise<ReconciliationResult> {
  const permissionOutcomes: PermissionSyncOutcome[] = [];
  const rolePermissionOutcomes: RolePermissionSyncOutcome[] = [];
  const revocationOutcomes: RolePermissionRevocationOutcome[] = [];

  // ── Step 1: Ensure Permission rows exist ─────────────────────────────────────
  for (const def of TRAINING_PERMISSION_DEFS) {
    const existing = await prisma.permission.findUnique({
      where: { key: def.key },
      select: { id: true, name: true, module: true },
    });

    if (existing) {
      const needsUpdate = existing.name !== def.name || existing.module !== def.module;
      permissionOutcomes.push({ action: needsUpdate ? "updated" : "already_exists", key: def.key });
    } else {
      permissionOutcomes.push({ action: "created", key: def.key });
    }

    if (!dryRun) {
      await prisma.permission.upsert({
        where: { key: def.key },
        update: { name: def.name, module: def.module },
        create: { key: def.key, name: def.name, module: def.module },
      });
    }
  }

  // ── Step 2: Grant permissions to bootstrap roles ──────────────────────────────
  for (const assignment of TRAINING_ROLE_ASSIGNMENTS) {
    const { roleKey, permissionKeys } = assignment;

    const role = await prisma.role.findUnique({
      where: { key: roleKey },
      select: { id: true },
    });

    if (!role) {
      for (const permissionKey of permissionKeys) {
        rolePermissionOutcomes.push({ action: "role_not_found", roleKey, permissionKey });
      }
      continue;
    }

    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permission.findUnique({
        where: { key: permissionKey },
        select: { id: true },
      });

      if (!permission) {
        // Permission row does not exist yet — only possible in dry-run mode
        // (apply mode upserts all permission rows in step 1 above).
        rolePermissionOutcomes.push({ action: "permission_not_in_db", roleKey, permissionKey });
        continue;
      }

      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        select: { roleId: true },
      });

      if (existing) {
        rolePermissionOutcomes.push({ action: "already_assigned", roleKey, permissionKey });
      } else {
        rolePermissionOutcomes.push({ action: "assigned", roleKey, permissionKey });
      }

      if (!dryRun) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permission.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }

  // ── Step 3: Revoke obsolete trainer bootstrap grants ─────────────────────────
  for (const { roleKey, permissionKey } of TRAINING_PERMISSION_REVOCATIONS) {
    const role = await prisma.role.findUnique({
      where: { key: roleKey },
      select: { id: true },
    });

    if (!role) {
      revocationOutcomes.push({ action: "role_not_found", roleKey, permissionKey });
      continue;
    }

    const permission = await prisma.permission.findUnique({
      where: { key: permissionKey },
      select: { id: true },
    });

    if (!permission) {
      revocationOutcomes.push({ action: "permission_not_in_db", roleKey, permissionKey });
      continue;
    }

    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
      },
      select: { roleId: true },
    });

    if (!existing) {
      revocationOutcomes.push({ action: "not_present", roleKey, permissionKey });
    } else {
      revocationOutcomes.push({ action: "revoked", roleKey, permissionKey });
    }

    if (!dryRun && existing) {
      await prisma.rolePermission.delete({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
      });
    }
  }

  return { permissions: permissionOutcomes, rolePermissions: rolePermissionOutcomes, revocations: revocationOutcomes };
}
