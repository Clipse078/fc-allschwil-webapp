import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { executeExternalTeamLogoUpload } from "@/lib/assets/club-logo-upload";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  const { teamId } = await params;
  const team = await prisma.externalTeam.findFirst({
    where: { id: teamId, tenantId: tenant.id },
    select: { id: true, logoUrl: true },
  });

  if (!team) {
    return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
  }

  return executeExternalTeamLogoUpload(request, tenant.key, team);
}
