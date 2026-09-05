import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  eventFindFirst: vi.fn(),
  eventUpdate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
      update: mocks.eventUpdate,
    },
  },
}));

import { PATCH } from "../route";

const TENANT_A = "tenant-a";
const EVENT_A = "event-a";

function request(visible = true) {
  return new NextRequest("http://localhost/api/infoboard/" + EVENT_A, {
    method: "PATCH",
    body: JSON.stringify({ infoboardVisible: visible }),
  });
}

function context(eventId = EVENT_A) {
  return { params: Promise.resolve({ eventId }) };
}

describe("SECURITY-GO-LIVE-01H-C — InfoBoard event isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-a", activeTenantId: TENANT_A } },
    });
    mocks.eventFindFirst.mockResolvedValue({ id: EVENT_A });
    mocks.eventUpdate.mockResolvedValue({
      id: EVENT_A,
      title: "Tenant A event",
      infoboardVisible: true,
      startAt: new Date("2026-09-05T10:00:00Z"),
      type: "OTHER",
      status: "SCHEDULED",
    });
  });

  it("allows an authorized admin to select an own-tenant event", async () => {
    const response = await PATCH(request(), context());

    expect(response.status).toBe(200);
    expect(mocks.eventFindFirst).toHaveBeenCalledWith({
      where: { id: EVENT_A, tenantId: TENANT_A },
      select: { id: true },
    });
    expect(mocks.eventUpdate).toHaveBeenCalledOnce();
  });

  it("rejects a foreign event before mutation", async () => {
    mocks.eventFindFirst.mockResolvedValue(null);

    const response = await PATCH(request(), context("event-b"));

    expect(response.status).toBe(404);
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });

  it("returns the same safe response for a nonexistent event", async () => {
    mocks.eventFindFirst.mockResolvedValue(null);

    const response = await PATCH(request(), context("missing"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Event nicht gefunden." });
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });

  it("fails closed when no active tenant exists", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-a", activeTenantId: null } },
    });

    const response = await PATCH(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });

  it("preserves the configured InfoBoard permission gate", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const response = await PATCH(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
  });
});
