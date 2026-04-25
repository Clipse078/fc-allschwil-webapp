import { NextRequest, NextResponse } from "next/server";
import { Prisma, TeamCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { logAction } from "@/lib/audit/log-action";
import { getCurrentSwissFootballSeason } from "@/lib/seasons/season-logic";
import {
  buildTeamSeasonDisplayName,
  buildTeamSeasonShortName,
  isFutureSeasonComparedToCurrentSeason,
  normalizeTeamName,
  normalizeTeamSlug,
} from "@/lib/teams/team-season-rules";

const ALLOWED_CATEGORIES = [
  "KINDERFUSSBALL",
  "JUNIOREN",
  "AKTIVE",
  "FRAUEN",
  "SENIOREN",
  "TRAININGSGRUPPE",
] as const;

export async function GET() {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.TEAMS_READ);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const currentSeason = getCurrentSwissFootballSeason();
  const currentSeasonWhere = currentSeason
    ? {
        season: {
          key: currentSeason.key,
        },
      }
    : {
        season: {
          isActive: true,
        },
      };

  const teams = await prisma.team.findMany({
    orderBy: [
      { category: "asc" },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    include: {
      teamSeasons: {
        where: currentSeasonWhere,
        include: {
          season: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  const formatted = teams.map((team) => {
    const activeSeasonEntry = team.teamSeasons[0] ?? null;

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      category: team.category,
      genderGroup: team.genderGroup,
      ageGroup: team.ageGroup,
      sortOrder: team.sortOrder,
      isActive: team.isActive,
      websiteVisible: team.websiteVisible,
      infoboardVisible: team.infoboardVisible,
      activeSeason: activeSeasonEntry
        ? {
            seasonKey: activeSeasonEntry.season.key,
            seasonName: activeSeasonEntry.season.name,
            displayName: activeSeasonEntry.displayName,
            shortName: activeSeasonEntry.shortName,
            status: activeSeasonEntry.status,
          }
        : null,
    };
  });

  return NextResponse.json(formatted);
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();

    const name = normalizeTeamName(String(body.name ?? ""));
    const slug = normalizeTeamSlug(String(body.slug ?? ""));
    const category = String(body.category ?? "").trim();
    const seasonId = String(body.seasonId ?? "").trim();

    const genderGroup =
      body.genderGroup === null || body.genderGroup === undefined
        ? null
        : String(body.genderGroup).trim() || null;

    const ageGroup =
      body.ageGroup === null || body.ageGroup === undefined
        ? null
        : String(body.ageGroup).trim() || null;

    const sortOrder = Number(body.sortOrder ?? 0);

    if (!name || !slug || !seasonId) {
      return NextResponse.json(
        { error: "Teamname, Slug und Saison sind erforderlich." },
        { status: 400 }
      );
    }

    if (!ALLOWED_CATEGORIES.includes(category as (typeof ALLOWED_CATEGORIES)[number])) {
      return NextResponse.json(
        { error: "Ungültige Kategorie. Bitte Prisma Migration und Client für neue Kategorien aktualisieren, falls diese Kategorie neu ist." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json(
        { error: "Sortierung muss eine Zahl sein." },
        { status: 400 }
      );
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        key: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    if (!season) {
      return NextResponse.json(
        { error: "Die gewählte Saison wurde nicht gefunden." },
        { status: 404 }
      );
    }

    const existingTeamInSameSeasonByName = await prisma.teamSeason.findFirst({
      where: {
        seasonId,
        team: {
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
      },
      select: {
        id: true,
        teamId: true,
        displayName: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        season: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    if (existingTeamInSameSeasonByName) {
      return NextResponse.json(
        {
          error:
            'Ein Team mit dem Namen "' +
            name +
            '" existiert bereits in der Saison ' +
            season.name +
            ".",
        },
        { status: 409 }
      );
    }

    const existingTeamInSameSeasonBySlug = await prisma.teamSeason.findFirst({
      where: {
        seasonId,
        team: {
          slug,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingTeamInSameSeasonBySlug) {
      return NextResponse.json(
        {
          error:
            'Ein Team mit dem Slug "' +
            slug +
            '" existiert bereits in der Saison ' +
            season.name +
            ".",
        },
        { status: 409 }
      );
    }

    const existingTeamBySlug = await prisma.team.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        genderGroup: true,
        ageGroup: true,
        sortOrder: true,
      },
    });

    if (
      existingTeamBySlug &&
      normalizeTeamName(existingTeamBySlug.name).toLowerCase() !== name.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            'Der Slug "' +
            slug +
            '" ist bereits einem anderen Team zugeordnet.',
        },
        { status: 409 }
      );
    }

    const existingTeamByName = await prisma.team.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        genderGroup: true,
        ageGroup: true,
        sortOrder: true,
      },
    });

    const teamToReuse = existingTeamBySlug ?? existingTeamByName ?? null;

    if (teamToReuse) {
      const isFutureSeason = isFutureSeasonComparedToCurrentSeason(season.startDate);

      if (!isFutureSeason) {
        return NextResponse.json(
          {
            error:
              'Das Team "' +
              teamToReuse.name +
              '" existiert bereits im Club. Eine zusätzliche Teamanlage mit gleichem Namen ist nur für eine neue zukünftige Saison erlaubt.',
          },
          { status: 409 }
        );
      }

      const existingAssignment = await prisma.teamSeason.findUnique({
        where: {
          teamId_seasonId: {
            teamId: teamToReuse.id,
            seasonId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingAssignment) {
        return NextResponse.json(
          {
            error:
              'Das Team "' +
              teamToReuse.name +
              '" ist der Saison ' +
              season.name +
              " bereits zugeordnet.",
          },
          { status: 409 }
        );
      }

      const createdSeasonEntry = await prisma.teamSeason.create({
        data: {
          teamId: teamToReuse.id,
          seasonId: season.id,
          displayName: buildTeamSeasonDisplayName(teamToReuse.name),
          shortName: buildTeamSeasonShortName(teamToReuse.name),
          status: "ACTIVE",
          websiteVisible: true,
          infoboardVisible: true,
        },
      });

      await logAction({
        actorUserId:
          access.session?.user?.effectiveUserId ??
          access.session?.user?.id ??
          null,
        moduleKey: "teams",
        entityType: "TeamSeason",
        entityId: createdSeasonEntry.id,
        action: "CREATE",
        afterJson: {
          teamId: teamToReuse.id,
          teamName: teamToReuse.name,
          teamSlug: teamToReuse.slug,
          seasonId: season.id,
          seasonKey: season.key,
          seasonName: season.name,
          displayName: createdSeasonEntry.displayName,
          shortName: createdSeasonEntry.shortName,
          status: createdSeasonEntry.status,
        },
      });

      return NextResponse.json(
        {
          message:
            'Bestehendes Team "' +
            teamToReuse.name +
            '" wurde erfolgreich der neuen Saison ' +
            season.name +
            " zugeordnet.",
          teamId: teamToReuse.id,
          createdMode: "season_assignment",
        },
        { status: 201 }
      );
    }

    const team = await prisma.team.create({
      data: {
        name,
        slug,
        category: category as TeamCategory,
        genderGroup,
        ageGroup,
        sortOrder,
        isActive: true,
        websiteVisible: true,
        infoboardVisible: true,
      },
    });

    const createdSeasonEntry = await prisma.teamSeason.create({
      data: {
        teamId: team.id,
        seasonId: season.id,
        displayName: buildTeamSeasonDisplayName(name),
        shortName: buildTeamSeasonShortName(name),
        status: "ACTIVE",
        websiteVisible: true,
        infoboardVisible: true,
      },
    });

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "teams",
      entityType: "Team",
      entityId: team.id,
      action: "CREATE",
      afterJson: {
        name,
        slug,
        category,
        genderGroup,
        ageGroup,
        sortOrder,
        seasonId: season.id,
        seasonKey: season.key,
        seasonName: season.name,
        teamSeasonId: createdSeasonEntry.id,
      },
    });

    return NextResponse.json(
      {
        message:
          'Team "' +
          team.name +
          '" erfolgreich für die Saison ' +
          season.name +
          " erstellt.",
        teamId: team.id,
        createdMode: "new_team",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create team failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Team oder Saisonzuordnung existiert bereits." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Datenbankfehler: " + error.code + ". Bitte Migration / Prisma Client prüfen." },
        { status: 500 }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Prisma-Validierungsfehler. Wahrscheinlich stimmen Schema, Migration und generierter Client aktuell nicht überein." },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Unbekannter Fehler beim Erstellen des Teams." },
      { status: 500 }
    );
  }
}


