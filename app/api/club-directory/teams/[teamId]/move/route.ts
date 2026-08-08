import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import { getExternalTeamById } from "@/lib/club-directory/query-service";
import {
  ClubDirectoryNotFoundError,
  ClubDirectoryValidationError,
  moveExternalTeamToClub,
} from "@/lib/club-directory/mutation-service";

type RouteContext = { params: Promise<{ teamId: string }> };

/**
 * Moves (re-parents) an ExternalTeam onto a different canonical
 * ExternalClub — e.g. correcting "BSC Old Boys B1" from its own mistaken
 * club shell onto the real "BSC Old Boys" club. Provider identity
 * (ExternalTeamProviderMapping) is untouched; see moveExternalTeamToClub.
 */
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
  const body = await request.json().catch(() => ({}));
  const targetExternalClubId = typeof body?.targetExternalClubId === "string" ? body.targetExternalClubId : "";

  const existingTeam = await getExternalTeamById(createClubDirectoryQueryDatabase(prisma), {
    tenantId: tenant.id,
    id: teamId,
  });

  try {
    const team = await moveExternalTeamToClub(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      id: teamId,
      targetExternalClubId,
    });

    revalidatePath("/dashboard/vereine");
    revalidatePath(`/dashboard/vereine/teams/${teamId}/edit`);
    if (existingTeam) {
      revalidatePath(`/dashboard/vereine/${existingTeam.externalClubId}`);
    }
    revalidatePath(`/dashboard/vereine/${team.externalClubId}`);

    return NextResponse.json({ team });
  } catch (error) {
    if (error instanceof ClubDirectoryNotFoundError) {
      return NextResponse.json({ error: "Team oder Ziel-Verein nicht gefunden." }, { status: 404 });
    }
    if (error instanceof ClubDirectoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Team konnte nicht verschoben werden." }, { status: 500 });
  }
}
