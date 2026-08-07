import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import {
  CLUB_DIRECTORY_DEFAULT_LIMIT,
  listExternalClubs,
} from "@/lib/club-directory/query-service";
import {
  ClubDirectoryValidationError,
  createExternalClub,
} from "@/lib/club-directory/mutation-service";

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const rawLimit = searchParams.get("limit");
  const rawSkip = searchParams.get("skip");

  try {
    const clubs = await listExternalClubs(createClubDirectoryQueryDatabase(prisma), {
      tenantId: tenant.id,
      search: searchParams.get("search") ?? undefined,
      includeArchived: searchParams.get("includeArchived") === "true",
      limit: rawLimit !== null ? parseInt(rawLimit, 10) : CLUB_DIRECTORY_DEFAULT_LIMIT,
      skip: rawSkip !== null ? parseInt(rawSkip, 10) : 0,
    });

    return NextResponse.json({ clubs });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const club = await createExternalClub(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      name: body?.name ?? "",
      shortName: body?.shortName ?? null,
      alternativeName: body?.alternativeName ?? null,
      website: body?.website ?? null,
      location: body?.location ?? null,
      notes: body?.notes ?? null,
    });

    return NextResponse.json({ club }, { status: 201 });
  } catch (error) {
    if (error instanceof ClubDirectoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Verein konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
