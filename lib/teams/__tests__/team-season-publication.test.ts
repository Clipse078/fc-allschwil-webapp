import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { updateTeamSeasonPublication } from "../team-season-service";

const findUnique = vi.mocked(prisma.teamSeason.findUnique);
const update = vi.mocked(prisma.teamSeason.update);

function teamSeason(
  overrides: Partial<{
    teamId: string;
    tenantId: string;
    showNextMatch: boolean;
    showNextTournament: boolean;
  }> = {},
) {
  return {
    teamId: overrides.teamId ?? "team-a",
    showNextMatch: overrides.showNextMatch ?? true,
    showNextTournament: overrides.showNextTournament ?? false,
    team: { tenantId: overrides.tenantId ?? "tenant-a" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(teamSeason() as never);
  update.mockImplementation(async (args) => ({
    showNextMatch:
      (args.data as { showNextMatch?: boolean }).showNextMatch ?? true,
    showNextTournament:
      (args.data as { showNextTournament?: boolean }).showNextTournament ??
      false,
  }) as never);
});

describe("updateTeamSeasonPublication", () => {
  it("persists showNextMatch independently and leaves unrelated fields untouched", async () => {
    const result = await updateTeamSeasonPublication({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-a",
      showNextMatch: false,
    });

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "season-a" },
      data: { showNextMatch: false },
      select: {
        showNextMatch: true,
        showNextTournament: true,
      },
    });
  });

  it("persists showNextTournament independently", async () => {
    await updateTeamSeasonPublication({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-a",
      showNextTournament: true,
    });

    expect(update.mock.calls[0]?.[0].data).toEqual({
      showNextTournament: true,
    });
  });

  it("updates only the addressed TeamSeason, so A cannot affect B", async () => {
    await updateTeamSeasonPublication({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-a",
      showNextMatch: false,
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0].where).toEqual({ id: "season-a" });
  });

  it("allows different seasons of the same Team to persist different values", async () => {
    await updateTeamSeasonPublication({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-a",
      showNextMatch: false,
    });
    findUnique.mockResolvedValueOnce(
      teamSeason({ showNextMatch: false }) as never,
    );
    await updateTeamSeasonPublication({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-b",
      showNextTournament: true,
    });

    expect(update.mock.calls.map(([args]) => args.where)).toEqual([
      { id: "season-a" },
      { id: "season-b" },
    ]);
    expect(update.mock.calls.map(([args]) => args.data)).toEqual([
      { showNextMatch: false },
      { showNextTournament: true },
    ]);
  });

  it("rejects a TeamSeason belonging to another tenant", async () => {
    findUnique.mockResolvedValueOnce(
      teamSeason({ tenantId: "tenant-b" }) as never,
    );

    const result = await updateTeamSeasonPublication({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-a",
      showNextMatch: false,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "TEAM_SEASON_TENANT_MISMATCH",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a mismatched teamId/teamSeasonId pair", async () => {
    findUnique.mockResolvedValueOnce(teamSeason({ teamId: "team-b" }) as never);

    const result = await updateTeamSeasonPublication({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-b",
      showNextTournament: true,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
