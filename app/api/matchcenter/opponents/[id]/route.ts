import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { createOpponentQueryDatabase } from "@/lib/matchcenter/opponents/prisma-query-adapter";
import { getOpponentById } from "@/lib/matchcenter/opponents/query-service";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const tenantId = access.session.user.activeTenantId;

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required." },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const opponent = await getOpponentById(createOpponentQueryDatabase(prisma), { tenantId, id });

    if (opponent === null) {
      return NextResponse.json(
        { error: "Opponent not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ opponent });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
