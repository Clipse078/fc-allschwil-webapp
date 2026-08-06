/**
 * lib/roles/protected.ts
 *
 * Protected-system-role rules for RPERM-05.
 *
 * `Role.isSystem` (RPERM-02, already in `prisma/schema.prisma`) is the
 * stable, non-label-based identifier the task asks us to prefer — no schema
 * change is introduced here. This module centralizes what "protected" means
 * in practice, narrowly, per the task's guidance ("Do not assume Club Admin
 * must be completely immutable... implement the narrowest safe protection
 * model"):
 *
 *   - An `isSystem` role can never be archived, restored-from-non-existence,
 *     deleted, renamed, or have its `scope`/`tenantId` changed via the
 *     RPERM-05 tenant UI.
 *   - An `isSystem` TENANT role additionally has a small, fixed set of
 *     "essential" permissions that can never be unchecked in the permission
 *     matrix — the minimum required for the tenant to retain recovery access
 *     to its own Roles & Permissions module and member-role assignment
 *     (`roles.manage`, `roles.assign`, `users.manage_memberships`). Every
 *     other permission on an `isSystem` role remains fully editable.
 */

import type { PermissionKey } from "@/lib/permissions/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";

/**
 * Permissions that can never be removed from an `isSystem` TENANT role
 * (e.g. the per-tenant materialized `club_admin` role). Removing all of
 * these would strand the tenant without any way to manage its own roles or
 * assignments — this is the "essential recovery/admin permissions" the task
 * asks us to protect, kept intentionally minimal.
 */
export const ESSENTIAL_SYSTEM_ROLE_PERMISSIONS: readonly PermissionKey[] = [
  PERMISSIONS.ROLES_MANAGE,
  PERMISSIONS.ROLES_ASSIGN,
  PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
];

export type ProtectableRole = {
  isSystem: boolean;
};

/** True when the role is a protected system role (identity/lifecycle-locked). */
export function isProtectedRole(role: ProtectableRole): boolean {
  return role.isSystem === true;
}

/**
 * Returns the subset of `requestedKeys` that would be illegally removed from
 * an `isSystem` role's current permission set (i.e. essential keys the role
 * currently holds but the request omits). Empty array = the request is safe.
 */
export function findLockedPermissionRemovals(params: {
  isSystem: boolean;
  currentKeys: readonly string[];
  requestedKeys: readonly string[];
}): PermissionKey[] {
  if (!params.isSystem) return [];
  const requested = new Set(params.requestedKeys);
  const current = new Set(params.currentKeys);
  return ESSENTIAL_SYSTEM_ROLE_PERMISSIONS.filter(
    (key) => current.has(key) && !requested.has(key),
  );
}

/** Permission keys that must render as locked/disabled (always-checked) in the matrix UI for a given role. */
export function lockedPermissionKeysForRole(params: {
  isSystem: boolean;
  currentKeys: readonly string[];
}): PermissionKey[] {
  if (!params.isSystem) return [];
  const current = new Set(params.currentKeys);
  return ESSENTIAL_SYSTEM_ROLE_PERMISSIONS.filter((key) => current.has(key));
}
