import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import { getExternalTeamById } from "@/lib/club-directory/query-service";
import {
  ClubDirectoryNotFoundError,
  ClubDirectoryValidationError,
  setExternalTeamArchived,
  updateExternalTeam,
} from "@/lib/club-directory/mutation-service";

type RouteContext = { params: Promise<{ teamId: string }> };

function errorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ClubDirectoryNotFoundError) {
    return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
  }
  if (error instanceof ClubDirectoryValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  const { teamId } = await params;
  const team = await getExternalTeamById(createClubDirectoryQueryDatabase(prisma), {
    tenantId: tenant.id,
    id: teamId,
  });

  if (!team) {
    return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ team });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
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

  try {
    const team = await updateExternalTeam(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      id: teamId,
      ...(body?.name !== undefined ? { name: body.name } : {}),
      ...(body?.shortName !== undefined ? { shortName: body.shortName } : {}),
      ...(body?.alternativeName !== undefined ? { alternativeName: body.alternativeName } : {}),
      ...(body?.categoryLabel !== undefined ? { categoryLabel: body.categoryLabel } : {}),
    });

    revalidatePath(`/dashboard/vereine/teams/${teamId}`);

    return NextResponse.json({ team });
  } catch (error) {
    return errorResponse(error, "Team konnte nicht aktualisiert werden.");
  }
}

/** Soft-archives the team. Mirrors the org-units DELETE convention. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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
    await setExternalTeamArchived(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      id: teamId,
      archived: true,
    });

    return NextResponse.json({ message: "Team wurde archiviert." });
  } catch (error) {
    return errorResponse(error, "Team konnte nicht archiviert werden.");
  }
}
