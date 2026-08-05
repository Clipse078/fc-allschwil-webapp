import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { createOpponentQueryDatabase } from "@/lib/matchcenter/opponents/prisma-query-adapter";
import {
  listOpponents,
  OPPONENT_DEFAULT_LIMIT,
  OPPONENT_MAX_LIMIT,
} from "@/lib/matchcenter/opponents/query-service";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);

  const rawLimit = searchParams.get("limit");
  const rawSkip = searchParams.get("skip");
  const rawSearch = searchParams.get("search");
  const rawProvider = searchParams.get("provider");
  const rawIncludeArchived = searchParams.get("includeArchived");

  const limit =
    rawLimit !== null ? parseInt(rawLimit, 10) : OPPONENT_DEFAULT_LIMIT;
  const skip = rawSkip !== null ? parseInt(rawSkip, 10) : 0;

  try {
    const opponents = await listOpponents(createOpponentQueryDatabase(prisma), {
      tenantId,
      search: rawSearch ?? undefined,
      provider: rawProvider ?? undefined,
      limit,
      skip,
      includeArchived: rawIncludeArchived === "true",
    });

    return NextResponse.json({ opponents });
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
