/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchTransportForConfig: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

vi.mock("@/lib/transport/transport-service", () => ({
  fetchTransportForConfig: mocks.fetchTransportForConfig,
}));

import { getCanonicalKioskTransport } from "@/lib/infoboard/kiosk-transport";

describe("getCanonicalKioskTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchTransportForConfig.mockResolvedValue({
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

  it("returns null for tenants without transport configuration", async () => {
    const result = await getCanonicalKioskTransport("unknown-tenant");
    expect(result).toBeNull();
    expect(mocks.fetchTransportForConfig).not.toHaveBeenCalled();
  });

  it("delegates to fetchTransportForConfig for configured tenants", async () => {
    const result = await getCanonicalKioskTransport("fc-allschwil");

    expect(mocks.fetchTransportForConfig).toHaveBeenCalledTimes(1);
    expect(result?.isAvailable).toBe(true);
  });
});
