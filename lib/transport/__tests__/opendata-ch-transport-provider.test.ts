/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import {
  normalizeOpendataStationboard,
} from "@/lib/transport/providers/opendata-ch-transport-provider";
import type { TransportStopConfig } from "@/lib/transport/transport-config";

const BASE_CONFIG: TransportStopConfig = {
  enabled: true,
  provider: "opendata.ch",
  stopId: "8578172",
  stationDisplayName: "Allschwil, Im Brüel",
  departureCount: 8,
  refreshIntervalSeconds: 45,
};

const NOW = new Date("2026-09-02T16:40:00.000Z");

function makePayload(entries: unknown[]) {
  return {
    station: { id: "8578172", name: "Allschwil, Im Brühl" },
    stationboard: entries,
  };
}

describe("opendata.ch transport provider normalization", () => {
  it("normalizes planned and realtime departures with positive delay", () => {
    const result = normalizeOpendataStationboard(
      makePayload([
        {
          category: "B",
          number: "48",
          to: "Basel, Bachgraben",
          stop: {
            departure: "2026-09-02T18:48:00+0200",
            delay: 3,
            prognosis: { departure: "2026-09-02T18:51:00+0200" },
          },
        },
      ]),
      BASE_CONFIG,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.departures[0]).toMatchObject({
      line: "48",
      category: "bus",
      destination: "Basel, Bachgraben",
      plannedDeparture: "2026-09-02T18:48:00+0200",
      realtimeDeparture: "2026-09-02T18:51:00+0200",
      delayMinutes: 3,
      hasRealtime: true,
    });
  });

  it("extracts next-stop topology from passList", () => {
    const result = normalizeOpendataStationboard(
      makePayload([
        {
          category: "B",
          number: "48",
          to: "Basel, Bachgraben",
          stop: {
            departure: "2026-09-02T18:48:00+0200",
            delay: 0,
          },
          passList: [
            { station: { id: "8578172", name: "Allschwil, Im Brühl" } },
            { station: { id: "8578171", name: "Allschwil, Kreuzstrasse" } },
          ],
        },
      ]),
      BASE_CONFIG,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.departures[0]).toMatchObject({
      nextStopId: "8578171",
      nextStopName: "Allschwil, Kreuzstrasse",
    });
  });

  it("handles zero delay and missing realtime data", () => {
    const result = normalizeOpendataStationboard(
      makePayload([
        {
          category: "B",
          number: "38",
          to: "Allschwil, Friedhof",
          stop: {
            departure: "2026-09-02T18:49:00+0200",
            delay: 0,
          },
        },
      ]),
      BASE_CONFIG,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.departures[0]).toMatchObject({
      line: "38",
      delayMinutes: 0,
      hasRealtime: true,
    });
  });

  it("sorts departures chronologically and keeps both directions", () => {
    const result = normalizeOpendataStationboard(
      makePayload([
        {
          category: "B",
          number: "49",
          to: "Therwil, Lindenfeld",
          stop: { departure: "2026-09-02T18:54:00+0200", delay: 0 },
        },
        {
          category: "B",
          number: "38",
          to: "Allschwil, Friedhof",
          stop: { departure: "2026-09-02T18:49:00+0200", delay: 0 },
        },
        {
          category: "B",
          number: "48",
          to: "Basel, Bachgraben",
          stop: { departure: "2026-09-02T18:52:00+0200", delay: 0 },
        },
      ]),
      BASE_CONFIG,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.departures.map((departure) => departure.destination)).toEqual([
      "Allschwil, Friedhof",
      "Basel, Bachgraben",
      "Therwil, Lindenfeld",
    ]);
  });

  it("returns malformed_response for invalid payloads", () => {
    const result = normalizeOpendataStationboard(null, BASE_CONFIG, NOW);
    expect(result).toEqual({ ok: false, errorCode: "malformed_response" });
  });
});
