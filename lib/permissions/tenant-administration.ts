import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";

/**
 * Existing user-administration authorities that identify administrators able
 * to manage the active tenant. `users.manage` preserves platform-admin access;
 * `users.manage_memberships` is the tenant-scoped authority held by the
 * protected Club Admin role.
 */
export const TENANT_ADMINISTRATION_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
];
