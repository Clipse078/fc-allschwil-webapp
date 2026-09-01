import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicTeamDetail } from "../public-teams-feed";

const mocks = vi.hoisted(() => ({
  teamFindFirst: vi.fn(),
  playerSquadMemberFindMany: vi.fn(),
  trainerTeamMemberFindMany: vi.fn(),
  tenantFindUnique: vi.fn(),
  teamFindMany: vi.fn(),
  externalTeamFindMany: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  teamExternalMappingFindFirst: vi.fn(),
  fetchTeamStandingsForMapping: vi.fn(),
  buildStandingsClubEnrichmentByProviderTeamId: vi.fn(),
  findNextTournamentEventForTeamSeason: vi.fn(),
  listTournamentsByIds: vi.fn(),
  listTeamSeasonMatches: vi.fn(),
  getTeamTrainingSchedule: vi.fn(),
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

vi.mock("@/lib/teams/team-training-schedule", () => ({
  getTeamTrainingSchedule: mocks.getTeamTrainingSchedule,
}));

const TENANT_ID = "tenant-fca";
const TEAM_ID = "team-e1";
const TEAM_SEASON_ID = "team-season-1";
const NOW = new Date("2026-08-25T12:00:00.000Z");

function mockTeamDetail(trainingWebsiteVisible: boolean) {
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
        squadWebsiteVisible: true,
        trainerTeamWebsiteVisible: true,
        trainingWebsiteVisible,
        showNextMatch: true,
        showNextTournament: true,
        season: { key: "2026-2027", name: "Saison 2026/27" },
      },
    ],
  });
}

describe("getPublicTeamDetail — training visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mockTeamDetail(true);
    mocks.playerSquadMemberFindMany.mockResolvedValue([]);
    mocks.trainerTeamMemberFindMany.mockResolvedValue([]);
    mocks.tenantFindUnique.mockResolvedValue({
      name: "FC Example",
      logoUrl: null,
    });
    mocks.teamFindMany.mockResolvedValue([]);
    mocks.externalTeamFindMany.mockResolvedValue([]);
    mocks.teamSeasonFindFirst.mockResolvedValue(null);
    mocks.teamExternalMappingFindFirst.mockResolvedValue(null);
    mocks.fetchTeamStandingsForMapping.mockResolvedValue(null);
    mocks.buildStandingsClubEnrichmentByProviderTeamId.mockResolvedValue(new Map());
    mocks.findNextTournamentEventForTeamSeason.mockResolvedValue(null);
    mocks.listTournamentsByIds.mockResolvedValue([]);
    mocks.listTeamSeasonMatches.mockResolvedValue({
      upcoming: [],
      completed: [],
    });
    mocks.getTeamTrainingSchedule.mockResolvedValue([
      {
        weekday: "TUESDAY",
        weekdayLabel: "Dienstag",
        startsAt: "17:15",
        endsAt: "18:45",
        locationLabel: "Kunstrasen 2",
        seriesId: "series-1",
        seriesTitle: "E1 Training",
      },
    ]);
  });

  it("suppresses training when trainingWebsiteVisible is false", async () => {
    mockTeamDetail(false);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.training).toEqual([]);
    expect(mocks.getTeamTrainingSchedule).not.toHaveBeenCalled();
  });

  it("returns canonical TrainingSeries schedule when trainingWebsiteVisible is true", async () => {
    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(mocks.getTeamTrainingSchedule).toHaveBeenCalledWith(
      TENANT_ID,
      TEAM_SEASON_ID,
    );
    expect(detail?.training).toEqual([
      {
        weekday: "Dienstag",
        startTime: "2026-01-06T16:15:00.000Z",
        endTime: "2026-01-06T17:45:00.000Z",
        location: "Kunstrasen 2",
        pitchName: "Kunstrasen 2",
      },
    ]);
  });
});
