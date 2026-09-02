/**
 * @vitest-environment node
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  getCanonicalKioskTransport: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: mocks.tenantFindUnique,
    },
  },
}));

vi.mock("@/lib/infoboard/kiosk-transport", () => ({
  getCanonicalKioskTransport: mocks.getCanonicalKioskTransport,
  getKioskTransportRefreshSeconds: () => 45,
}));

import { GET } from "../route";

describe("GET /api/public/infoboard/transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindUnique.mockResolvedValue({
      key: "fc-allschwil",
      status: "ACTIVE",
    });
    mocks.getCanonicalKioskTransport.mockResolvedValue({
      isAvailable: true,
      stationDisplayName: "Allschwil, Im Brüel",
      stationId: "8578172",
      departures: [],
      directionGroups: [],
      fetchedAt: "2026-09-02T16:40:00.000Z",
      isStale: false,
      hasRealtimeData: false,
    });
  });

  it("returns normalized transport payload", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/public/infoboard/transport", {
        headers: { "X-Tenant-Slug": "fc-allschwil" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.isAvailable).toBe(true);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=45");
  });

  it("returns 404 when transport is not configured", async () => {
    mocks.tenantFindUnique.mockResolvedValue({
      key: "other-tenant",
      status: "ACTIVE",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/public/infoboard/transport", {
        headers: { "X-Tenant-Slug": "other-tenant" },
      }),
    );

    expect(response.status).toBe(404);
  });
});
