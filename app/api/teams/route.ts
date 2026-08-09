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
import { getTenantFromSession } from "@/lib/tenants/queries";

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

  // Tenant isolation: never list Teams belonging to another tenant. tenantId
  // is resolved server-side from the trusted session, never from client input.
  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
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
    where: { tenantId: tenant.id },
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

  // Tenant isolation: resolved once, up front, from the trusted session —
  // every create/uniqueness check below is scoped to this tenant.
  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  try {
    const body = await request.json();

    const name = normalizeTeamName(String(body.name ?? ""));
    const slug = normalizeTeamSlug(String(body.slug ?? ""));
    const category = String(body.category ?? "").trim();
    const seasonId = String(body.seasonId ?? "").trim();

    // TEAM-IDENTITY-01: tenant-owned SHORT NAME / ALTERNATIVE NAME.
    // Both optional. Never derived from string parsing of `name`.
    const shortName: string | null =
      body.shortName === null || body.shortName === undefined
        ? null
        : String(body.shortName).trim() || null;

    const alternativeName: string | null =
      body.alternativeName === null || body.alternativeName === undefined
        ? null
        : String(body.alternativeName).trim() || null;

    const genderGroup =
      body.genderGroup === null || body.genderGroup === undefined
        ? null
        : String(body.genderGroup).trim() || null;

    const ageGroup =
      body.ageGroup === null || body.ageGroup === undefined
        ? null
        : String(body.ageGroup).trim() || null;

    const sortOrder = Number(body.sortOrder ?? 0);

    const orgUnitId: string | null =
      body.orgUnitId === null || body.orgUnitId === undefined || body.orgUnitId === ""
        ? null
        : String(body.orgUnitId).trim() || null;

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

    // Validate orgUnitId against active tenant if provided.
    if (orgUnitId !== null) {
      const orgUnit = await prisma.orgUnit.findUnique({
        where: { id: orgUnitId },
        select: { id: true, tenantId: true },
      });

      if (!orgUnit) {
        return NextResponse.json(
          { error: "Organisationseinheit nicht gefunden." },
          { status: 404 }
        );
      }

      if (tenant && orgUnit.tenantId !== tenant.id) {
        return NextResponse.json(
          { error: "Die gewählte Organisationseinheit gehört nicht zum aktiven Mandanten." },
          { status: 403 }
        );
      }
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
          tenantId: tenant.id,
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
          tenantId: tenant.id,
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

    // TEAM-CORE-02: slug uniqueness is tenant-scoped.
    // Use compound key lookup (tenantId + slug) instead of global slug findUnique.
    const existingTeamBySlug = await prisma.team.findUnique({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug,
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
        // Tenant isolation: name uniqueness is scoped to the active tenant.
        tenantId: tenant.id,
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

      // If an orgUnitId was explicitly provided, update the existing team's OrgUnit link.
      if (orgUnitId !== null) {
        await prisma.team.update({
          where: { id: teamToReuse.id },
          data: { orgUnitId },
        });
      }

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
          orgUnitId,
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
        tenantId: tenant.id,
        name,
        shortName,
        alternativeName,
        slug,
        category: category as TeamCategory,
        genderGroup,
        ageGroup,
        sortOrder,
        isActive: true,
        websiteVisible: true,
        infoboardVisible: true,
        orgUnitId,
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
        shortName,
        alternativeName,
        slug,
        category,
        genderGroup,
        ageGroup,
        sortOrder,
        orgUnitId,
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

