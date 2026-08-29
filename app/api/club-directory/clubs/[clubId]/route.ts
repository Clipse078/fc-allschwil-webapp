import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import { getExternalClubById } from "@/lib/club-directory/query-service";
import {
  ClubDirectoryNotFoundError,
  ClubDirectoryValidationError,
  setExternalClubArchived,
  updateExternalClub,
} from "@/lib/club-directory/mutation-service";

type RouteContext = { params: Promise<{ clubId: string }> };

function errorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ClubDirectoryNotFoundError) {
    return NextResponse.json({ error: "Verein nicht gefunden." }, { status: 404 });
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

  const { clubId } = await params;
  const club = await getExternalClubById(createClubDirectoryQueryDatabase(prisma), {
    tenantId: tenant.id,
    id: clubId,
  });

  if (!club) {
    return NextResponse.json({ error: "Verein nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ club });
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

  const { clubId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const club = await updateExternalClub(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      id: clubId,
      ...(body?.name !== undefined ? { name: body.name } : {}),
      ...(body?.shortName !== undefined ? { shortName: body.shortName } : {}),
      ...(body?.alternativeName !== undefined ? { alternativeName: body.alternativeName } : {}),
      ...(body?.website !== undefined ? { website: body.website } : {}),
      ...(body?.location !== undefined ? { location: body.location } : {}),
      ...(body?.notes !== undefined ? { notes: body.notes } : {}),
      ...(body?.logoContrastMode !== undefined
        ? { logoContrastMode: body.logoContrastMode }
        : {}),
    });

    revalidatePath("/dashboard/vereine");
    revalidatePath(`/dashboard/vereine/${clubId}`);

    return NextResponse.json({ club });
  } catch (error) {
    return errorResponse(error, "Verein konnte nicht aktualisiert werden.");
  }
}

/** Soft-archives the club (status → archivedAt set). Mirrors the org-units DELETE convention. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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
    await setExternalClubArchived(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      id: clubId,
      archived: true,
    });

    revalidatePath("/dashboard/vereine");
    return NextResponse.json({ message: "Verein wurde archiviert." });
  } catch (error) {
    return errorResponse(error, "Verein konnte nicht archiviert werden.");
  }
}
