/**
 * lib/integrations/sfv/__tests__/team-mapping-backfill.test.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockResolve = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamExternalMapping: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

vi.mock("../team-season-resolution", () => ({
  resolveTeamSeasonForExternalMapping: (...args: unknown[]) => mockResolve(...args),
}));

const {
  classifyTeamExternalMappingBackfill,
  backfillTeamExternalMappingTeamSeasonIds,
} = await import("../team-mapping-backfill");

const TENANT = "tenant-a";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("classifyTeamExternalMappingBackfill", () => {
  it("classifies eligible, already linked, ambiguous, and missing TeamSeason rows", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "m-eligible",
        teamId: "team-1",
        externalTeamId: 1,
        externalSeasonId: 2027,
        providerTeamName: "Team A",
        teamSeasonId: null,
      },
      {
        id: "m-linked",
        teamId: "team-2",
        externalTeamId: 2,
        externalSeasonId: 2027,
        providerTeamName: "Team B",
        teamSeasonId: "ts-linked",
      },
      {
        id: "m-missing",
        teamId: "team-3",
        externalTeamId: 3,
        externalSeasonId: 2027,
        providerTeamName: "Team C",
        teamSeasonId: null,
      },
      {
        id: "m-ambiguous",
        teamId: "team-4",
        externalTeamId: 4,
        externalSeasonId: 2027,
        providerTeamName: "Team D",
        teamSeasonId: null,
      },
    ]);

    mockResolve
      .mockResolvedValueOnce({
        ok: true,
        teamSeasonId: "ts-1",
        seasonId: "season-1",
        seasonKey: "2026/2027",
      })
      .mockResolvedValueOnce({
        ok: false,
        reason: "TEAM_SEASON_NOT_FOUND",
        message: "missing",
      })
      .mockResolvedValueOnce({
        ok: false,
        reason: "AMBIGUOUS",
        message: "ambiguous",
      });

    const report = await classifyTeamExternalMappingBackfill({
      tenantId: TENANT,
      externalSeasonId: 2027,
    });

    expect(report.eligible).toHaveLength(1);
    expect(report.alreadyLinked).toHaveLength(1);
    expect(report.missingTeamSeason).toHaveLength(1);
    expect(report.ambiguous).toHaveLength(1);
    expect(report.totalScanned).toBe(4);
  });
});

describe("backfillTeamExternalMappingTeamSeasonIds", () => {
  it("dry-run reports eligible updates without writing", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "m-eligible",
        teamId: "team-1",
        externalTeamId: 1,
        externalSeasonId: 2027,
        providerTeamName: "Team A",
        teamSeasonId: null,
      },
      {
        id: "m-linked",
        teamId: "team-2",
        externalTeamId: 2,
        externalSeasonId: 2027,
        providerTeamName: "Team B",
        teamSeasonId: "ts-linked",
      },
    ]);

    mockResolve.mockResolvedValueOnce({
      ok: true,
      teamSeasonId: "ts-1",
      seasonId: "season-1",
      seasonKey: "2026/2027",
    });

    const result = await backfillTeamExternalMappingTeamSeasonIds({
      tenantId: TENANT,
      externalSeasonId: 2027,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.updated).toBe(1);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("does not remap already-linked mappings", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "m-linked",
        teamId: "team-2",
        externalTeamId: 2,
        externalSeasonId: 2027,
        providerTeamName: "Team B",
        teamSeasonId: "ts-linked",
      },
    ]);

    const result = await backfillTeamExternalMappingTeamSeasonIds({
      tenantId: TENANT,
      externalSeasonId: 2027,
      dryRun: false,
    });

    expect(result.updated).toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("updates only rows still unlinked at execution time", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "m-eligible",
        teamId: "team-1",
        externalTeamId: 1,
        externalSeasonId: 2027,
        providerTeamName: "Team A",
        teamSeasonId: null,
      },
    ]);

    mockResolve.mockResolvedValueOnce({
      ok: true,
      teamSeasonId: "ts-1",
      seasonId: "season-1",
      seasonKey: "2026/2027",
    });

    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await backfillTeamExternalMappingTeamSeasonIds({
      tenantId: TENANT,
      externalSeasonId: 2027,
      dryRun: false,
    });

    expect(result.updated).toBe(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "m-eligible", tenantId: TENANT, teamSeasonId: null },
      data: { teamSeasonId: "ts-1" },
    });
  });
});
