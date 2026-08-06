/**
 * /api/tenant/roles — tenant-scoped role list/create.
 *
 * GET  → list every TENANT-scoped role owned by the caller's active tenant.
 *        Permission: roles.view OR roles.manage.
 * POST → create a tenant custom role. scope is always forced to TENANT and
 *        tenantId is always the caller's active tenant — the request body
 *        cannot influence either. Create + permission assignment is atomic.
 *        Permission: roles.manage.
 *
 * Tenant id and actor id are derived exclusively from the authenticated
 * session (see lib/roles/api-context.ts) — never trusted from the request.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { TENANT_ROLES_MANAGE, TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import { createTenantRole } from "@/lib/roles/mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";

export async function GET() {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_VIEW);
  if (!guard.ok) return guard.response;

  const roles = await getTenantRolesOverview(guard.context.tenantId);
  return NextResponse.json({ roles });
}

export async function POST(request: NextRequest) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_MANAGE);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name : "";
  const description =
    body.description === null || body.description === undefined
      ? null
      : String(body.description);
  const permissionKeys: string[] = Array.isArray(body.permissionKeys)
    ? body.permissionKeys.filter((k: unknown): k is string => typeof k === "string")
    : [];
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

  try {
    const role = await createTenantRole({
      tenantId: guard.context.tenantId,
      name,
      description,
      permissionKeys,
      isActive,
      actorUserId: guard.context.actorUserId,
    });
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
