import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getAllowedBirthYearsForSeason } from "@/lib/teams/jahrgang-rules";

type SearchMode = "any" | "player" | "trainer" | "vereinsleitung";

type PersonRecord = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  isPlayer: boolean;
  isTrainer: boolean;
  user: {
    userRoles: {
      role: {
        key: string;
        name: string;
        canAccessVereinsleitung: boolean;
        canAttendVereinsleitungMeetings: boolean;
      };
    }[];
  } | null;
  trainerTeamMembers: {
    status: string;
    roleLabel: string | null;
    teamSeason: {
      displayName: string;
      shortName: string | null;
      status: string;
      team: {
        name: string;
      };
    };
  }[];
  playerSquadMembers: {
    status: string;
    teamSeason: {
      displayName: string;
      shortName: string | null;
      status: string;
      team: {
        name: string;
      };
    };
  }[];
};

const FCA_ROLE_PRIORITY = [
  "president",
  "vice_president",
  "sekretaer",
  "beisitz",
  "ressortleiter_organisation_vereinsentwicklung",
  "fussballorganisatorische_leiter",
  "it_admin",
  "finanzleiter",
  "materialleiter",
  "faciliteits_leiter",
  "redaktor",
  "content_creator",
  "aktivitaetenkommission_leiter",
  "aktivitaetenkommission_mitglied",
  "business_club_leiter",
  "business_club_mitglied",
  "archivkommission_leiter",
  "archivkommission_mitglied",
  "leiter_technische_kommission",
  "technische_kommission_mitglied",
  "koordinator_damen",
  "koordinator_senioren",
  "koordinator_junioren",
  "koordinator_kifu",
  "koordinator_trainingsgruppen",
  "koordinator_neu_anmeldungen",
  "trainer",
  "player",
  "contact_person_sponsor",
  "contact_person_supplier",
  "contact_person_gemeinde",
  "viewer",
  "super_admin"
] as const;

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

function getDisplayName(person: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return person.displayName ?? [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function getRolePriorityIndex(roleKey: string) {
  const index = FCA_ROLE_PRIORITY.indexOf(roleKey as (typeof FCA_ROLE_PRIORITY)[number]);
  return index === -1 ? 999 : index;
}

function getSortedRoles(person: PersonRecord) {
  return [...(person.user?.userRoles ?? [])].sort(
    (a, b) => getRolePriorityIndex(a.role.key) - getRolePriorityIndex(b.role.key),
  );
}

function getActiveTrainerAssignment(person: PersonRecord) {
  return (
    person.trainerTeamMembers.find(
      (entry) => entry.status === "ACTIVE" && entry.teamSeason.status === "ACTIVE",
    ) ?? person.trainerTeamMembers[0] ?? null
  );
}

function getActivePlayerAssignment(person: PersonRecord) {
  return (
    person.playerSquadMembers.find(
      (entry) => entry.status === "ACTIVE" && entry.teamSeason.status === "ACTIVE",
    ) ?? person.playerSquadMembers[0] ?? null
  );
}

function getTeamLabelFromTrainer(person: PersonRecord) {
  const trainerAssignment = getActiveTrainerAssignment(person);

  if (!trainerAssignment) {
    return null;
  }

  return (
    trainerAssignment.teamSeason.shortName ||
    trainerAssignment.teamSeason.team.name ||
    trainerAssignment.teamSeason.displayName
  );
}

function getTeamLabelFromPlayer(person: PersonRecord) {
  const playerAssignment = getActivePlayerAssignment(person);

  if (!playerAssignment) {
    return null;
  }

  return (
    playerAssignment.teamSeason.shortName ||
    playerAssignment.teamSeason.team.name ||
    playerAssignment.teamSeason.displayName
  );
}

function getPrimaryRoleLabel(person: PersonRecord) {
  const sortedRoles = getSortedRoles(person);

  if (sortedRoles.length > 0) {
    return sortedRoles[0].role.name;
  }

  const trainerAssignment = getActiveTrainerAssignment(person);
  if (trainerAssignment) {
    return trainerAssignment.roleLabel?.trim() || "Trainer";
  }

  const playerAssignment = getActivePlayerAssignment(person);
  if (playerAssignment) {
    return "Player";
  }

  return "Person";
}

function getSecondaryTeamLabel(person: PersonRecord) {
  const sortedRoles = getSortedRoles(person);
  const primaryRoleKey = sortedRoles[0]?.role.key ?? null;

  if (primaryRoleKey === "trainer") {
    return getTeamLabelFromTrainer(person);
  }

  if (primaryRoleKey === "player") {
    return getTeamLabelFromPlayer(person);
  }

  if (!primaryRoleKey) {
    if (person.isTrainer) {
      return getTeamLabelFromTrainer(person);
    }

    if (person.isPlayer) {
      return getTeamLabelFromPlayer(person);
    }
  }

  return null;
}

function isEligibleForVereinsleitung(person: PersonRecord) {
  const sortedRoles = getSortedRoles(person);

  if (
    sortedRoles.some(
      (entry) =>
        entry.role.canAccessVereinsleitung || entry.role.canAttendVereinsleitungMeetings,
    )
  ) {
    return true;
  }

  return person.isTrainer || person.isPlayer;
}

function toSearchItem(person: PersonRecord) {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    displayName: getDisplayName(person),
    email: person.email,
    phone: person.phone,
    imageSrc: null,
    functionLabel: getPrimaryRoleLabel(person),
    teamLabel: getSecondaryTeamLabel(person),
    isPlayer: person.isPlayer,
    isTrainer: person.isTrainer,
  };
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

    if (query.length < 2) {
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
      take: 50,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        isPlayer: true,
        isTrainer: true,
        user: {
          select: {
            userRoles: {
              select: {
                role: {
                  select: {
                    key: true,
                    name: true,
                    canAccessVereinsleitung: true,
                    canAttendVereinsleitungMeetings: true,
                  },
                },
              },
            },
          },
        },
        trainerTeamMembers: {
          select: {
            status: true,
            roleLabel: true,
            teamSeason: {
              select: {
                displayName: true,
                shortName: true,
                status: true,
                team: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        playerSquadMembers: {
          select: {
            status: true,
            teamSeason: {
              select: {
                displayName: true,
                shortName: true,
                status: true,
                team: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const filtered = people.filter((person) => {
      if (!matchesQuery(person, query)) {
        return false;
      }

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

      if (mode === "vereinsleitung") {
        return isEligibleForVereinsleitung(person);
      }

      return true;
    });

    return NextResponse.json(filtered.slice(0, 20).map(toSearchItem));
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