/**
 * /api/tenant/roles/[id] — tenant-scoped role detail/update.
 *
 * GET   → role detail (permissions + assigned users). 404 for a role that
 *         does not exist, belongs to another tenant, or is PLATFORM-scoped
 *         — the response never distinguishes these cases.
 *         Permission: roles.view OR roles.manage.
 * PATCH → rename / edit description / archive / restore. Protected
 *         (isSystem) roles reject identity or archive-state changes.
 *         Permission: roles.manage.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { TENANT_ROLES_MANAGE, TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getTenantRoleDetail } from "@/lib/roles/tenant-queries";
import { updateTenantRoleDetails } from "@/lib/roles/mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_VIEW);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const role = await getTenantRoleDetail(guard.context.tenantId, id);
  if (!role) {
    return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ role });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_MANAGE);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const role = await updateTenantRoleDetails({
      tenantId: guard.context.tenantId,
      roleId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      description:
        body.description === undefined
          ? undefined
          : body.description === null
            ? null
            : String(body.description),
      isArchived: typeof body.isArchived === "boolean" ? body.isArchived : undefined,
      actorUserId: guard.context.actorUserId,
    });
    return NextResponse.json({ role });
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
