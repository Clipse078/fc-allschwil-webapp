import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTeamDetailData } from "../queries";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../team-cockpit-sporting-data", () => ({
  loadCurrentSeasonSfvMapping: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { loadCurrentSeasonSfvMapping } from "../team-cockpit-sporting-data";

const mockPrisma = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn> };
};
const mockLoadMapping = loadCurrentSeasonSfvMapping as ReturnType<typeof vi.fn>;

const TENANT_ID = "tenant-a";
const TEAM_ID = "team-a-01";

function makeTeamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEAM_ID,
    name: "Junioren A",
    shortName: "JA",
    alternativeName: null,
    infoboardDisplayName: null,
    infoboardTrainingDisplayName: null,
    infoboardMatchDisplayName: null,
    infoboardTournamentDisplayName: null,
    slug: "junioren-a",
    category: "JUNIOREN",
    genderGroup: null,
    ageGroup: null,
    sortOrder: 0,
    isActive: true,
    websiteVisible: true,
    infoboardVisible: true,
    orgUnitId: null,
    orgUnit: null,
    teamSeasons: [
      {
        id: "ts-current",
        displayName: "Junioren A 2026/27",
        shortName: null,
        status: "ACTIVE",
        participationType: "COMPETITION",
        websiteVisible: true,
        infoboardVisible: true,
        squadWebsiteVisible: true,
        trainerTeamWebsiteVisible: true,
        season: {
          id: "season-1",
          key: "2026-2027",
          name: "Saison 2026/27",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2027-06-30T00:00:00.000Z"),
          isActive: true,
        },
        competitions: [],
        orgUnits: [],
        playerSquadMembers: [],
        trainerTeamMembers: [],
      },
    ],
    ...overrides,
  };
}

describe("TEAM-COCKPIT-PREMIUM-01C — getTeamDetailData competition resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses providerLeagueName when TeamSeasonCompetition is empty", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(makeTeamRow());
    mockLoadMapping.mockResolvedValue({
      externalTeamId: 123,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      providerLeagueName: "2. Liga interregional",
      providerTeamName: "FC Allschwil JA",
      lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const team = await getTeamDetailData(TENANT_ID, TEAM_ID);

    expect(team?.competition).toEqual({
      id: null,
      name: "2. Liga interregional",
      shortName: null,
      source: "PROVIDER_MAPPING",
    });
    expect(team?.currentSeasonSfvMapping).toEqual({
      externalTeamId: 123,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      providerLeagueName: "2. Liga interregional",
    });
  });

  it("prefers providerLeagueName over canonical TeamSeasonCompetition when both exist", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(
      makeTeamRow({
        teamSeasons: [
          {
            ...makeTeamRow().teamSeasons[0],
            competitions: [
              {
                isPrimary: true,
                competition: {
                  id: "comp-1",
                  officialName: "3. Liga",
                  shortName: "3L",
                  provider: "SFV",
                  competitionType: "LEAGUE",
                  isArchived: false,
                },
              },
            ],
          },
        ],
      }),
    );
    mockLoadMapping.mockResolvedValue({
      externalTeamId: 123,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      providerLeagueName: "2. Liga interregional",
      providerTeamName: "FC Allschwil JA",
      lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const team = await getTeamDetailData(TENANT_ID, TEAM_ID);

    expect(team?.competition).toEqual({
      id: null,
      name: "2. Liga interregional",
      shortName: null,
      source: "PROVIDER_MAPPING",
    });
  });

  it("uses canonical TeamSeasonCompetition when provider metadata is absent", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(
      makeTeamRow({
        teamSeasons: [
          {
            ...makeTeamRow().teamSeasons[0],
            competitions: [
              {
                isPrimary: true,
                competition: {
                  id: "comp-1",
                  officialName: "3. Liga",
                  shortName: "3L",
                  provider: "SFV",
                  competitionType: "LEAGUE",
                  isArchived: false,
                },
              },
            ],
          },
        ],
      }),
    );
    mockLoadMapping.mockResolvedValue(null);

    const team = await getTeamDetailData(TENANT_ID, TEAM_ID);

    expect(team?.competition).toEqual({
      id: "comp-1",
      name: "3. Liga",
      shortName: "3L",
      source: "CANONICAL_COMPETITION",
    });
  });

  it("returns null competition when no mapping and no canonical competition exist", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(makeTeamRow());
    mockLoadMapping.mockResolvedValue(null);

    const team = await getTeamDetailData(TENANT_ID, TEAM_ID);

    expect(team?.competition).toBeNull();
  });
});
