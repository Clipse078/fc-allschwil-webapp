/**
 * lib/roles/api-context.ts
 *
 * Shared API-route guard for the RPERM-05 tenant Roles & Permissions
 * endpoints. Combines the canonical live permission check
 * (`requireApiAnyPermission`) with the canonical tenant-resolution helper
 * (`session.user.activeTenantId` — never a client-submitted tenant id) into
 * a single call, matching the pattern already used by
 * `app/api/workspace/folders/route.ts`.
 */

import { NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import type { PermissionKey } from "@/lib/permissions/permissions";

export type TenantRoleApiContext = {
  tenantId: string;
  actorUserId: string;
};

export type TenantRoleApiGuardResult =
  | { ok: true; context: TenantRoleApiContext }
  | { ok: false; response: NextResponse };

/**
 * Resolves live permission access (`permissionKeys`, checked against the
 * caller's own `activeTenantId`) and the active tenant id together. Returns
 * a ready-to-return `NextResponse` on failure so route handlers can
 * one-line the guard:
 *
 *   const guard = await requireTenantRoleApiContext(TENANT_ROLES_MANAGE);
 *   if (!guard.ok) return guard.response;
 *   const { tenantId, actorUserId } = guard.context;
 */
export async function requireTenantRoleApiContext(
  permissionKeys: PermissionKey[],
): Promise<TenantRoleApiGuardResult> {
  const access = await requireApiAnyPermission(permissionKeys);

  if (!access.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: access.error }, { status: access.status }),
    };
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Kein Mandanten-Kontext in der Sitzung." }, { status: 403 }),
    };
  }

  const actorUserId = access.session.user?.id;
  if (!actorUserId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, context: { tenantId, actorUserId } };
}
