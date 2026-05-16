import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import {
  getCurrentSwissFootballSeason,
  getNextSwissFootballSeason,
  getSwissFootballSeasonDateRangeFromStartYear,
  getSwissFootballSeasonKeyFromStartYear,
  getSwissFootballSeasonLabelFromStartYear,
} from "@/lib/seasons/season-logic";

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

  try {
    const body = await request.json().catch(() => ({}));
    const requestedStartYear =
      body?.startYear === null || body?.startYear === undefined || body?.startYear === ""
        ? null
        : Number(body.startYear);

    const nextSeason = getNextSwissFootballSeason();

    const startYear =
      Number.isFinite(requestedStartYear) && requestedStartYear !== null
        ? requestedStartYear
        : nextSeason?.startYear ?? null;

    if (startYear === null || !Number.isInteger(startYear)) {
      return NextResponse.json(
        { error: "Ein gültiges Startjahr ist erforderlich." },
        { status: 400 }
      );
    }

    const key = getSwissFootballSeasonKeyFromStartYear(startYear);
    const name = getSwissFootballSeasonLabelFromStartYear(startYear);
    const range = getSwissFootballSeasonDateRangeFromStartYear(startYear);

    const existing = await prisma.season.findUnique({
      where: { key },
      select: { id: true, key: true, name: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Die Saison " + existing.name + " existiert bereits." },
        { status: 409 }
      );
    }

    const created = await prisma.season.create({
      data: {
        key,
        name,
        startDate: range.startDate,
        endDate: range.endDate,
        isActive: false,
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

    return NextResponse.json(
      {
        message: "Saison " + created.name + " erfolgreich erstellt.",
        season: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create season failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Saison konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}
