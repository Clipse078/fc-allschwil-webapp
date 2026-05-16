import { prisma } from "@/lib/db/prisma";

export const CATEGORY_LABELS: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
};

export const CATEGORY_ORDER = [
  "AKTIVE",
  "FRAUEN",
  "JUNIOREN",
  "KINDERFUSSBALL",
  "SENIOREN",
  "TRAININGSGRUPPE",
];

export type PublicTeamListItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  displayName: string | null;
  trainerCount: number;
};

export type PublicTrainer = {
  id: string;
  name: string;
  roleLabel: string | null;
};

export type PublicPlayer = {
  id: string;
  name: string;
  shirtNumber: number | null;
  positionLabel: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type PublicTeamDetailData = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  displayName: string | null;
  showTrainers: boolean;
  showPlayers: boolean;
  trainers: PublicTrainer[];
  players: PublicPlayer[];
};

export async function getPublicTeamList(): Promise<PublicTeamListItem[]> {
  const teams = await prisma.team.findMany({
    where: { isActive: true, websiteVisible: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
      teamSeasons: {
        where: { websiteVisible: true },
        orderBy: { season: { startDate: "desc" } },
        take: 1,
        select: {
          displayName: true,
          trainerTeamWebsiteVisible: true,
          trainerTeamMembers: {
            where: { isWebsiteVisible: true, status: "ACTIVE" },
            select: { id: true },
          },
        },
      },
    },
  });

  return teams.map((team) => {
    const season = team.teamSeasons[0] ?? null;
    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      category: team.category,
      genderGroup: team.genderGroup,
      ageGroup: team.ageGroup,
      displayName: season?.displayName ?? null,
      trainerCount:
        season?.trainerTeamWebsiteVisible === true
          ? season.trainerTeamMembers.length
          : 0,
    };
  });
}

export async function getPublicTeamDetail(
  teamSlug: string
): Promise<PublicTeamDetailData | null> {
  const team = await prisma.team.findUnique({
    where: { slug: teamSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
      websiteVisible: true,
      teamSeasons: {
        where: { websiteVisible: true },
        orderBy: { season: { startDate: "desc" } },
        take: 1,
        select: {
          displayName: true,
          squadWebsiteVisible: true,
          trainerTeamWebsiteVisible: true,
          trainerTeamMembers: {
            where: { isWebsiteVisible: true, status: "ACTIVE" },
            orderBy: [{ sortOrder: "asc" }, { person: { lastName: "asc" } }],
            select: {
              id: true,
              roleLabel: true,
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          playerSquadMembers: {
            where: { isWebsiteVisible: true, status: "ACTIVE" },
            orderBy: [
              { sortOrder: "asc" },
              { shirtNumber: "asc" },
              { person: { lastName: "asc" } },
            ],
            select: {
              id: true,
              shirtNumber: true,
              positionLabel: true,
              isCaptain: true,
              isViceCaptain: true,
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!team || !team.websiteVisible) return null;

  const season = team.teamSeasons[0] ?? null;

  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    category: team.category,
    genderGroup: team.genderGroup,
    ageGroup: team.ageGroup,
    displayName: season?.displayName ?? null,
    showTrainers: season?.trainerTeamWebsiteVisible ?? false,
    showPlayers: season?.squadWebsiteVisible ?? false,
    trainers:
      season?.trainerTeamWebsiteVisible === true
        ? season.trainerTeamMembers.map((t) => ({
            id: t.id,
            name:
              t.person.displayName ??
              `${t.person.firstName} ${t.person.lastName}`,
            roleLabel: t.roleLabel,
          }))
        : [],
    players:
      season?.squadWebsiteVisible === true
        ? season.playerSquadMembers.map((p) => ({
            id: p.id,
            name:
              p.person.displayName ??
              `${p.person.firstName} ${p.person.lastName}`,
            shirtNumber: p.shirtNumber,
            positionLabel: p.positionLabel,
            isCaptain: p.isCaptain,
            isViceCaptain: p.isViceCaptain,
          }))
        : [],
  };
}
