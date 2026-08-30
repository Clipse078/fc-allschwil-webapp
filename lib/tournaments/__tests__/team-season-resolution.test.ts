import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { TournamentValidationError } from "../errors";
import { resolveTournamentTeamSeasonId } from "../team-season-resolution";

const TENANT_ID = "tenant-a";
const TEAM_ID = "team-a";
const SEASON_ID = "season-a";

describe("resolveTournamentTeamSeasonId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.teamSeason.findMany).mockResolvedValue([
      { id: "team-season-a" },
    ] as never);
  });

  it("resolves only the exact tenant-owned team and season tuple", async () => {
    await expect(
      resolveTournamentTeamSeasonId(TENANT_ID, TEAM_ID, SEASON_ID),
    ).resolves.toBe("team-season-a");

    expect(prisma.teamSeason.findMany).toHaveBeenCalledWith({
      where: {
        teamId: TEAM_ID,
        seasonId: SEASON_ID,
        team: { tenantId: TENANT_ID },
      },
      select: { id: true },
      take: 2,
    });
  });

  it("rejects a cross-tenant TeamSeason assignment", async () => {
    vi.mocked(prisma.teamSeason.findMany).mockResolvedValue([] as never);

    await expect(
      resolveTournamentTeamSeasonId(TENANT_ID, "other-tenant-team", SEASON_ID),
    ).rejects.toThrow(TournamentValidationError);
  });

  it("rejects a team/season mismatch", async () => {
    vi.mocked(prisma.teamSeason.findMany).mockResolvedValue([] as never);

    await expect(
      resolveTournamentTeamSeasonId(TENANT_ID, TEAM_ID, "wrong-season"),
    ).rejects.toThrow(/matches the selected team and season/);
  });

  it("fails closed if multiple candidates are returned", async () => {
    vi.mocked(prisma.teamSeason.findMany).mockResolvedValue([
      { id: "team-season-a" },
      { id: "team-season-duplicate" },
    ] as never);

    await expect(
      resolveTournamentTeamSeasonId(TENANT_ID, TEAM_ID, SEASON_ID),
    ).rejects.toThrow(/Multiple TeamSeason/);
  });

  it("rejects a team assignment when the tournament has no season", async () => {
    await expect(
      resolveTournamentTeamSeasonId(TENANT_ID, TEAM_ID, null),
    ).rejects.toThrow(/requires a season/);
    expect(prisma.teamSeason.findMany).not.toHaveBeenCalled();
  });
});
