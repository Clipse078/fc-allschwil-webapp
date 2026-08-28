/**
 * lib/teams/__tests__/team-list-query.test.ts
 *
 * TEAM-SFV-MAPPING-01 — Focused tests for getTeamsListData's competition
 * and provider-mapping enrichment (MINIMAL TEAMS UX).
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database or
 * network access.
 *
 * TEST COVERAGE MAP:
 *   1. Returns null competition when the active TeamSeason has no primary competition.
 *   2. Returns the primary competition's officialName/shortName when present.
 *   3. Returns null providerMapping when the Team has no TeamExternalMapping rows.
 *   4. Returns the most recently synced provider mapping when present.
 *   5. Marks providerMapping.isActive = false when the provider reports the team inactive.
 *   6. Manual (non-SFV) teams have providerMapping = null and competition may still be set.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockMappingFindMany = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    teamExternalMapping: {
      findMany: (...args: unknown[]) => mockMappingFindMany(...args),
    },
    season: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/seasons/season-logic", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seasons/season-logic")>();
  return {
    ...actual,
    getCurrentSwissFootballSeason: () => ({ key: "2026/2027", name: "2026/27" }),
  };
});

vi.mock("@/lib/integrations/sfv/standings-provider", () => ({
  fetchTeamStandingsForMapping: vi.fn(),
}));

const { getTeamsListData } = await import("../queries");

function makeTeamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    name: "FC Allschwil C1",
    slug: "sfv-31927",
    category: "JUNIOREN",
    genderGroup: null,
    ageGroup: "C",
    sortOrder: 0,
    isActive: true,
    websiteVisible: true,
    infoboardVisible: true,
    teamSeasons: [
      {
        id: "ts-current",
        season: { key: "2026/2027", name: "2026/27" },
        displayName: "FC Allschwil C1",
        shortName: "C1",
        status: "ACTIVE",
        competitions: [],
      },
    ],
    externalMappings: [],
    ...overrides,
  };
}

function makeCurrentSeasonMapping(overrides: Record<string, unknown> = {}) {
  return {
    externalTeamId: 123,
    externalSeasonId: 2027,
    providerLeagueId: 10,
    providerLeagueName: "2. Liga interregional",
    providerTeamName: "FC Allschwil C1",
    lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
    teamSeasonId: "ts-current",
    provider: "SFV",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMappingFindMany.mockResolvedValue([]);
});

describe("getTeamsListData — competition enrichment", () => {
  it("1 — returns null competition when no primary competition is linked", async () => {
    mockFindMany.mockResolvedValueOnce([makeTeamRow()]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.competition).toBeNull();
  });

  it("2 — returns the primary competition's name when present", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: "FC Allschwil C1",
            shortName: "C1",
            status: "ACTIVE",
            competitions: [
              {
                competition: { officialName: "Junioren C Promotion", shortName: "Jun. C Promo" },
              },
            ],
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.competition).toEqual({
      name: "Junioren C Promotion",
      shortName: "Jun. C Promo",
    });
  });
});

describe("getTeamsListData — provider mapping enrichment", () => {
  it("3 — returns null providerMapping for a manual (non-SFV) team", async () => {
    mockFindMany.mockResolvedValueOnce([makeTeamRow({ externalMappings: [] })]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.providerMapping).toBeNull();
  });

  it("4 — returns the most recently synced provider mapping", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        externalMappings: [
          {
            provider: "SFV",
            providerIsActive: true,
            lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
            mappingSource: "SYNC",
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.providerMapping).toEqual({
      provider: "SFV",
      isActive: true,
      lastSyncedAt: "2027-07-01T00:00:00.000Z",
      source: "SYNC",
    });
  });

  it("5 — marks providerMapping.isActive = false for a provider-inactive team", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        externalMappings: [
          {
            provider: "SFV",
            providerIsActive: false,
            lastSyncedAt: new Date("2026-06-01T00:00:00.000Z"),
            mappingSource: "SYNC",
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.providerMapping?.isActive).toBe(false);
  });

  it("6 — a manual team can still show a competition without a provider mapping", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        externalMappings: [],
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: "Senioren 30+",
            shortName: null,
            status: "ACTIVE",
            competitions: [
              { competition: { officialName: "Senioren 30+ Promotion", shortName: null } },
            ],
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.providerMapping).toBeNull();
    expect(team.competition?.name).toBe("Senioren 30+ Promotion");
  });
});

// ── TEAM-IDENTITY-01 — canonical naming enrichment ────────────────────────────

describe("getTeamsListData — TEAM-IDENTITY-01 canonical naming", () => {
  it("7 — long name works: Team.name wins over a conflicting TeamSeason.displayName (TEAMCENTER-UX-01B)", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        name: "FC Allschwil Junioren B2",
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: "Junioren B2",
            shortName: "B2",
            status: "ACTIVE",
            competitions: [],
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.displayName).toBe("FC Allschwil Junioren B2");
  });

  it("8 — shortName optional: Team.shortName surfaces through to the list item", async () => {
    mockFindMany.mockResolvedValueOnce([makeTeamRow({ shortName: "B2" })]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.shortName).toBe("B2");
  });

  it("9 — alternativeName optional: Team.alternativeName surfaces through to the list item", async () => {
    mockFindMany.mockResolvedValueOnce([makeTeamRow({ alternativeName: "Junioren B2" })]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.alternativeName).toBe("Junioren B2");
  });

  it("10 — compact fallback prefers Team.shortName over Team.name", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        name: "FC Allschwil Junioren B2",
        shortName: "B2",
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: "FC Allschwil Junioren B2",
            shortName: null,
            status: "ACTIVE",
            competitions: [],
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.compactName).toBe("B2");
  });

  it("11 — manual team (no provider mapping) resolves naming purely from tenant fields", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        name: "Trainingsgruppe Aktive",
        shortName: null,
        alternativeName: null,
        externalMappings: [],
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: null,
            shortName: null,
            status: "ACTIVE",
            competitions: [],
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.displayName).toBe("Trainingsgruppe Aktive");
    expect(team.providerMapping).toBeNull();
  });

  it("12 — provider-connected team falls back to providerTeamName only when tenant fields are absent", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        name: "",
        shortName: null,
        alternativeName: null,
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: null,
            shortName: null,
            status: "ACTIVE",
            competitions: [],
          },
        ],
        externalMappings: [
          {
            provider: "SFV",
            providerIsActive: true,
            lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
            mappingSource: "SYNC",
            providerTeamName: "FC Allschwil C1 (4. Liga)",
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.displayName).toBe("FC Allschwil C1 (4. Liga)");
  });

  it("13 — provider sync does not overwrite tenant names: a provider-connected team still prefers Team.name/shortName", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        name: "FC Allschwil Junioren B2",
        shortName: "B2",
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: null,
            shortName: null,
            status: "ACTIVE",
            competitions: [],
          },
        ],
        externalMappings: [
          {
            provider: "SFV",
            providerIsActive: true,
            lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
            mappingSource: "SYNC",
            providerTeamName: "FC Allschwil Junioren B2 (4. Liga)",
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.displayName).toBe("FC Allschwil Junioren B2");
    expect(team.compactName).toBe("B2");
    expect(team.providerMapping?.teamName).toBe("FC Allschwil Junioren B2 (4. Liga)");
  });

  it("15 — TEAMCENTER-UX-01B root-cause regression: Team.name = 'FC Allschwil Junioren E3' renders even though season/provider display 'FC Allschwil Junioren E2'", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        id: "team-e3",
        name: "FC Allschwil Junioren E3",
        shortName: "E3",
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: "FC Allschwil Junioren E2",
            shortName: "E2",
            status: "ACTIVE",
            competitions: [],
          },
        ],
        externalMappings: [
          {
            provider: "SFV",
            providerIsActive: true,
            lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
            mappingSource: "SYNC",
            providerTeamName: "FC Allschwil Junioren E2 (SFV)",
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1");

    expect(team.displayName).toBe("FC Allschwil Junioren E3");
    expect(team.displayName).not.toBe("FC Allschwil Junioren E2");
  });

  it("14 — same name, different externalTeamId: two Team rows remain distinct list entries (identity safety)", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        id: "team-b1",
        name: "FC Allschwil",
        externalMappings: [
          {
            provider: "SFV",
            providerIsActive: true,
            lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
            mappingSource: "SYNC",
            providerTeamName: "FC Allschwil B1",
          },
        ],
      }),
      makeTeamRow({
        id: "team-b2",
        name: "FC Allschwil",
        externalMappings: [
          {
            provider: "SFV",
            providerIsActive: true,
            lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
            mappingSource: "SYNC",
            providerTeamName: "FC Allschwil B2",
          },
        ],
      }),
    ]);

    const teams = await getTeamsListData("tenant-1");

    expect(teams).toHaveLength(2);
    expect(teams.map((t) => t.id)).toEqual(["team-b1", "team-b2"]);
    expect(teams[0].id).not.toBe(teams[1].id);
  });
});

describe("TEAM-COCKPIT-PREMIUM-01E2 — getTeamsListData competition resolution", () => {
  it("A — SFV-mapped current-season team with providerLeagueName shows provider league", async () => {
    mockFindMany.mockResolvedValueOnce([makeTeamRow()]);
    mockMappingFindMany.mockResolvedValueOnce([makeCurrentSeasonMapping()]);

    const [team] = await getTeamsListData("tenant-1", "2026/2027");

    expect(team.competition).toEqual({
      name: "2. Liga interregional",
      shortName: null,
    });
  });

  it("B — canonical TeamSeasonCompetition wins when provider mapping is absent", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        teamSeasons: [
          {
            id: "ts-current",
            season: { key: "2026/2027", name: "2026/27" },
            displayName: "Senioren 30+",
            shortName: null,
            status: "ACTIVE",
            competitions: [
              { competition: { officialName: "Senioren 30+ Promotion", shortName: null } },
            ],
          },
        ],
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1", "2026/2027");

    expect(team.competition).toEqual({
      name: "Senioren 30+ Promotion",
      shortName: null,
    });
  });

  it("C — returns null competition when neither mapping nor canonical competition exist", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        name: "Trainingsgruppe",
        category: "TRAININGSGRUPPE",
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1", "2026/2027");

    expect(team.competition).toBeNull();
  });

  it("D — old-season provider mapping does not leak into the current list", async () => {
    mockFindMany.mockResolvedValueOnce([makeTeamRow()]);
    mockMappingFindMany.mockResolvedValueOnce([
      makeCurrentSeasonMapping({
        externalSeasonId: 2025,
        providerLeagueName: "Old League",
      }),
    ]);

    const [team] = await getTeamsListData("tenant-1", "2026/2027");

    expect(team.competition).toBeNull();
  });

  it("E — cross-tenant mapping does not leak into the current list", async () => {
    mockFindMany.mockResolvedValueOnce([makeTeamRow({ id: "team-a" })]);
    mockMappingFindMany.mockResolvedValueOnce([]);

    const [team] = await getTeamsListData("tenant-a", "2026/2027");

    expect(mockMappingFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        teamSeasonId: { in: ["ts-current"] },
        provider: "SFV",
        providerIsActive: true,
      },
      select: expect.any(Object),
    });
    expect(team.competition).toBeNull();
  });

  it("F — list resolves competition without live standings provider calls", async () => {
    const { fetchTeamStandingsForMapping } = await import("@/lib/integrations/sfv/standings-provider");

    mockFindMany.mockResolvedValueOnce([makeTeamRow()]);
    mockMappingFindMany.mockResolvedValueOnce([makeCurrentSeasonMapping()]);

    await getTeamsListData("tenant-1", "2026/2027");

    expect(fetchTeamStandingsForMapping).not.toHaveBeenCalled();
    expect(mockMappingFindMany).toHaveBeenCalledTimes(1);
  });

  it("G — existing provider mapping enrichment remains unchanged", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeTeamRow({
        externalMappings: [
          {
            provider: "SFV",
            providerIsActive: true,
            lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
            mappingSource: "SYNC",
            providerTeamName: "FC Allschwil C1",
          },
        ],
      }),
    ]);
    mockMappingFindMany.mockResolvedValueOnce([makeCurrentSeasonMapping()]);

    const [team] = await getTeamsListData("tenant-1", "2026/2027");

    expect(team.providerMapping).toEqual({
      provider: "SFV",
      isActive: true,
      lastSyncedAt: "2027-07-01T00:00:00.000Z",
      source: "SYNC",
      teamName: "FC Allschwil C1",
    });
    expect(team.isActive).toBe(true);
    expect(team.websiteVisible).toBe(true);
    expect(team.infoboardVisible).toBe(true);
  });
});
