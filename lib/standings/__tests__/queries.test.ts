/**
 * Tests for lib/standings/queries.ts
 *
 * Covers:
 *   A. mapEventStatusToCanonical
 *   B. buildTeamRegistry — mock DB
 *   C. fetchMatchResultsForCompetition — mock DB
 *   D. fetchCompetitionById
 *   E. Multiple tenants isolation
 */

import { describe, it, expect, vi } from "vitest";
import {
  mapEventStatusToCanonical,
  buildTeamRegistry,
  fetchMatchResultsForCompetition,
  fetchCompetitionById,
  buildAllTeamRegistries,
  type StandingsDatabase,
} from "../queries";

// ── A. mapEventStatusToCanonical ──────────────────────────────────────────────

describe("A. mapEventStatusToCanonical", () => {
  it("maps COMPLETED to FINISHED", () => {
    expect(mapEventStatusToCanonical("COMPLETED")).toBe("FINISHED");
  });

  it("maps LIVE to LIVE", () => {
    expect(mapEventStatusToCanonical("LIVE")).toBe("LIVE");
  });

  it("maps SCHEDULED to SCHEDULED", () => {
    expect(mapEventStatusToCanonical("SCHEDULED")).toBe("SCHEDULED");
  });

  it("maps POSTPONED to POSTPONED", () => {
    expect(mapEventStatusToCanonical("POSTPONED")).toBe("POSTPONED");
  });

  it("maps CANCELLED to CANCELLED", () => {
    expect(mapEventStatusToCanonical("CANCELLED")).toBe("CANCELLED");
  });

  it("maps ABANDONED to ABANDONED", () => {
    expect(mapEventStatusToCanonical("ABANDONED")).toBe("ABANDONED");
  });

  it("maps FORFEITED to FORFEITED", () => {
    expect(mapEventStatusToCanonical("FORFEITED")).toBe("FORFEITED");
  });

  it("maps DRAFT to SCHEDULED (conservative fallback)", () => {
    expect(mapEventStatusToCanonical("DRAFT")).toBe("SCHEDULED");
  });

  it("maps ARCHIVED to SCHEDULED (conservative fallback)", () => {
    expect(mapEventStatusToCanonical("ARCHIVED")).toBe("SCHEDULED");
  });

  it("maps unknown values to SCHEDULED", () => {
    expect(mapEventStatusToCanonical("UNKNOWN_FUTURE_STATUS")).toBe("SCHEDULED");
  });
});

// ── Helpers for mock DB ───────────────────────────────────────────────────────

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

// ── B. buildTeamRegistry ──────────────────────────────────────────────────────

describe("B. buildTeamRegistry", () => {
  it("returns empty map when no enrollments exist", async () => {
    const db = makeDb();
    const registry = await buildTeamRegistry(db, "tenant-1", "comp-1");
    expect(registry.size).toBe(0);
  });

  it("maps each enrolled TeamSeason to a TeamDescriptor", async () => {
    const db = makeDb({
      teamSeasonCompetition: {
        findMany: vi.fn().mockResolvedValue([
          {
            teamSeasonId: "ts-1",
            competitionId: "comp-1",
            teamSeason: {
              id: "ts-1",
              teamId: "team-1",
              displayName: "FC Alpha",
              team: { id: "team-1" },
            },
          },
          {
            teamSeasonId: "ts-2",
            competitionId: "comp-1",
            teamSeason: {
              id: "ts-2",
              teamId: "team-2",
              displayName: "FC Beta",
              team: { id: "team-2" },
            },
          },
        ]),
      },
    });

    const registry = await buildTeamRegistry(db, "tenant-1", "comp-1");
    expect(registry.size).toBe(2);
    expect(registry.get("ts-1")).toEqual({
      teamSeasonId: "ts-1",
      teamName: "FC Alpha",
      competitionId: "comp-1",
    });
    expect(registry.get("ts-2")).toEqual({
      teamSeasonId: "ts-2",
      teamName: "FC Beta",
      competitionId: "comp-1",
    });
  });
});

// ── C. fetchMatchResultsForCompetition ────────────────────────────────────────

describe("C. fetchMatchResultsForCompetition", () => {
  it("returns empty array when registry is empty", async () => {
    const db = makeDb();
    const results = await fetchMatchResultsForCompetition(db, "t1", "c1", new Map());
    expect(results).toHaveLength(0);
  });

  it("returns empty array when no teamSeasons resolve to competition", async () => {
    const registry = new Map([
      ["ts-1", { teamSeasonId: "ts-1", teamName: "FC Alpha", competitionId: "c1" }],
    ]);
    const db = makeDb({
      teamSeason: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ts-1",
            teamId: "team-1",
            displayName: "FC Alpha",
            competitions: [], // not enrolled in this competition
          },
        ]),
      },
    });
    const results = await fetchMatchResultsForCompetition(db, "t1", "c1", registry);
    expect(results).toHaveLength(0);
  });

  it("produces CanonicalMatchResult from COMPLETED events with scores", async () => {
    const registry = new Map([
      ["ts-1", { teamSeasonId: "ts-1", teamName: "FC Alpha", competitionId: "c1" }],
      ["ts-2", { teamSeasonId: "ts-2", teamName: "FC Beta", competitionId: "c1" }],
    ]);
    const db = makeDb({
      teamSeason: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", competitions: [{ competitionId: "c1" }] },
          { id: "ts-2", teamId: "team-2", displayName: "FC Beta", competitions: [{ competitionId: "c1" }] },
        ]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-1",
            tenantId: "t1",
            status: "COMPLETED",
            startAt: new Date("2026-09-10T15:00:00Z"),
            matchExternalMapping: {
              homeTeamId: "team-1",
              awayTeamId: "team-2",
              scoreHome: 2,
              scoreAway: 1,
            },
          },
        ]),
      },
    });

    const results = await fetchMatchResultsForCompetition(db, "t1", "c1", registry);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      matchId: "event-1",
      tenantId: "t1",
      competitionId: "c1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 2,
      scoreAway: 1,
      status: "FINISHED",
    });
  });

  it("skips events with null scores", async () => {
    const registry = new Map([
      ["ts-1", { teamSeasonId: "ts-1", teamName: "FC Alpha", competitionId: "c1" }],
      ["ts-2", { teamSeasonId: "ts-2", teamName: "FC Beta", competitionId: "c1" }],
    ]);
    const db = makeDb({
      teamSeason: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", competitions: [{ competitionId: "c1" }] },
          { id: "ts-2", teamId: "team-2", displayName: "FC Beta", competitions: [{ competitionId: "c1" }] },
        ]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-1",
            tenantId: "t1",
            status: "COMPLETED",
            startAt: new Date("2026-09-10"),
            matchExternalMapping: {
              homeTeamId: "team-1",
              awayTeamId: "team-2",
              scoreHome: null, // null score
              scoreAway: 1,
            },
          },
        ]),
      },
    });
    const results = await fetchMatchResultsForCompetition(db, "t1", "c1", registry);
    expect(results).toHaveLength(0);
  });

  it("skips events with null homeTeamId", async () => {
    const registry = new Map([
      ["ts-1", { teamSeasonId: "ts-1", teamName: "FC Alpha", competitionId: "c1" }],
    ]);
    const db = makeDb({
      teamSeason: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", competitions: [{ competitionId: "c1" }] },
        ]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-1",
            tenantId: "t1",
            status: "COMPLETED",
            startAt: new Date("2026-09-10"),
            matchExternalMapping: {
              homeTeamId: null, // unresolved home team
              awayTeamId: "team-1",
              scoreHome: 1,
              scoreAway: 0,
            },
          },
        ]),
      },
    });
    const results = await fetchMatchResultsForCompetition(db, "t1", "c1", registry);
    expect(results).toHaveLength(0);
  });

  it("skips events where awayTeamId is not in competition", async () => {
    const registry = new Map([
      ["ts-1", { teamSeasonId: "ts-1", teamName: "FC Alpha", competitionId: "c1" }],
    ]);
    const db = makeDb({
      teamSeason: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", competitions: [{ competitionId: "c1" }] },
        ]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-1",
            tenantId: "t1",
            status: "COMPLETED",
            startAt: new Date("2026-09-10"),
            matchExternalMapping: {
              homeTeamId: "team-1",
              awayTeamId: "team-external", // not in our registry
              scoreHome: 1,
              scoreAway: 0,
            },
          },
        ]),
      },
    });
    const results = await fetchMatchResultsForCompetition(db, "t1", "c1", registry);
    expect(results).toHaveLength(0);
  });
});

// ── D. fetchCompetitionById ────────────────────────────────────────────────────

describe("D. fetchCompetitionById", () => {
  it("returns null when competition not found", async () => {
    const db = makeDb();
    const result = await fetchCompetitionById(db, "tenant-1", "comp-999");
    expect(result).toBeNull();
  });

  it("returns the competition when found", async () => {
    const mockComp = { id: "comp-1", tenantId: "tenant-1", officialName: "Liga X", isArchived: false };
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(mockComp),
        findMany: vi.fn().mockResolvedValue([mockComp]),
      },
    });
    const result = await fetchCompetitionById(db, "tenant-1", "comp-1");
    expect(result).toEqual(mockComp);
  });
});

// ── E. buildAllTeamRegistries ─────────────────────────────────────────────────

describe("E. buildAllTeamRegistries", () => {
  it("returns empty map when tenant has no competitions", async () => {
    const db = makeDb();
    const registries = await buildAllTeamRegistries(db, "tenant-1");
    expect(registries.size).toBe(0);
  });

  it("groups teams by competition", async () => {
    const db = makeDb({
      competition: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          { id: "comp-1", tenantId: "t1", officialName: "Liga A", isArchived: false },
          { id: "comp-2", tenantId: "t1", officialName: "Liga B", isArchived: false },
        ]),
      },
      teamSeasonCompetition: {
        findMany: vi.fn().mockResolvedValue([
          {
            teamSeasonId: "ts-1",
            competitionId: "comp-1",
            teamSeason: { id: "ts-1", teamId: "team-1", displayName: "FC Alpha", team: { id: "team-1" } },
          },
          {
            teamSeasonId: "ts-2",
            competitionId: "comp-2",
            teamSeason: { id: "ts-2", teamId: "team-2", displayName: "FC Beta", team: { id: "team-2" } },
          },
        ]),
      },
    });

    const registries = await buildAllTeamRegistries(db, "t1");
    expect(registries.size).toBe(2);
    expect(registries.get("comp-1")?.has("ts-1")).toBe(true);
    expect(registries.get("comp-2")?.has("ts-2")).toBe(true);
  });
});
