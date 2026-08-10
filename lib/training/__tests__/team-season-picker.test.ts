/**
 * lib/training/__tests__/team-season-picker.test.ts
 *
 * TEAMCENTER-UX-01C — root-cause regression tests for the TrainingCenter
 * "Neue Trainingsserie" team-season picker (findTeamSeasonsForTenant) and
 * its edit-mode counterpart (findTeamSeasonPickerRow).
 *
 * Root cause (TEAMCENTER-UX-01C): findTeamSeasonsForTenant filtered ONLY by
 * `TeamSeason.status === "ACTIVE"`, with no season-currency constraint.
 * Nothing ever flips a TeamSeason's status during a season rollover, so
 * every historical season's TeamSeason for a Team accumulated in this
 * picker forever — a fundamentally different (and staler) selection
 * surface than what the Teams UI treats as canonical/current for the same
 * Team (see lib/teams/current-season.ts). The picker must now additionally
 * scope to the canonical current season.
 *
 * MASTERDATA-SELECTOR-CONSISTENCY-03 root-cause fix (BUG 1 — empty
 * selector regression): scoping to `Season.isActive` (above) introduced a
 * NEW failure mode — `Season.isActive` is only ever refreshed as a side
 * effect of visiting a Seasons admin surface (lib/seasons/queries.ts), so a
 * tenant that hasn't opened /dashboard/seasons since the last season
 * boundary can have a stale/absent `Season.isActive` flag while still
 * having perfectly eligible Teams. Team-centric surfaces (Teams overview,
 * GET /api/teams — TournamentCenter's Team dropdown) never went empty from
 * this because a Team still renders even when its `teamSeasons` relation
 * filter matches nothing. This TeamSeason-centric picker has no such
 * safety net, so it silently rendered completely empty. The fix syncs
 * `Season.isActive` from the same canonical lifecycle rule before querying
 * — without adding any new fallback to a stale/historical season (PR #342
 * protection preserved).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/seasons/queries", () => ({
  syncSeasonActiveFlagsWithLifecycle: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { syncSeasonActiveFlagsWithLifecycle } from "@/lib/seasons/queries";
import { findTeamSeasonsForTenant, findTeamSeasonPickerRow } from "../queries";

const mockPrisma = prisma as unknown as {
  teamSeason: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const mockSync = syncSeasonActiveFlagsWithLifecycle as ReturnType<typeof vi.fn>;

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function teamSeasonRow(overrides: {
  id: string;
  teamId: string;
  teamName: string;
  seasonName: string;
  trainerTeamMembers?: unknown[];
}) {
  return {
    id: overrides.id,
    teamId: overrides.teamId,
    team: { name: overrides.teamName },
    season: { name: overrides.seasonName },
    trainerTeamMembers: overrides.trainerTeamMembers ?? [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findTeamSeasonsForTenant — TEAMCENTER-UX-01C root-cause fix", () => {
  it("scopes the query to the canonical current season (Season.isActive), not just TeamSeason.status", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);

    await findTeamSeasonsForTenant(TENANT_A);

    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({
      status: "ACTIVE",
      team: { tenantId: TENANT_A, isActive: true },
      season: { isActive: true },
    });
  });

  it("still requires TeamSeason.status ACTIVE and an active Team (existing eligibility rules preserved)", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);

    await findTeamSeasonsForTenant(TENANT_A);

    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where.status).toBe("ACTIVE");
    expect(callArgs.where.team.isActive).toBe(true);
  });

  it("maps rows returned by Prisma to picker options unchanged (mapping is unaffected by the scoping fix)", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([
      teamSeasonRow({ id: "ts-current", teamId: "team-1", teamName: "FC Allschwil E1", seasonName: "2026/2027" }),
    ]);

    const rows = await findTeamSeasonsForTenant(TENANT_A);

    expect(rows).toEqual([
      {
        id: "ts-current",
        teamId: "team-1",
        teamName: "FC Allschwil E1",
        seasonName: "2026/2027",
        trainers: [],
      },
    ]);
  });
});

describe("findTeamSeasonsForTenant — MASTERDATA-SELECTOR-CONSISTENCY-03 focused tests", () => {
  // 1. eligible current-season FCA Team appears
  it("1. an eligible current-season FCA Team appears in the picker", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([
      teamSeasonRow({ id: "ts-1", teamId: "team-1", teamName: "FC Allschwil 1. Mannschaft", seasonName: "2026/2027" }),
    ]);

    const rows = await findTeamSeasonsForTenant(TENANT_A);

    expect(rows).toHaveLength(1);
    expect(rows[0].teamName).toBe("FC Allschwil 1. Mannschaft");
  });

  // 2. multiple active Teams appear
  it("2. multiple active Teams all appear in the picker", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([
      teamSeasonRow({ id: "ts-1", teamId: "team-1", teamName: "FC Allschwil 1. Mannschaft", seasonName: "2026/2027" }),
      teamSeasonRow({ id: "ts-2", teamId: "team-2", teamName: "FC Allschwil E1", seasonName: "2026/2027" }),
      teamSeasonRow({ id: "ts-3", teamId: "team-3", teamName: "FC Allschwil Frauen", seasonName: "2026/2027" }),
    ]);

    const rows = await findTeamSeasonsForTenant(TENANT_A);

    expect(rows.map((r) => r.teamName)).toEqual([
      "FC Allschwil 1. Mannschaft",
      "FC Allschwil E1",
      "FC Allschwil Frauen",
    ]);
  });

  // 3. canonical Team.name used after rename
  it("3. reflects the canonical Team.name immediately after a rename (no cached/stale name)", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([
      teamSeasonRow({ id: "ts-1", teamId: "team-1", teamName: "FC Allschwil E1 (renamed)", seasonName: "2026/2027" }),
    ]);

    const rows = await findTeamSeasonsForTenant(TENANT_A);

    expect(rows[0].teamName).toBe("FC Allschwil E1 (renamed)");
  });

  // 4. archived Team excluded
  it("4. archived Team is excluded via team.isActive in the query scope", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);

    await findTeamSeasonsForTenant(TENANT_A);

    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where.team.isActive).toBe(true);
  });

  // 5. restored eligible Team appears
  it("5. a restored Team (isActive flipped back to true) appears again", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([
      teamSeasonRow({ id: "ts-1", teamId: "team-1", teamName: "FC Allschwil D1", seasonName: "2026/2027" }),
    ]);

    const rows = await findTeamSeasonsForTenant(TENANT_A);

    expect(rows).toHaveLength(1);
    expect(rows[0].teamName).toBe("FC Allschwil D1");
  });

  // 6. historical TeamSeason does not leak
  it("6. never falls back to a historical (non-current-season) TeamSeason — season.isActive is required, no substitute", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);

    await findTeamSeasonsForTenant(TENANT_A);

    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where.season).toEqual({ isActive: true });
    expect(callArgs.where.season).not.toHaveProperty("key");
  });

  // 7. cross-tenant Team excluded
  it("7. only queries the requesting tenant — cross-tenant Teams cannot leak in", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);

    await findTeamSeasonsForTenant(TENANT_B);

    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where.team.tenantId).toBe(TENANT_B);
    expect(callArgs.where.team.tenantId).not.toBe(TENANT_A);
  });

  // 8. reproduce/fix current empty-selector regression
  it("8. root-cause fix: syncs Season.isActive from the canonical lifecycle rule before querying, so a stale flag never yields an incorrectly empty picker", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([
      teamSeasonRow({ id: "ts-1", teamId: "team-1", teamName: "FC Allschwil E1", seasonName: "2026/2027" }),
    ]);

    await findTeamSeasonsForTenant(TENANT_A);

    expect(mockSync).toHaveBeenCalledTimes(1);

    // The sync must run BEFORE the TeamSeason query executes — otherwise a
    // stale isActive flag would still be in effect for this exact call.
    const syncOrder = mockSync.mock.invocationCallOrder[0];
    const queryOrder = mockPrisma.teamSeason.findMany.mock.invocationCallOrder[0];
    expect(syncOrder).toBeLessThan(queryOrder);
  });
});

describe("findTeamSeasonPickerRow — edit-mode lookup bypasses season-currency scoping", () => {
  it("looks up a TeamSeason by id and tenant only, without status or season-currency filters", async () => {
    mockPrisma.teamSeason.findFirst.mockResolvedValue(null);

    await findTeamSeasonPickerRow(TENANT_A, "ts-stale");

    const callArgs = mockPrisma.teamSeason.findFirst.mock.calls[0][0];
    expect(callArgs.where).toEqual({
      id: "ts-stale",
      team: { tenantId: TENANT_A },
    });
  });

  it("returns a picker row for a TeamSeason from a prior (non-current) season — required so editing an older TrainingSeries still displays its Team/Saison", async () => {
    mockPrisma.teamSeason.findFirst.mockResolvedValue({
      id: "ts-stale",
      teamId: "team-1",
      team: { name: "FC Allschwil E1" },
      season: { name: "2024/2025" },
      trainerTeamMembers: [
        {
          id: "trainer-1",
          roleLabel: "Cheftrainer",
          person: { firstName: "Max", lastName: "Muster", displayName: null },
        },
      ],
    });

    const row = await findTeamSeasonPickerRow(TENANT_A, "ts-stale");

    expect(row).toEqual({
      id: "ts-stale",
      teamId: "team-1",
      teamName: "FC Allschwil E1",
      seasonName: "2024/2025",
      trainers: [{ id: "trainer-1", name: "Max Muster", roleLabel: "Cheftrainer" }],
    });
  });

  it("returns null when the TeamSeason does not exist or belongs to another tenant", async () => {
    mockPrisma.teamSeason.findFirst.mockResolvedValue(null);

    const row = await findTeamSeasonPickerRow(TENANT_A, "nonexistent");

    expect(row).toBeNull();
  });
});
