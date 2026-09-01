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
 * SEASON-01 root-cause fix (STAGE symptom — empty TrainingCenter selector,
 * "no season shown as LÄUFT"): scoping to `Season.isActive` (above)
 * previously depended on a `syncSeasonActiveFlagsWithLifecycle()` side
 * effect that resynced the flag from calendar dates on every call here.
 * That was itself a defect: it could clear every Season's `isActive` flag
 * (when no Season's date range covers "today") or silently override an
 * admin's explicit "Aktuell setzen" choice on an unrelated page load. This
 * picker now reads the persisted flag directly, with no auto-sync — see
 * lib/seasons/mutations.ts#activateSeason(), the only remaining writer of
 * `Season.isActive`. No new fallback to a stale/historical season is
 * introduced (PR #342 protection preserved).
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

import { prisma } from "@/lib/db/prisma";
import { findTeamSeasonsForTenant, findTeamSeasonPickerRow } from "../queries";
import { trainingSeriesTeamSeasonEligibilityWhere } from "../team-season-eligibility";

const mockPrisma = prisma as unknown as {
  teamSeason: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

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
    team: {
      name: overrides.teamName,
      category: "TRAININGSGRUPPE",
      genderGroup: "FRAUEN",
      sortOrder: 10,
    },
    season: { name: overrides.seasonName },
    trainerTeamMembers: overrides.trainerTeamMembers ?? [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findTeamSeasonsForTenant — TEAMCENTER-UX-01C root-cause fix", () => {
  it("scopes the query to the canonical current season and eligibility rule (not TeamSeason.status ACTIVE)", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);

    await findTeamSeasonsForTenant(TENANT_A);

    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual(trainingSeriesTeamSeasonEligibilityWhere(TENANT_A));
  });

  it("still requires an active Team (archived teams excluded)", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);

    await findTeamSeasonsForTenant(TENANT_A);

    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where.team.isActive).toBe(true);
  });

  it("includes competition-less INACTIVE TeamSeason rows (Seniorinnen-style training-only teams)", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([
      teamSeasonRow({
        id: "ts-seniorinnen",
        teamId: "team-seniorinnen",
        teamName: "Seniorinnen",
        seasonName: "2026/2027",
      }),
    ]);

    const rows = await findTeamSeasonsForTenant(TENANT_A);
    expect(rows[0]?.teamName).toBe("Seniorinnen");
    expect(mockPrisma.teamSeason.findMany.mock.calls[0][0].where.NOT).toEqual({ status: "ARCHIVED" });
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
        category: "TRAININGSGRUPPE",
        genderGroup: "FRAUEN",
        sortOrder: 10,
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

  // 8. SEASON-01: no automatic lifecycle side effect on this read path
  it("8. SEASON-01 root-cause fix: never auto-syncs Season.isActive from calendar dates — reads the persisted, explicitly-set flag as-is", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([
      teamSeasonRow({ id: "ts-1", teamId: "team-1", teamName: "FC Allschwil E1", seasonName: "2026/2027" }),
    ]);

    const rows = await findTeamSeasonsForTenant(TENANT_A);

    // No lifecycle-sync side effect exists anymore: the query goes straight
    // to TeamSeason.findMany with season.isActive as the sole scoping
    // condition (asserted in test 6 above) and returns whatever Teams are
    // eligible under the persisted flag — immediately, without depending
    // on visiting the Seasons admin page first.
    expect(mockPrisma.teamSeason.findMany).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
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
      team: { name: "FC Allschwil E1", category: "JUNIOREN", genderGroup: null, sortOrder: 0 },
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
      category: "JUNIOREN",
      genderGroup: null,
      sortOrder: 0,
      trainers: [{ id: "trainer-1", name: "Max Muster", roleLabel: "Cheftrainer" }],
    });
  });

  it("returns null when the TeamSeason does not exist or belongs to another tenant", async () => {
    mockPrisma.teamSeason.findFirst.mockResolvedValue(null);

    const row = await findTeamSeasonPickerRow(TENANT_A, "nonexistent");

    expect(row).toBeNull();
  });
});
