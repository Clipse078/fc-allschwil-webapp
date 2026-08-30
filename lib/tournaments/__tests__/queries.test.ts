import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { findNextTournamentEventForTeamSeason } from "../queries";

const TENANT_ID = "tenant-a";
const TEAM_SEASON_ID = "team-season-a";
const NOW = new Date("2026-08-30T08:00:00.000Z");

describe("findNextTournamentEventForTeamSeason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the earliest upcoming canonical tournament", async () => {
    const earliest = {
      id: "tournament-earliest",
      startAt: new Date("2026-09-01T08:00:00.000Z"),
    };
    vi.mocked(prisma.event.findFirst).mockResolvedValue(earliest as never);

    await expect(
      findNextTournamentEventForTeamSeason(
        TENANT_ID,
        TEAM_SEASON_ID,
        NOW,
      ),
    ).resolves.toEqual(earliest);

    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("scopes by tenant, TeamSeason, TOURNAMENT type, and TeamSeason ownership", async () => {
    await findNextTournamentEventForTeamSeason(
      TENANT_ID,
      TEAM_SEASON_ID,
      NOW,
    );

    const call = vi.mocked(prisma.event.findFirst).mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      teamSeason: { team: { tenantId: TENANT_ID } },
      type: "TOURNAMENT",
    });
  });

  it("excludes past tournaments at the database boundary", async () => {
    await findNextTournamentEventForTeamSeason(
      TENANT_ID,
      TEAM_SEASON_ID,
      NOW,
    );

    const call = vi.mocked(prisma.event.findFirst).mock.calls[0]![0] as {
      where: { startAt: unknown };
    };
    expect(call.where.startAt).toEqual({ gte: NOW });
  });

  it("applies existing public website visibility and status filters", async () => {
    await findNextTournamentEventForTeamSeason(
      TENANT_ID,
      TEAM_SEASON_ID,
      NOW,
    );

    const call = vi.mocked(prisma.event.findFirst).mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({
      websiteVisible: true,
      status: {
        in: ["SCHEDULED", "LIVE", "COMPLETED", "POSTPONED"],
      },
    });
  });
});
