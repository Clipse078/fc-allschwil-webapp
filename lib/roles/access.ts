/**
 * lib/roles/access.ts
 *
 * Permission sets gating the RPERM-05 tenant Roles & Permissions module.
 * Reuses the pre-existing `roles.view` / `roles.manage` / `roles.assign` /
 * `users.manage_memberships` keys defined in RPERM-02
 * (`lib/permissions/permissions.ts`) — no new permission keys are
 * introduced. Every page/route in this module resolves access via
 * `requireAnyPermission()`/`requireApiAnyPermission()` against one of these
 * sets, live, with the caller's server-resolved `tenantId` — never via
 * `session.user.permissionKeys`.
 */

import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";

/** Read access — overview, detail, effective-access preview. */
export const TENANT_ROLES_VIEW: PermissionKey[] = [
  PERMISSIONS.ROLES_VIEW,
  PERMISSIONS.ROLES_MANAGE,
];

/** Create/edit/archive/restore a role, and edit its permission matrix. */
export const TENANT_ROLES_MANAGE: PermissionKey[] = [PERMISSIONS.ROLES_MANAGE];

/** Assign/remove a tenant role on a tenant member. */
export const TENANT_ROLES_ASSIGN: PermissionKey[] = [
  PERMISSIONS.ROLES_MANAGE,
  PERMISSIONS.ROLES_ASSIGN,
];
