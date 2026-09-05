import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  eventFindMany: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: mocks.eventFindMany },
  },
}));

import { GET } from "../route";

describe("SECURITY-GO-LIVE-01H-C — authenticated Event reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-a", activeTenantId: "tenant-a" } },
    });
    mocks.eventFindMany.mockResolvedValue([{ id: "event-a", title: "A" }]);
  });

  it("returns permitted events from the active tenant", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: "event-a", title: "A" }]);
  });

  it("scopes the database read to Event and related Team ownership", async () => {
    await GET();

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
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

  it("cannot return a Tenant B Event for a Tenant A request", async () => {
    mocks.eventFindMany.mockResolvedValue([]);

    const response = await GET();

    await expect(response.json()).resolves.toEqual([]);
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
    );
  });

  it("fails closed when authenticated permission has no active tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-a", activeTenantId: null } },
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });
});
