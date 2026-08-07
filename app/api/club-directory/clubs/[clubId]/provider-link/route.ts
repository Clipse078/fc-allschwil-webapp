import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import {
  ClubDirectoryConflictError,
  ClubDirectoryNotFoundError,
  ClubDirectoryValidationError,
  linkExternalClubProvider,
} from "@/lib/club-directory/mutation-service";

type RouteContext = { params: Promise<{ clubId: string }> };

/**
 * Links (or re-syncs) a provider identity to an ExternalClub. Manual entry
 * of the provider's numeric club id — no live SFV call is made here (see
 * CLUB-DIRECTORY-01 deliverable notes: "Do NOT call SFV live per Matchcenter
 * row" extends to this admin action too; a future live-refresh action can
 * call this same service function with freshly fetched provider data).
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

  const providerClubId = Number(body?.providerClubId);

  try {
    const result = await linkExternalClubProvider(
      createClubDirectoryMutationDatabase(prisma),
      {
        tenantId: tenant.id,
        externalClubId: clubId,
        provider: body?.provider ?? "",
        providerClubId,
        providerClubName: body?.providerClubName ?? null,
        providerLogoUrl: body?.providerLogoUrl ?? null,
        providerWebsite: body?.providerWebsite ?? null,
        providerIsActive: body?.providerIsActive ?? true,
      },
    );

    revalidatePath(`/dashboard/vereine/${clubId}`);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ClubDirectoryNotFoundError) {
      return NextResponse.json({ error: "Verein nicht gefunden." }, { status: 404 });
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
