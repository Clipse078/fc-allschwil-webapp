/**
 * lib/teams/__tests__/team-lifecycle-service.test.ts
 *
 * TEAMCENTER-UX-01 — Focused tests for archive / restore / safe-delete.
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. archiveTeam sets isActive=false, strictly tenant-scoped.
 *   2. archiveTeam throws TeamNotFoundError for a cross-tenant Team.
 *   3. restoreTeam sets isActive=true, strictly tenant-scoped.
 *   4. restoreTeam throws TeamNotFoundError for a cross-tenant Team.
 *   5. getTeamDeletionBlockers returns [] for an unused Team (single season, no history).
 *   6. getTeamDeletionBlockers reports roster/training/match/tournament/provider/org
 *      dependencies when present.
 *   7. getTeamDeletionBlockers reports multi-season history as a blocker.
 *   8. getTeamDeletionBlockers returns null for a cross-tenant Team (never leaks existence).
 *   9. deleteTeamSafely hard-deletes an unused Team.
 *  10. deleteTeamSafely throws TeamDeletionBlockedError (never deletes) when history exists.
 *  11. deleteTeamSafely throws TeamNotFoundError for a cross-tenant Team (never deletes).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  teamFindFirst: vi.fn(),
  teamUpdate: vi.fn(),
  teamDelete: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findFirst: (...args: unknown[]) => mocks.teamFindFirst(...args),
      update: (...args: unknown[]) => mocks.teamUpdate(...args),
      delete: (...args: unknown[]) => mocks.teamDelete(...args),
    },
  },
}));

import {
  TeamDeletionBlockedError,
  TeamNotFoundError,
  archiveTeam,
  deleteTeamSafely,
  getTeamDeletionBlockers,
  restoreTeam,
} from "../team-lifecycle-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TEAM_ID = "team-01";

function makeUnusedTeamRow() {
  return {
    _count: {
      events: 0,
      eventImportRuns: 0,
      homeMatchMappings: 0,
      awayMatchMappings: 0,
      tournamentParticipations: 0,
      externalMappings: 0,
    },
    teamSeasons: [
      {
        _count: {
          playerSquadMembers: 0,
          trainerTeamMembers: 0,
          trainingSeries: 0,
          trainingSessions: 0,
          competitions: 0,
          externalMappings: 0,
          orgUnits: 0,
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("archiveTeam / restoreTeam", () => {
  it("1 — archiveTeam sets isActive=false for a Team owned by the tenant", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_A });
    mocks.teamUpdate.mockResolvedValueOnce({ id: TEAM_ID, isActive: false });

    const result = await archiveTeam(TENANT_A, TEAM_ID);

    expect(mocks.teamFindFirst).toHaveBeenCalledWith({
      where: { id: TEAM_ID, tenantId: TENANT_A },
    });
    expect(mocks.teamUpdate).toHaveBeenCalledWith({
      where: { id: TEAM_ID },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });

  it("2 — archiveTeam throws TeamNotFoundError for a Team belonging to another tenant", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce(null);

    await expect(archiveTeam(TENANT_B, TEAM_ID)).rejects.toBeInstanceOf(TeamNotFoundError);
    expect(mocks.teamUpdate).not.toHaveBeenCalled();
  });

  it("3 — restoreTeam sets isActive=true for a Team owned by the tenant", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_A });
    mocks.teamUpdate.mockResolvedValueOnce({ id: TEAM_ID, isActive: true });

    const result = await restoreTeam(TENANT_A, TEAM_ID);

    expect(mocks.teamUpdate).toHaveBeenCalledWith({
      where: { id: TEAM_ID },
      data: { isActive: true },
    });
    expect(result.isActive).toBe(true);
  });

  it("4 — restoreTeam throws TeamNotFoundError for a Team belonging to another tenant", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce(null);

    await expect(restoreTeam(TENANT_B, TEAM_ID)).rejects.toBeInstanceOf(TeamNotFoundError);
    expect(mocks.teamUpdate).not.toHaveBeenCalled();
  });
});

describe("getTeamDeletionBlockers", () => {
  it("5 — returns [] for an unused Team (single season, no roster/training/matches/etc.)", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce(makeUnusedTeamRow());

    const blockers = await getTeamDeletionBlockers(TENANT_A, TEAM_ID);

    expect(blockers).toEqual([]);
  });

  it("6 — reports roster, training, match, tournament, and provider-mapping dependencies", async () => {
    const row = makeUnusedTeamRow();
    row._count.events = 3;
    row._count.homeMatchMappings = 1;
    row._count.tournamentParticipations = 2;
    row._count.externalMappings = 1;
    row.teamSeasons[0]._count.playerSquadMembers = 14;
    row.teamSeasons[0]._count.trainingSeries = 1;
    mocks.teamFindFirst.mockResolvedValueOnce(row);

    const blockers = await getTeamDeletionBlockers(TENANT_A, TEAM_ID);

    const keys = blockers?.map((b) => b.key).sort();
    expect(keys).toEqual(
      ["events", "matches", "providerMappings", "squad", "trainingSeries", "tournaments"].sort(),
    );
  });

  it("7 — reports multi-season history as a blocker even with no other data", async () => {
    const row = makeUnusedTeamRow();
    row.teamSeasons.push({
      _count: {
        playerSquadMembers: 0,
        trainerTeamMembers: 0,
        trainingSeries: 0,
        trainingSessions: 0,
        competitions: 0,
        externalMappings: 0,
        orgUnits: 0,
      },
    });
    mocks.teamFindFirst.mockResolvedValueOnce(row);

    const blockers = await getTeamDeletionBlockers(TENANT_A, TEAM_ID);

    expect(blockers?.some((b) => b.key === "seasons")).toBe(true);
  });

  it("8 — returns null for a Team belonging to another tenant (no cross-tenant leak)", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce(null);

    const blockers = await getTeamDeletionBlockers(TENANT_B, TEAM_ID);

    expect(blockers).toBeNull();
  });
});

describe("deleteTeamSafely", () => {
  it("9 — hard-deletes an unused Team", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce(makeUnusedTeamRow());
    mocks.teamDelete.mockResolvedValueOnce({ id: TEAM_ID });

    await deleteTeamSafely(TENANT_A, TEAM_ID);

    expect(mocks.teamDelete).toHaveBeenCalledWith({ where: { id: TEAM_ID } });
  });

  it("10 — blocks deletion (never calls delete) when meaningful history exists", async () => {
    const row = makeUnusedTeamRow();
    row.teamSeasons[0]._count.playerSquadMembers = 5;
    mocks.teamFindFirst.mockResolvedValueOnce(row);

    await expect(deleteTeamSafely(TENANT_A, TEAM_ID)).rejects.toBeInstanceOf(
      TeamDeletionBlockedError,
    );
    expect(mocks.teamDelete).not.toHaveBeenCalled();
  });

  it("11 — never deletes a Team belonging to another tenant", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce(null);

    await expect(deleteTeamSafely(TENANT_B, TEAM_ID)).rejects.toBeInstanceOf(TeamNotFoundError);
    expect(mocks.teamDelete).not.toHaveBeenCalled();
  });
});
