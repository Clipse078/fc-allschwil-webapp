/**
 * /api/tenant/effective-access — read-only effective-access diagnostic.
 *
 * GET ?userId= → assigned tenant roles, platform roles (shown separately),
 *   and deduplicated effective permission keys for a member of the
 *   caller's active tenant, computed entirely by
 *   `EffectivePermissionResolver` (RPERM-03) — never recalculated here.
 *   404 when the target user has no TenantMembership row for this exact
 *   tenant (never reveals whether the user exists elsewhere).
 *   Permission: roles.view OR roles.manage.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getUserEffectiveAccessView } from "@/lib/roles/effective-access";

export async function GET(request: NextRequest) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_VIEW);
  if (!guard.ok) return guard.response;

  const userId = request.nextUrl.searchParams.get("userId") ?? "";
  if (!userId) {
    return NextResponse.json({ error: "userId ist erforderlich." }, { status: 400 });
  }

  const view = await getUserEffectiveAccessView(guard.context.tenantId, userId);
  if (!view) {
    return NextResponse.json({ error: "Benutzer nicht in diesem Mandanten gefunden." }, { status: 404 });
  }

  return NextResponse.json({ view });
}
