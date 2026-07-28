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
 * Role assignments (matches canonical seed.ts):
 *   - super_admin → both
 *   - trainer     → both
 *
 * All writes use upsert — safe to re-run any number of times.
 * No destructive deletes, no permission downgrades, no broad grants.
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

export const TRAINING_PERMISSION_ROLE_KEYS = ["super_admin", "trainer"] as const;

// ── Result types ───────────────────────────────────────────────────────────────

export type PermissionSyncOutcome =
  | { action: "created"; key: string }
  | { action: "already_exists"; key: string }
  | { action: "updated"; key: string };

export type RolePermissionSyncOutcome =
  | { action: "assigned"; roleKey: string; permissionKey: string }
  | { action: "already_assigned"; roleKey: string; permissionKey: string }
  | { action: "role_not_found"; roleKey: string; permissionKey: string };

export type ReconciliationResult = {
  permissions: PermissionSyncOutcome[];
  rolePermissions: RolePermissionSyncOutcome[];
};

// ── Reconciliation ─────────────────────────────────────────────────────────────

/**
 * Reconciles training permissions in the database.
 *
 * Idempotent: safe to call multiple times without side effects.
 * Does NOT commit any changes when dryRun is true.
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

  // 1. Ensure Permission rows exist
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

  // 2. Assign permissions to roles
  for (const roleKey of TRAINING_PERMISSION_ROLE_KEYS) {
    const role = await prisma.role.findUnique({
      where: { key: roleKey },
      select: { id: true },
    });

    if (!role) {
      for (const def of TRAINING_PERMISSION_DEFS) {
        rolePermissionOutcomes.push({
          action: "role_not_found",
          roleKey,
          permissionKey: def.key,
        });
      }
      continue;
    }

    for (const def of TRAINING_PERMISSION_DEFS) {
      const permission = await prisma.permission.findUnique({
        where: { key: def.key },
        select: { id: true },
      });

      if (!permission) {
        // Should not happen if the permission upsert above ran without dryRun
        rolePermissionOutcomes.push({
          action: "role_not_found",
          roleKey,
          permissionKey: def.key,
        });
        continue;
      }

      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        select: { roleId: true },
      });

      if (existing) {
        rolePermissionOutcomes.push({
          action: "already_assigned",
          roleKey,
          permissionKey: def.key,
        });
      } else {
        rolePermissionOutcomes.push({
          action: "assigned",
          roleKey,
          permissionKey: def.key,
        });
      }

      if (!dryRun) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  return { permissions: permissionOutcomes, rolePermissions: rolePermissionOutcomes };
}
