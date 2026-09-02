/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Screen2TransportSlide } from "@/components/infoboard/screen2/Screen2TransportSlide";
import type { TransportDeparture, TransportResult } from "@/lib/transport/transport-types";

const BASE_DEPARTURE: TransportDeparture = {
  line: "48",
  category: "bus",
  categoryLabel: "BUS",
  destination: "Basel, Bachgraben",
  plannedDeparture: "2026-09-02T18:48:00+0200",
  realtimeDeparture: "2026-09-02T18:51:00+0200",
  delayMinutes: 3,
  platform: null,
  direction: "Basel, Bachgraben",
  provider: "opendata.ch",
  hasRealtime: true,
};

function makeTransport(
  overrides: Partial<Extract<TransportResult, { isAvailable: true }>> = {},
): TransportResult {
  return {
    isAvailable: true,
    stationDisplayName: "Allschwil, Im Brüel",
    stationId: "8578172",
    departures: [BASE_DEPARTURE],
    directionGroups: [
      {
        id: "allschwil-dorf",
        displayName: "Richtung Allschwil Dorf",
        orientation: "left",
        departures: [],
      },
      {
        id: "bachgraben-basel",
        displayName: "Richtung Bachgraben / Basel",
        orientation: "right",
        departures: [BASE_DEPARTURE],
      },
    ],
    fetchedAt: "2026-09-02T16:40:00.000Z",
    isStale: false,
    hasRealtimeData: true,
    ...overrides,
  };
}

describe("Screen2TransportSlide", () => {
  it("renders directional columns with line, destination, minutes and delay", () => {
    render(
      <Screen2TransportSlide
        transport={makeTransport()}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
      />,
    );

    expect(screen.getByText("Allschwil, Im Brüel")).toBeTruthy();
    expect(screen.getByText("Live-Abfahrten")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-direction-columns")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-direction-allschwil-dorf")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-direction-bachgraben-basel")).toBeTruthy();
    expect(screen.getByText("← RICHTUNG ALLSCHWIL DORF")).toBeTruthy();
    expect(screen.getByText("RICHTUNG BACHGRABEN / BASEL →")).toBeTruthy();
    expect(screen.getByText("48")).toBeTruthy();
    expect(screen.getByText("Basel, Bachgraben")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
  });

  it("renders left and right groups in stable positions", () => {
    render(
      <Screen2TransportSlide
        transport={makeTransport()}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
      />,
    );

    const leftColumn = screen.getByTestId("screen2-transport-direction-allschwil-dorf");
    const rightColumn = screen.getByTestId("screen2-transport-direction-bachgraben-basel");
    expect(leftColumn.getAttribute("data-orientation")).toBe("left");
    expect(rightColumn.getAttribute("data-orientation")).toBe("right");
  });

  it("shows per-direction empty state without borrowing departures", () => {
    render(
      <Screen2TransportSlide
        transport={makeTransport()}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
      />,
    );

    const leftColumn = screen.getByTestId("screen2-transport-direction-allschwil-dorf");
    expect(leftColumn.querySelector('[data-testid="screen2-transport-direction-empty"]')).toBeTruthy();
    expect(leftColumn.textContent).toContain("Keine nächsten Verbindungen");
    expect(screen.getByTestId("screen2-transport-direction-bachgraben-basel").textContent).toContain(
      "Basel, Bachgraben",
    );
  });

  it("does not implement destination matching in the component", () => {
    const source = readRepoFile("components/infoboard/screen2/Screen2TransportSlide.tsx");
    expect(source).not.toMatch(/destination\.includes/i);
    expect(source).not.toMatch(/direction\.includes/i);
    expect(source).toContain("directionGroups");
  });

  it("renders global empty state when no direction groups are configured", () => {
    const transport: TransportResult = {
      isAvailable: true,
      stationDisplayName: "Allschwil, Im Brüel",
      stationId: "8578172",
      departures: [],
      directionGroups: [],
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

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
