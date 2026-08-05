/**
 * Phase C — TargetGroup Members API
 *
 * GET /api/target-groups/:id/members
 *
 * Returns the full resolved member list for a TargetGroup including display names,
 * emails, member types, and attribution (which rule clause included them).
 *
 * Auth: ORG_VIEW or ORG_MANAGE
 * Tenant: scoped to the session tenant
 * Isolation: cross-tenant target group access returns 404
 */

import { NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { resolveTargetGroup } from "@/lib/org/target-group-resolver";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;

  // Verify existence and tenant isolation
  const group = await prisma.targetGroup.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, name: true },
  });
  if (!group) return NextResponse.json({ error: "Zielgruppe nicht gefunden." }, { status: 404 });

  const result = await resolveTargetGroup(id, tenant.id);
  if (!result) return NextResponse.json({ error: "Auflösung fehlgeschlagen." }, { status: 500 });

  return NextResponse.json({
    targetGroupId: result.targetGroupId,
    targetGroupName: group.name,
    memberCount: result.memberCount,
    members: result.members,
    resolvedAt: result.resolvedAt,
  });
}
