/**
 * Tests for lib/standings/standings-service.ts
 *
 * Covers:
 *   A. calculateCompetitionStandings — competition not found
 *   B. calculateCompetitionStandings — happy path
 *   C. calculateTeamStanding
 *   D. calculateTenantStandings — empty tenant
 *   E. calculateTenantStandings — multiple competitions
 *   F. publishStandings — delegates to calculateCompetitionStandings
 *   G. buildStandingTable re-export
 *   H. Provider neutrality — no SFV imports in service output
 */

import { describe, it, expect, vi } from "vitest";

// Mock Prisma before importing service (service imports prisma at module level)
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    competition: { findFirst: vi.fn(), findMany: vi.fn() },
    teamSeasonCompetition: { findMany: vi.fn() },
    teamSeason: { findMany: vi.fn() },
    event: { findMany: vi.fn() },
  },
}));

import {
  calculateCompetitionStandings,
  calculateTeamStanding,
  calculateTenantStandings,
  publishStandings,
  buildStandingTable,
} from "../standings-service";
import { StandingsError } from "../errors";
import type { StandingsDatabase } from "../queries";

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeDb(overrides: Partial<StandingsDatabase> = {}): StandingsDatabase {
  return {
    competition: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    teamSeasonCompetition: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    teamSeason: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    event: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

const TENANT = "tenant-a";
const COMP = "comp-1";

const mockCompetition = {
  id: COMP,
  tenantId: TENANT,
  officialName: "Liga Alpha",
  isArchived: false,
};

// ── A. calculateCompetitionStandings — not found ──────────────────────────────

describe("A. calculateCompetitionStandings — competition not found", () => {
  it("throws StandingsError with COMPETITION_NOT_FOUND", async () => {
    const db = makeDb();
    await expect(
      calculateCompetitionStandings({ tenantId: TENANT, competitionId: COMP }, db),
    ).rejects.toThrow(StandingsError);

    await expect(
      calculateCompetitionStandings({ tenantId: TENANT, competitionId: COMP }, db),
    ).rejects.toMatchObject({ code: "COMPETITION_NOT_FOUND" });
  });
});

// ── B. calculateCompetitionStandings — happy path ─────────────────────────────

describe("B. calculateCompetitionStandings — happy path", () => {
  it("returns a StandingTable with correct shape", async () => {
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      },
      teamSeasonCompetition: {
        findMany: vi.fn().mockResolvedValue([
          {
            teamSeasonId: "ts-1",
            competitionId: COMP,
            teamSeason: { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", team: { id: "team-1" } },
          },
          {
            teamSeasonId: "ts-2",
            competitionId: COMP,
            teamSeason: { id: "ts-2", teamId: "team-2", displayName: "FC Beta", team: { id: "team-2" } },
          },
        ]),
      },
      teamSeason: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", competitions: [{ competitionId: COMP }] },
          { id: "ts-2", teamId: "team-2", displayName: "FC Beta", competitions: [{ competitionId: COMP }] },
        ]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-1",
            tenantId: TENANT,
            status: "COMPLETED",
            startAt: new Date("2026-09-10T15:00:00Z"),
            matchExternalMapping: {
              homeTeamId: "team-1",
              awayTeamId: "team-2",
              scoreHome: 2,
              scoreAway: 0,
            },
          },
        ]),
      },
    });

    const table = await calculateCompetitionStandings(
      { tenantId: TENANT, competitionId: COMP },
      db,
    );

    expect(table.competitionId).toBe(COMP);
    expect(table.tenantId).toBe(TENANT);
    expect(table.rows).toHaveLength(2);
    expect(table.matchCount).toBe(1);
    expect(table.rows[0].teamSeasonId).toBe("ts-1");
    expect(table.rows[0].points).toBe(3);
    expect(table.rows[1].points).toBe(0);
  });

  it("returns empty table when no teams enrolled", async () => {
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      },
    });

    const table = await calculateCompetitionStandings(
      { tenantId: TENANT, competitionId: COMP },
      db,
    );

    expect(table.rows).toHaveLength(0);
    expect(table.matchCount).toBe(0);
  });
});

// ── C. calculateTeamStanding ──────────────────────────────────────────────────

describe("C. calculateTeamStanding", () => {
  it("returns null when team is not in the table", async () => {
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      },
    });

    const row = await calculateTeamStanding(
      { tenantId: TENANT, competitionId: COMP, teamSeasonId: "ts-nonexistent" },
      db,
    );
    expect(row).toBeNull();
  });

  it("returns correct row for the requested team", async () => {
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      },
      teamSeasonCompetition: {
        findMany: vi.fn().mockResolvedValue([
          { teamSeasonId: "ts-1", competitionId: COMP, teamSeason: { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", team: { id: "team-1" } } },
          { teamSeasonId: "ts-2", competitionId: COMP, teamSeason: { id: "ts-2", teamId: "team-2", displayName: "FC Beta", team: { id: "team-2" } } },
        ]),
      },
      teamSeason: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", competitions: [{ competitionId: COMP }] },
          { id: "ts-2", teamId: "team-2", displayName: "FC Beta", competitions: [{ competitionId: COMP }] },
        ]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([
          { id: "e1", tenantId: TENANT, status: "COMPLETED", startAt: new Date(), matchExternalMapping: { homeTeamId: "team-1", awayTeamId: "team-2", scoreHome: 1, scoreAway: 0 } },
        ]),
      },
    });

    const row = await calculateTeamStanding(
      { tenantId: TENANT, competitionId: COMP, teamSeasonId: "ts-1" },
      db,
    );
    expect(row).not.toBeNull();
    expect(row!.won).toBe(1);
    expect(row!.points).toBe(3);
  });
});

// ── D. calculateTenantStandings — empty ───────────────────────────────────────

describe("D. calculateTenantStandings — empty tenant", () => {
  it("throws TENANT_NOT_FOUND for empty tenantId", async () => {
    const db = makeDb();
    await expect(
      calculateTenantStandings({ tenantId: "  " }, db),
    ).rejects.toMatchObject({ code: "TENANT_NOT_FOUND" });
  });

  it("returns empty tables array when tenant has no competitions", async () => {
    const db = makeDb();
    const result = await calculateTenantStandings({ tenantId: TENANT }, db);
    expect(result.tenantId).toBe(TENANT);
    expect(result.tables).toHaveLength(0);
  });
});

// ── E. calculateTenantStandings — multiple competitions ───────────────────────

describe("E. calculateTenantStandings — multiple competitions", () => {
  it("returns one table per competition", async () => {
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          { id: "comp-1", tenantId: TENANT, officialName: "Liga A", isArchived: false },
          { id: "comp-2", tenantId: TENANT, officialName: "Liga B", isArchived: false },
        ]),
      },
      teamSeasonCompetition: {
        findMany: vi.fn().mockResolvedValue([
          { teamSeasonId: "ts-1", competitionId: "comp-1", teamSeason: { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", team: { id: "team-1" } } },
          { teamSeasonId: "ts-2", competitionId: "comp-2", teamSeason: { id: "ts-2", teamId: "team-2", displayName: "FC Beta", team: { id: "team-2" } } },
        ]),
      },
    });

    const result = await calculateTenantStandings({ tenantId: TENANT }, db);
    expect(result.tables).toHaveLength(2);
    const compIds = result.tables.map((t) => t.competitionId).sort();
    expect(compIds).toEqual(["comp-1", "comp-2"]);
  });
});

// ── F. publishStandings ───────────────────────────────────────────────────────

describe("F. publishStandings", () => {
  it("returns the same table as calculateCompetitionStandings", async () => {
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      },
    });

    const published = await publishStandings({ tenantId: TENANT, competitionId: COMP }, db);
    expect(published.competitionId).toBe(COMP);
    expect(published.tenantId).toBe(TENANT);
  });
});

// ── G. buildStandingTable re-export ──────────────────────────────────────────

describe("G. buildStandingTable re-export", () => {
  it("is re-exported and functional", () => {
    const registry = new Map([
      ["ts-1", { teamSeasonId: "ts-1", teamName: "FC Alpha", competitionId: COMP }],
    ]);
    const table = buildStandingTable(COMP, TENANT, [], registry);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].played).toBe(0);
  });
});

// ── H. Provider neutrality ────────────────────────────────────────────────────

describe("H. Provider neutrality", () => {
  it("StandingTable contains no provider-specific fields", async () => {
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      },
    });
    const table = await calculateCompetitionStandings(
      { tenantId: TENANT, competitionId: COMP },
      db,
    );

    // Ensure no SFV or provider-specific keys exist in the output
    const tableStr = JSON.stringify(table);
    expect(tableStr).not.toContain("sfv");
    expect(tableStr).not.toContain("provider");
    expect(tableStr).not.toContain("externalTeamId");
  });
});
