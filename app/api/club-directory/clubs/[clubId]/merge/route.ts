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
  mergeExternalClubs,
} from "@/lib/club-directory/mutation-service";

type RouteContext = { params: Promise<{ clubId: string }> };

/**
 * Manually merges one or more explicitly-chosen "losing" ExternalClub
 * duplicates into the ExternalClub identified by `clubId` (the surviving
 * canonical club). Never inferred from names — the tenant admin picks
 * both sides. See mergeExternalClubs for the full safety contract (teams
 * moved, provider mappings re-pointed, losing clubs archived — never
 * deleted).
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

  const { clubId } = await params;
  const body = await request.json().catch(() => ({}));
  const losingClubIds: string[] = Array.isArray(body?.losingClubIds)
    ? body.losingClubIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  try {
    const result = await mergeExternalClubs(createClubDirectoryMutationDatabase(prisma), {
      tenantId: tenant.id,
      survivingClubId: clubId,
      losingClubIds,
    });

    revalidatePath("/dashboard/vereine");
    revalidatePath(`/dashboard/vereine/${clubId}`);
    for (const mergedClubId of result.mergedClubIds) {
      revalidatePath(`/dashboard/vereine/${mergedClubId}`);
    }

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof ClubDirectoryNotFoundError) {
      return NextResponse.json(
        { error: "Verein (Ziel oder zu vereinigende Vereine) nicht gefunden." },
        { status: 404 },
      );
    }
    if (error instanceof ClubDirectoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Vereine konnten nicht zusammengeführt werden." }, { status: 500 });
  }
}
