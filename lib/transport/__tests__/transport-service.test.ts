/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportStopConfig } from "@/lib/transport/transport-config";
import {
  clearTransportServiceCache,
  fetchTransportForConfig,
} from "@/lib/transport/transport-service";

const CONFIG: TransportStopConfig = {
  enabled: true,
  provider: "opendata.ch",
  stopId: "8578172",
  stationDisplayName: "Allschwil, Im Brüel",
  departureCount: 6,
  refreshIntervalSeconds: 45,
  rotatorIntervalMs: 20_000,
};

const NOW = new Date("2026-09-02T16:40:00.000Z");

function mockFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  }) as unknown as typeof fetch;
}

describe("transport service", () => {
  beforeEach(() => {
    clearTransportServiceCache();
  });

  it("returns normalized departures on success", async () => {
    const fetchFn = mockFetch({
      station: { id: "8578172", name: "Allschwil, Im Brühl" },
      stationboard: [
        {
          category: "B",
          number: "48",
          to: "Basel, Bachgraben",
          stop: { departure: "2026-09-02T18:48:00+0200", delay: 0 },
        },
      ],
    });

    const result = await fetchTransportForConfig(CONFIG, fetchFn, NOW);

    expect(result.isAvailable).toBe(true);
    if (!result.isAvailable) return;
    expect(result.stationDisplayName).toBe("Allschwil, Im Brüel");
    expect(result.departures).toHaveLength(1);
  });

  it("retains cached departures on provider failure", async () => {
    const successFetch = mockFetch({
      station: { id: "8578172", name: "Allschwil, Im Brühl" },
      stationboard: [
        {
          category: "B",
          number: "48",
          to: "Basel, Bachgraben",
          stop: { departure: "2026-09-02T18:48:00+0200", delay: 0 },
        },
      ],
    });

    await fetchTransportForConfig(CONFIG, successFetch, NOW);

    const failingFetch = mockFetch({}, false);
    const result = await fetchTransportForConfig(CONFIG, failingFetch, NOW);

    expect(result.isAvailable).toBe(true);
    if (!result.isAvailable) return;
    expect(result.isStale).toBe(true);
    expect(result.departures).toHaveLength(1);
  });

  it("returns provider_error when no cache exists", async () => {
    const failingFetch = mockFetch({}, false);
    const result = await fetchTransportForConfig(CONFIG, failingFetch, NOW);

    expect(result).toMatchObject({
      isAvailable: false,
      errorCode: "provider_error",
      stationDisplayName: "Allschwil, Im Brüel",
    });
  });
});
