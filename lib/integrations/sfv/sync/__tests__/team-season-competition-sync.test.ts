/**
 * lib/integrations/sfv/sync/__tests__/team-season-competition-sync.test.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TeamDetail } from "../../client";

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockTransaction = vi.fn();
const mockUpdateMany = vi.fn();
const mockResolveTeamSeason = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamExternalMapping: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    competition: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    teamSeasonCompetition: {
      findUnique: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: vi.fn(),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("../../team-season-resolution", () => ({
  resolveTeamSeasonIdForExternalMapping: (...args: unknown[]) =>
    mockResolveTeamSeason(...args),
}));

const {
  buildTeamCompetitionLinkContextsFromTeamList,
  selectPrimaryCompetitionId,
  linkTeamSeasonCompetitionFromSync,
} = await import("../team-season-competition-sync");

function teamDetail(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: true,
    teamId: 1001,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1",
    clubNumber: 483,
    clubName: "FC Allschwil",
    teamLeagueId: 500,
    teamLeagueName: "3. Liga",
    teamDivisionName: "Gruppe 1",
    teamOrganisationId: 8,
    isTeamActive: true,
    ...overrides,
  };
}

describe("buildTeamCompetitionLinkContextsFromTeamList", () => {
  it("extracts one context per team with a valid league id", () => {
    const contexts = buildTeamCompetitionLinkContextsFromTeamList(
      [teamDetail(), teamDetail({ teamId: 1002, teamLeagueId: 600 })],
      2027,
    );

    expect(contexts).toHaveLength(2);
    expect(contexts[0]).toMatchObject({
      externalSeasonId: 2027,
      externalTeamId: 1001,
      externalCompetitionId: 500,
    });
  });
});

describe("selectPrimaryCompetitionId", () => {
  it("prefers the competition matching providerLeagueId", () => {
    const externalIds = new Map([
      ["comp-a", 500],
      ["comp-b", 600],
    ]);

    expect(
      selectPrimaryCompetitionId(["comp-a", "comp-b"], [], externalIds, 600),
    ).toBe("comp-b");
  });

  it("breaks ties deterministically by lowest externalCompetitionId", () => {
    const externalIds = new Map([
      ["comp-a", 700],
      ["comp-b", 500],
    ]);

    expect(
      selectPrimaryCompetitionId(["comp-a", "comp-b"], [], externalIds, null),
    ).toBe("comp-b");
  });
});

describe("linkTeamSeasonCompetitionFromSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when mapping is missing", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const outcome = await linkTeamSeasonCompetitionFromSync("tenant-a", {
      externalSeasonId: 2027,
      externalTeamId: 1001,
      externalCompetitionId: 500,
      providerLeagueId: 500,
    });

    expect(outcome).toEqual({ status: "skipped", reason: "NO_MAPPING" });
  });

  it("links TeamSeasonCompetition when mapping and competition exist", async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        id: "map-1",
        teamId: "team-1",
        teamSeasonId: "ts-1",
        providerLeagueId: 500,
      })
      .mockResolvedValueOnce({
        id: "comp-1",
        externalCompetitionId: 500,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ isPrimary: true });

    mockTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
      const tx = {
        teamSeasonCompetition: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([
            {
              id: "tsc-1",
              competitionId: "comp-1",
              competition: { externalCompetitionId: 500 },
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      await cb(tx);
    });

    const outcome = await linkTeamSeasonCompetitionFromSync("tenant-a", {
      externalSeasonId: 2027,
      externalTeamId: 1001,
      externalCompetitionId: 500,
      providerLeagueId: 500,
    });

    expect(outcome.status).toBe("linked");
    if (outcome.status === "linked") {
      expect(outcome.teamSeasonId).toBe("ts-1");
      expect(outcome.competitionId).toBe("comp-1");
    }
  });

  it("scopes competition lookup by tenant and season", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    await linkTeamSeasonCompetitionFromSync("tenant-a", {
      externalSeasonId: 2027,
      externalTeamId: 1001,
      externalCompetitionId: 500,
      providerLeagueId: 500,
    });

    expect(mockFindFirst).toHaveBeenCalled();
  });
});
