/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Screen2TransportSlide } from "@/components/infoboard/screen2/Screen2TransportSlide";
import type { TransportResult } from "@/lib/transport/transport-types";

const BASE_DEPARTURE = {
  line: "48",
  category: "bus" as const,
  categoryLabel: "BUS",
  destination: "Basel, Bachgraben",
  plannedDeparture: "2026-09-02T18:48:00+0200",
  realtimeDeparture: "2026-09-02T18:51:00+0200",
  delayMinutes: 3,
  platform: null,
  direction: "Basel, Bachgraben",
  provider: "opendata.ch" as const,
  hasRealtime: true,
};

describe("Screen2TransportSlide", () => {
  it("renders line, destination, minutes and delay", () => {
    const transport: TransportResult = {
      isAvailable: true,
      stationDisplayName: "Allschwil, Im Brüel",
      stationId: "8578172",
      departures: [BASE_DEPARTURE],
      fetchedAt: "2026-09-02T16:40:00.000Z",
      isStale: false,
      hasRealtimeData: true,
    };

    render(
      <Screen2TransportSlide
        transport={transport}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
      />,
    );

    expect(screen.getByText("Allschwil, Im Brüel")).toBeTruthy();
    expect(screen.getByText("Live-Abfahrten")).toBeTruthy();
    expect(screen.getByText("48")).toBeTruthy();
    expect(screen.getByText("Basel, Bachgraben")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
  });

  it("renders empty state", () => {
    const transport: TransportResult = {
      isAvailable: true,
      stationDisplayName: "Allschwil, Im Brüel",
      stationId: "8578172",
      departures: [],
      fetchedAt: "2026-09-02T16:40:00.000Z",
      isStale: false,
      hasRealtimeData: false,
    };

    render(
      <Screen2TransportSlide
        transport={transport}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
      />,
    );

    expect(screen.getByTestId("screen2-transport-empty")).toBeTruthy();
  });

  it("renders unavailable state", () => {
    const transport: TransportResult = {
      isAvailable: false,
      stationDisplayName: "Allschwil, Im Brüel",
      errorCode: "provider_error",
      fetchedAt: "2026-09-02T16:40:00.000Z",
    };

    render(
      <Screen2TransportSlide
        transport={transport}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
      />,
    );

    expect(screen.getByTestId("screen2-transport-unavailable")).toBeTruthy();
  });
});
