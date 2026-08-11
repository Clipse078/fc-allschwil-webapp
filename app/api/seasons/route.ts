import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getCurrentSwissFootballSeason, getNextSwissFootballSeason } from "@/lib/seasons/season-logic";
import { createSeason, suggestNextSeasonStartYear } from "@/lib/seasons/mutations";
import { toSeasonApiErrorResponse } from "@/lib/seasons/errors";

export async function GET() {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.SEASONS_READ);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const seasons = await prisma.season.findMany({
    orderBy: {
      startDate: "desc",
    },
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  const currentSeason = getCurrentSwissFootballSeason();
  const nextSeason = getNextSwissFootballSeason();

  return NextResponse.json({
    currentSeasonKey: currentSeason?.key ?? null,
    nextSeasonKey: nextSeason?.key ?? null,
    seasons,
  });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.SEASONS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json().catch(() => ({}));
  const requestedStartYear =
    body?.startYear === null || body?.startYear === undefined || body?.startYear === ""
      ? null
      : Number(body.startYear);

  // SEASON-01: creating an arbitrary sensible Season is always allowed —
  // an earlier or later Season already existing never blocks this. When no
  // explicit startYear is supplied, default to the calendar-computed
  // "next" season purely as a convenience (createSeason() itself does not
  // special-case this value).
  const startYear =
    Number.isFinite(requestedStartYear) && requestedStartYear !== null
      ? requestedStartYear
      : suggestNextSeasonStartYear() ?? null;

  if (startYear === null || !Number.isInteger(startYear)) {
    return NextResponse.json({ error: "Ein gültiges Startjahr ist erforderlich." }, { status: 400 });
  }

  try {
    const created = await createSeason({ startYear }, access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null);

    return NextResponse.json(
      {
        message: "Saison " + created.name + " erfolgreich erstellt.",
        season: created,
      },
      { status: 201 },
    );
  } catch (error) {
    const { status, body: errorBody } = toSeasonApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
