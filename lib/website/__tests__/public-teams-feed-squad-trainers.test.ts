import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicTeamDetail } from "../public-teams-feed";

const mocks = vi.hoisted(() => ({
  teamFindFirst: vi.fn(),
  playerSquadMemberFindMany: vi.fn(),
  trainerTeamMemberFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  facilityResourceFindMany: vi.fn(),
  tenantFindUnique: vi.fn(),
  teamFindMany: vi.fn(),
  externalTeamFindMany: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  matchEventFindMany: vi.fn(),
  teamExternalMappingFindFirst: vi.fn(),
  fetchTeamStandingsForMapping: vi.fn(),
  buildStandingsClubEnrichmentByProviderTeamId: vi.fn(),
  findNextTournamentEventForTeamSeason: vi.fn(),
  listTournamentsByIds: vi.fn(),
  listTeamSeasonMatches: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findFirst: mocks.teamFindFirst,
      findMany: mocks.teamFindMany,
    },
    playerSquadMember: {
      findMany: mocks.playerSquadMemberFindMany,
    },
    trainerTeamMember: {
      findMany: mocks.trainerTeamMemberFindMany,
    },
    event: {
      findMany: mocks.eventFindMany,
    },
    facilityResource: {
      findMany: mocks.facilityResourceFindMany,
    },
    tenant: {
      findUnique: mocks.tenantFindUnique,
    },
    externalTeam: {
      findMany: mocks.externalTeamFindMany,
    },
    teamSeason: {
      findFirst: mocks.teamSeasonFindFirst,
    },
    teamExternalMapping: {
      findFirst: mocks.teamExternalMappingFindFirst,
    },
  },
}));

vi.mock("@/lib/integrations/sfv/standings-provider", () => ({
  fetchTeamStandingsForMapping: mocks.fetchTeamStandingsForMapping,
}));

vi.mock("@/lib/club-directory/standings-club-enrichment", () => ({
  buildStandingsClubEnrichmentByProviderTeamId:
    mocks.buildStandingsClubEnrichmentByProviderTeamId,
}));

vi.mock("@/lib/tournaments/queries", () => ({
  findNextTournamentEventForTeamSeason:
    mocks.findNextTournamentEventForTeamSeason,
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  listTournamentsByIds: mocks.listTournamentsByIds,
}));

vi.mock("@/lib/teams/team-match-query-service", () => ({
  listTeamSeasonMatches: mocks.listTeamSeasonMatches,
}));

const TENANT_ID = "tenant-fca";
const TEAM_ID = "team-e1";
const TEAM_SEASON_ID = "team-season-1";
const NOW = new Date("2026-08-25T12:00:00.000Z");

function mockTeamDetail(visibility: {
  squadWebsiteVisible: boolean;
  trainerTeamWebsiteVisible: boolean;
}) {
  mocks.teamFindFirst.mockResolvedValue({
    id: TEAM_ID,
    name: "FC Example E1",
    slug: "e1",
    category: "JUNIOREN",
    genderGroup: null,
    ageGroup: null,
    teamSeasons: [
      {
        id: TEAM_SEASON_ID,
        displayName: "FC Example E1 2026/27",
        shortName: "E1",
        squadWebsiteVisible: visibility.squadWebsiteVisible,
        trainerTeamWebsiteVisible: visibility.trainerTeamWebsiteVisible,
        showNextMatch: true,
        showNextTournament: true,
        season: { key: "2026-2027", name: "Saison 2026/27" },
      },
    ],
  });
}

describe("getPublicTeamDetail — squad and trainer visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mockTeamDetail({
      squadWebsiteVisible: false,
      trainerTeamWebsiteVisible: false,
    });
    mocks.playerSquadMemberFindMany.mockResolvedValue([
      {
        shirtNumber: 10,
        positionLabel: "Stürmer",
        isCaptain: true,
        isViceCaptain: false,
        person: { firstName: "Max", lastName: "Muster" },
      },
    ]);
    mocks.trainerTeamMemberFindMany.mockResolvedValue([
      {
        roleLabel: "Trainer",
        person: { firstName: "Anna", lastName: "Coach" },
      },
    ]);
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.facilityResourceFindMany.mockResolvedValue([]);
    mocks.tenantFindUnique.mockResolvedValue({
      name: "FC Example",
      logoUrl: null,
    });
    mocks.teamFindMany.mockResolvedValue([]);
    mocks.externalTeamFindMany.mockResolvedValue([]);
    mocks.teamSeasonFindFirst.mockResolvedValue(null);
    mocks.matchEventFindMany.mockResolvedValue([]);
    mocks.teamExternalMappingFindFirst.mockResolvedValue(null);
    mocks.fetchTeamStandingsForMapping.mockResolvedValue(null);
    mocks.buildStandingsClubEnrichmentByProviderTeamId.mockResolvedValue(new Map());
    mocks.findNextTournamentEventForTeamSeason.mockResolvedValue(null);
    mocks.listTournamentsByIds.mockResolvedValue([]);
    mocks.listTeamSeasonMatches.mockResolvedValue({
      upcoming: [],
      completed: [],
    });
  });

  it("suppresses squad when squadWebsiteVisible is false", async () => {
    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.squad).toEqual([]);
    expect(mocks.playerSquadMemberFindMany).not.toHaveBeenCalled();
  });

  it("suppresses trainers when trainerTeamWebsiteVisible is false", async () => {
    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.trainers).toEqual([]);
    expect(mocks.trainerTeamMemberFindMany).not.toHaveBeenCalled();
  });

  it("loads squad and trainers when both visibility flags are true", async () => {
    mockTeamDetail({
      squadWebsiteVisible: true,
      trainerTeamWebsiteVisible: true,
    });

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(mocks.playerSquadMemberFindMany).toHaveBeenCalledOnce();
    expect(mocks.trainerTeamMemberFindMany).toHaveBeenCalledOnce();
    expect(detail?.squad).toEqual([
      {
        firstName: "Max",
        lastName: "Muster",
        shirtNumber: 10,
        positionLabel: "Stürmer",
        captain: true,
        viceCaptain: false,
        photo: null,
      },
    ]);
    expect(detail?.trainers).toEqual([
      {
        firstName: "Anna",
        lastName: "Coach",
        roleLabel: "Trainer",
        photo: null,
      },
    ]);
  });
});
