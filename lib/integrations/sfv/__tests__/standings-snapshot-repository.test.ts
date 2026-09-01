/**
 * lib/integrations/sfv/__tests__/standings-snapshot-repository.test.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isUsableStandingsTable,
  loadStandingsSnapshot,
  parseStoredStandingsTable,
  persistStandingsSnapshot,
} from "../standings-snapshot-repository";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    sfvStandingsSnapshot: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

function createStandingsTable() {
  return {
    competition: {
      name: "Junioren E",
      divisionName: "Division 1",
      groupName: "Gruppe A",
    },
    rows: [
      {
        position: 1,
        externalTeamId: 100,
        teamName: "FC Example",
        shortName: null,
        played: 10,
        won: 8,
        drawn: 1,
        lost: 1,
        goalsFor: 25,
        goalsAgainst: 8,
        points: 25,
        penaltyPoints: 0,
      },
    ],
  };
}

describe("standings-snapshot-repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses stored standings tables and rejects malformed payloads", () => {
    const table = createStandingsTable();
    expect(parseStoredStandingsTable(table)).toEqual(table);
    expect(parseStoredStandingsTable({ competition: { name: "" }, rows: [] })).toBeNull();
    expect(parseStoredStandingsTable({ competition: { name: "League" }, rows: [{}] })).toBeNull();
  });

  it("treats only non-empty row sets as usable snapshots", () => {
    expect(isUsableStandingsTable(createStandingsTable())).toBe(true);
    expect(
      isUsableStandingsTable({
        competition: { name: "League", divisionName: null, groupName: null },
        rows: [],
      }),
    ).toBe(false);
  });

  it("loads a persisted snapshot when JSON is valid", async () => {
    const fetchedAt = new Date("2026-08-25T10:00:00.000Z");
    mocks.findUnique.mockResolvedValue({
      standingsTable: createStandingsTable(),
      fetchedAt,
      sfvLeagueId: 10,
      sfvDivisionId: 20,
      sfvGroupId: 30,
    });

    const snapshot = await loadStandingsSnapshot({
      tenantId: "tenant-a",
      externalSeasonId: 2027,
      externalTeamId: 100,
      providerLeagueId: 10,
    });

    expect(snapshot).toEqual({
      standingsTable: createStandingsTable(),
      fetchedAt,
      sfvLeagueId: 10,
      sfvDivisionId: 20,
      sfvGroupId: 30,
    });
  });

  it("does not persist empty or unusable standings tables", async () => {
    await persistStandingsSnapshot({
      tenantId: "tenant-a",
      externalSeasonId: 2027,
      externalTeamId: 100,
      providerLeagueId: 10,
      standingsTable: {
        competition: { name: "League", divisionName: null, groupName: null },
        rows: [],
      },
      sfvLeagueId: 10,
      sfvDivisionId: 20,
      sfvGroupId: 30,
      fetchedAt: new Date(),
    });

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("upserts usable snapshots by canonical identity", async () => {
    const fetchedAt = new Date("2026-08-25T10:00:00.000Z");
    const standingsTable = createStandingsTable();

    await persistStandingsSnapshot({
      tenantId: "tenant-a",
      externalSeasonId: 2027,
      externalTeamId: 100,
      providerLeagueId: 10,
      standingsTable,
      sfvLeagueId: 10,
      sfvDivisionId: 20,
      sfvGroupId: 30,
      fetchedAt,
    });

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_externalSeasonId_externalTeamId_providerLeagueId: {
          tenantId: "tenant-a",
          externalSeasonId: 2027,
          externalTeamId: 100,
          providerLeagueId: 10,
        },
      },
      create: {
        tenantId: "tenant-a",
        externalSeasonId: 2027,
        externalTeamId: 100,
        providerLeagueId: 10,
        standingsTable,
        sfvLeagueId: 10,
        sfvDivisionId: 20,
        sfvGroupId: 30,
        fetchedAt,
      },
      update: {
        standingsTable,
        sfvLeagueId: 10,
        sfvDivisionId: 20,
        sfvGroupId: 30,
        fetchedAt,
      },
    });
  });
});
