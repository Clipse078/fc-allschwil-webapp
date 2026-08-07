import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import {
  ClubDirectoryNotFoundError,
  ClubDirectoryValidationError,
  createExternalTeam,
} from "@/lib/club-directory/mutation-service";

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
  const body = await request.json().catch(() => ({}));

  try {
    const team = await createExternalTeam(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      externalClubId: clubId,
      name: body?.name ?? "",
      shortName: body?.shortName ?? null,
      alternativeName: body?.alternativeName ?? null,
      categoryLabel: body?.categoryLabel ?? null,
    });

    revalidatePath(`/dashboard/vereine/${clubId}`);

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    if (error instanceof ClubDirectoryNotFoundError) {
      return NextResponse.json({ error: "Verein nicht gefunden." }, { status: 404 });
    }
    if (error instanceof ClubDirectoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Team konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
