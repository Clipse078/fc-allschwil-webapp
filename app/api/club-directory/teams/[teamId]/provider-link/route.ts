import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import {
  ClubDirectoryConflictError,
  ClubDirectoryNotFoundError,
  ClubDirectoryValidationError,
  linkExternalTeamProvider,
} from "@/lib/club-directory/mutation-service";

type RouteContext = { params: Promise<{ teamId: string }> };

/**
 * Links (or re-syncs) a provider identity to an ExternalTeam. See
 * clubs/[clubId]/provider-link/route.ts — same "no live SFV call" note
 * applies here.
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

  const providerTeamId = Number(body?.providerTeamId);

  try {
    const result = await linkExternalTeamProvider(
      createClubDirectoryMutationDatabase(prisma),
      {
        tenantId: tenant.id,
        externalTeamId: teamId,
        provider: body?.provider ?? "",
        providerTeamId,
        providerSeasonId: body?.providerSeasonId !== undefined ? Number(body.providerSeasonId) : undefined,
        providerTeamName: body?.providerTeamName ?? null,
        providerClubId: body?.providerClubId !== undefined ? Number(body.providerClubId) : null,
        providerOrganisationId:
          body?.providerOrganisationId !== undefined ? Number(body.providerOrganisationId) : null,
        providerLogoUrl: body?.providerLogoUrl ?? null,
        providerIsActive: body?.providerIsActive ?? true,
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ClubDirectoryNotFoundError) {
      return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
    }
    if (error instanceof ClubDirectoryConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ClubDirectoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Anbieter-Verknüpfung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
