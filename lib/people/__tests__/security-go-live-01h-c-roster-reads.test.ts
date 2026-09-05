import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    playerSquadMember: { findMany: vi.fn() },
    trainerTeamMember: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  getPersonSquadMemberships,
  getPersonTrainerMemberships,
} from "../queries";

describe("SECURITY-GO-LIVE-01H-C — person roster read isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.playerSquadMember.findMany).mockResolvedValue([]);
    vi.mocked(prisma.trainerTeamMember.findMany).mockResolvedValue([]);
  });

  it("requires both player and team season ownership by the active tenant", async () => {
    await getPersonSquadMemberships("person-a", "tenant-a");

    expect(prisma.playerSquadMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          personId: "person-a",
          person: { tenantId: "tenant-a" },
          teamSeason: { team: { tenantId: "tenant-a" } },
        },
      }),
    );
  });

  it("requires both trainer and team season ownership by the active tenant", async () => {
    await getPersonTrainerMemberships("person-a", "tenant-a");

    expect(prisma.trainerTeamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          personId: "person-a",
          person: { tenantId: "tenant-a" },
          teamSeason: { team: { tenantId: "tenant-a" } },
        },
      }),
    );
  });
});
