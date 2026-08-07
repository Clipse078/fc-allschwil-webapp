import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import {
  ClubDirectoryNotFoundError,
  setExternalTeamArchived,
} from "@/lib/club-directory/mutation-service";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  const { teamId } = await params;

  try {
    const team = await setExternalTeamArchived(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      id: teamId,
      archived: false,
    });

    return NextResponse.json({ team, message: "Team wurde wiederhergestellt." });
  } catch (error) {
    if (error instanceof ClubDirectoryNotFoundError) {
      return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Wiederherstellung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
