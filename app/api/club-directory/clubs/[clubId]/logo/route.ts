import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { executeExternalClubLogoUpload } from "@/lib/assets/club-logo-upload";

type RouteContext = { params: Promise<{ clubId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  const { clubId } = await params;
  const club = await prisma.externalClub.findFirst({
    where: { id: clubId, tenantId: tenant.id },
    select: { id: true, logoUrl: true },
  });

  if (!club) {
    return NextResponse.json({ error: "Verein nicht gefunden." }, { status: 404 });
  }

  const response = await executeExternalClubLogoUpload(request, tenant.key, club);

  if (response.status === 200) {
    revalidatePath("/dashboard/vereine");
    revalidatePath(`/dashboard/vereine/${clubId}`);
  }

  return response;
}
