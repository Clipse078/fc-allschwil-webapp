/**
 * /api/people/[id]/link-user — ADMIN-MASTERDATA-UX-01-C1.
 *
 * POST   → link this Person to an existing, eligible tenant User
 *          ({ userId } in body). Eligible = active TenantMembership in
 *          the caller's active tenant (same rule as tenant role
 *          assignment) and not already linked to a different Person.
 * DELETE → clears Person.userId only. Never touches the User, its
 *          TenantMembership, or any UserRole.
 *
 * Permission: roles.manage OR roles.assign (TENANT_ROLES_ASSIGN) — the
 * same authority that already gates tenant role assignment, per the
 * task's "existing appropriate roles-management authority" requirement.
 * No new permission is introduced.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { TENANT_ROLES_ASSIGN } from "@/lib/roles/access";
import { linkPersonToUser, unlinkPersonFromUser } from "@/lib/people/mutations";
import { toPersonLinkApiErrorResponse } from "@/lib/people/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_ASSIGN);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";

  if (!userId) {
    return NextResponse.json({ error: "userId ist erforderlich." }, { status: 400 });
  }

  try {
    const result = await linkPersonToUser({
      personId: id,
      userId,
      tenantId: guard.context.tenantId,
      actorUserId: guard.context.actorUserId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, body: errorBody } = toPersonLinkApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_ASSIGN);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await unlinkPersonFromUser({
      personId: id,
      actorUserId: guard.context.actorUserId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, body: errorBody } = toPersonLinkApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
