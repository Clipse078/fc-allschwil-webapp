import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getEventsListData } from "../queries";

describe("SECURITY-GO-LIVE-01H-C — authenticated event query isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
  });

  it("constrains events and related teams to the active tenant", async () => {
    await getEventsListData("tenant-a");

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-a",
          OR: [
            { teamId: null },
            { team: { tenantId: "tenant-a" } },
          ],
        },
      }),
    );
  });

  it("preserves the event type filter inside the tenant boundary", async () => {
    await getEventsListData("tenant-a", "MATCH");

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          type: "MATCH",
        }),
      }),
    );
  });
});
