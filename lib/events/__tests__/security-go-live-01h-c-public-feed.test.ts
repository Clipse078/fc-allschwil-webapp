import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindMany: vi.fn(),
  allocationDisplay: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { event: { findMany: mocks.eventFindMany } },
}));
vi.mock("@/lib/facilities/display-helpers", () => ({
  batchGetEventAllocationDisplayForTenant: mocks.allocationDisplay,
}));

import { getPublicEvents } from "../public-event-feed";

describe("SECURITY-GO-LIVE-01H-C — public Event tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.allocationDisplay.mockResolvedValue([]);
  });

  it("fails closed without a resolved public tenant", async () => {
    await expect(getPublicEvents({ surface: "infoboard" })).resolves.toEqual([]);
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });

  it("constrains public InfoBoard events and related Teams to one tenant", async () => {
    await getPublicEvents({ surface: "infoboard", tenantId: "tenant-a" });

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          AND: [
            {
              OR: [
                { teamId: null },
                { team: { tenantId: "tenant-a" } },
              ],
            },
          ],
        }),
      }),
    );
  });

  it("binds a manipulated team slug to the resolved tenant", async () => {
    await getPublicEvents({
      surface: "infoboard",
      tenantId: "tenant-a",
      teamSlug: "tenant-b-team",
    });

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          team: { slug: "tenant-b-team", tenantId: "tenant-a" },
        }),
      }),
    );
  });

  it("preserves InfoBoard publication and status predicates", async () => {
    await getPublicEvents({ surface: "infoboard", tenantId: "tenant-a" });

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          infoboardVisible: true,
          status: { in: ["SCHEDULED", "LIVE", "COMPLETED", "POSTPONED"] },
        }),
      }),
    );
  });
});
