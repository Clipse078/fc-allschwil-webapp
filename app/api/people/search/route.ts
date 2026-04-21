import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getAllowedBirthYearsForSeason } from "@/lib/teams/jahrgang-rules";

type SearchMode = "any" | "player" | "trainer" | "vereinsleitung";

function matchesQuery(
  person: {
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
  },
  query: string,
) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();

  return [
    person.firstName,
    person.lastName,
    person.displayName ?? "",
    person.email ?? "",
    person.phone ?? "",
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

export async function GET(request: NextRequest) {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.PEOPLE_SEARCH);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const mode = (request.nextUrl.searchParams.get("mode")?.trim() ?? "any") as SearchMode;
    const teamSeasonId = request.nextUrl.searchParams.get("teamSeasonId")?.trim() ?? "";

    if (!["any", "player", "trainer", "vereinsleitung"].includes(mode)) {
      return NextResponse.json({ error: "Ungültiger Suchmodus." }, { status: 400 });
    }

    if (mode !== "vereinsleitung" && query.length < 2) {
      return NextResponse.json([]);
    }

    let allowedBirthYears: number[] = [];
    let excludedPersonIds = new Set<string>();

    if (teamSeasonId && mode === "player") {
      const teamSeason = await prisma.teamSeason.findUnique({
        where: { id: teamSeasonId },
        select: {
          season: {
            select: {
              startDate: true,
            },
          },
          team: {
            select: {
              ageGroup: true,
            },
          },
          playerSquadMembers: {
            select: {
              personId: true,
            },
          },
        },
      });

      if (!teamSeason) {
        return NextResponse.json({ error: "Team-Saison nicht gefunden." }, { status: 404 });
      }

      allowedBirthYears = getAllowedBirthYearsForSeason(
        teamSeason.team.ageGroup,
        teamSeason.season.startDate,
      );

      excludedPersonIds = new Set(teamSeason.playerSquadMembers.map((entry) => entry.personId));
    }

    if (teamSeasonId && mode === "trainer") {
      const teamSeason = await prisma.teamSeason.findUnique({
        where: { id: teamSeasonId },
        select: {
          trainerTeamMembers: {
            select: {
              personId: true,
            },
          },
        },
      });

      if (!teamSeason) {
        return NextResponse.json({ error: "Team-Saison nicht gefunden." }, { status: 404 });
      }

      excludedPersonIds = new Set(teamSeason.trainerTeamMembers.map((entry) => entry.personId));
    }

    if (mode === "vereinsleitung") {
      const people = await prisma.person.findMany({
        where: {
          isActive: true,
          user: {
            is: {
              isActive: true,
              userRoles: {
                some: {
                  role: {
                    OR: [
                      { canAccessVereinsleitung: true },
                      { canAttendVereinsleitungMeetings: true },
                    ],
                  },
                },
              },
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: query ? 50 : 20,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          phone: true,
        },
      });

      const filtered = people.filter((person) => matchesQuery(person, query));

      return NextResponse.json(filtered.slice(0, query ? 20 : 12));
    }

    const people = await prisma.person.findMany({
      where: {
        isActive: true,
        ...(mode === "player" ? { isPlayer: true } : {}),
        ...(mode === "trainer" ? { isTrainer: true } : {}),
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        isActive: true,
        isPlayer: true,
        isTrainer: true,
      },
    });

    const filtered = people.filter((person) => {
      if (excludedPersonIds.has(person.id)) {
        return false;
      }

      if (mode === "player") {
        if (!person.dateOfBirth || allowedBirthYears.length === 0) {
          return false;
        }

        const birthYear = new Date(person.dateOfBirth).getUTCFullYear();
        return allowedBirthYears.includes(birthYear);
      }

      if (mode === "trainer") {
        return true;
      }

      return true;
    });

    return NextResponse.json(filtered.slice(0, 20));
  } catch (error) {
    console.error("Search people failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Personensuche konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}