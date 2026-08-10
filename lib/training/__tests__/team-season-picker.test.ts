/**
 * lib/training/__tests__/team-season-picker.test.ts
 *
 * TEAMCENTER-UX-01C — root-cause regression tests for the TrainingCenter
 * "Neue Trainingsserie" team-season picker (findTeamSeasonsForTenant) and
 * its edit-mode counterpart (findTeamSeasonPickerRow).
 *
 * Root cause: findTeamSeasonsForTenant filtered ONLY by
 * `TeamSeason.status === "ACTIVE"`, with no season-currency constraint.
 * Nothing ever flips a TeamSeason's status during a season rollover, so
 * every historical season's TeamSeason for a Team accumulated in this
 * picker forever — a fundamentally different (and staler) selection
 * surface than what the Teams UI treats as canonical/current for the same
 * Team (see lib/teams/current-season.ts). The picker must now additionally
 * scope to the canonical current season.
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

const mockPrisma = prisma as unknown as {
  teamSeason: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const TENANT_A = "tenant-a";

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
      {
        id: "ts-current",
        teamId: "team-1",
        team: { name: "FC Allschwil E1" },
        season: { name: "2026/2027" },
        trainerTeamMembers: [],
      },
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
