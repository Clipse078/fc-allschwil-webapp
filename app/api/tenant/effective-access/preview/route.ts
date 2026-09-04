/**
 * POST /api/tenant/effective-access/preview
 *
 * Read-only preview of effective access for a set of tenant role IDs.
 * Used by the add-person review step — does not mutate anything.
 *
 * Permission: users.view | users.manage | roles.view | roles.manage
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getEffectiveAccessSummaryFromRoleIds } from "@/lib/roles/effective-access-summary";

export async function POST(request: NextRequest) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_VIEW,
    PERMISSIONS.ROLES_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext in der Sitzung." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfrage-Inhalt." }, { status: 400 });
  }

  const roleIds = Array.isArray((body as { roleIds?: unknown })?.roleIds)
    ? ((body as { roleIds: unknown[] }).roleIds.filter((id) => typeof id === "string") as string[])
    : [];

  const summary = await getEffectiveAccessSummaryFromRoleIds(tenantId, roleIds);
  return NextResponse.json({ summary });
}
