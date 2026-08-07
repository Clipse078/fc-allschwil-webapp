import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import {
  ClubDirectoryNotFoundError,
  setExternalClubArchived,
} from "@/lib/club-directory/mutation-service";

type RouteContext = { params: Promise<{ clubId: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  const { clubId } = await params;

  try {
    const club = await setExternalClubArchived(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      id: clubId,
      archived: false,
    });

    revalidatePath("/dashboard/vereine");
    revalidatePath(`/dashboard/vereine/${clubId}`);

    return NextResponse.json({ club, message: "Verein wurde wiederhergestellt." });
  } catch (error) {
    if (error instanceof ClubDirectoryNotFoundError) {
      return NextResponse.json({ error: "Verein nicht gefunden." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Wiederherstellung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
