/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Screen2TransportSlide } from "@/components/infoboard/screen2/Screen2TransportSlide";
import {
  SCREEN2_TRANSPORT_COMPACT_ROW_GAP_PX,
  SCREEN2_TRANSPORT_COMPACT_ROW_HEIGHT_PX,
  SCREEN2_TRANSPORT_COMPACT_ROWS_PER_DIRECTION,
  SCREEN2_TRANSPORT_PANEL_HEIGHT_PX,
} from "@/lib/infoboard/screen2-body-shell-sizing";
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
  nextStopId: "8578171",
  nextStopName: "Allschwil, Kreuzstrasse",
  provider: "opendata.ch",
  hasRealtime: true,
};

function makeDeparture(
  overrides: Partial<TransportDeparture> & Pick<TransportDeparture, "destination" | "plannedDeparture">,
): TransportDeparture {
  return {
    line: "38",
    category: "bus",
    categoryLabel: "BUS",
    realtimeDeparture: overrides.plannedDeparture,
    delayMinutes: null,
    platform: null,
    direction: overrides.destination,
    nextStopId: "8578173",
    nextStopName: "Allschwil, Hagmattstrasse",
    provider: "opendata.ch",
    hasRealtime: false,
    ...overrides,
  };
}

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
        id: "allschwil-zentrum",
        displayName: "Richtung Allschwil Zentrum",
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
  it("renders directional columns with line, destination, minutes and inline delay", () => {
    render(
      <Screen2TransportSlide
        transport={makeTransport()}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
      />,
    );

    expect(screen.getByText("Allschwil, Im Brüel")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-direction-columns")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-direction-allschwil-zentrum")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-direction-bachgraben-basel")).toBeTruthy();
    expect(screen.getByText("← RICHTUNG ALLSCHWIL ZENTRUM")).toBeTruthy();
    expect(screen.getByText("RICHTUNG BACHGRABEN / BASEL →")).toBeTruthy();
    expect(screen.getByText("48")).toBeTruthy();
    expect(screen.getByText("Basel, Bachgraben")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-delay").textContent?.trim()).toBe("+3");
  });

  it("does not render Live-Abfahrten or Aktualisierung verzögert in the normal panel", () => {
    render(
      <Screen2TransportSlide
        transport={makeTransport({ isStale: true, hasRealtimeData: true })}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
        compact
      />,
    );

    expect(screen.queryByText("Live-Abfahrten")).toBeNull();
    expect(screen.queryByText("Abfahrten")).toBeNull();
    expect(screen.queryByText("Aktualisierung verzögert")).toBeNull();
    expect(screen.queryByTestId("screen2-transport-stale")).toBeNull();
    expect(screen.getByTestId("screen2-transport-slide").getAttribute("data-stale")).toBe("true");
  });

  it("formats absolute time without delay suffix when delay is zero", () => {
    const transport = makeTransport({
      directionGroups: [
        {
          id: "bachgraben-basel",
          displayName: "Richtung Bachgraben / Basel",
          orientation: "right",
          departures: [
            {
              ...BASE_DEPARTURE,
              delayMinutes: 0,
              realtimeDeparture: "2026-09-02T18:48:00+0200",
            },
          ],
        },
        {
          id: "allschwil-zentrum",
          displayName: "Richtung Allschwil Zentrum",
          orientation: "left",
          departures: [],
        },
      ],
    });

    render(
      <Screen2TransportSlide
        transport={transport}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
        compact
      />,
    );

    const absoluteTime = screen.getByTestId("screen2-transport-absolute-time");
    expect(absoluteTime.textContent?.trim()).toBe("18:48");
    expect(screen.queryByTestId("screen2-transport-delay")).toBeNull();
  });

  it("formats absolute time with inline +N delay on the same secondary line", () => {
    render(
      <Screen2TransportSlide
        transport={makeTransport()}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
        compact
      />,
    );

    const absoluteTime = screen.getByTestId("screen2-transport-absolute-time");
    expect(absoluteTime.textContent?.replace(/\s+/g, " ").trim()).toBe("18:51 +3");
  });

  it("renders left and right groups in stable positions", () => {
    render(
      <Screen2TransportSlide
        transport={makeTransport()}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
      />,
    );

    const leftColumn = screen.getByTestId("screen2-transport-direction-allschwil-zentrum");
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

    const leftColumn = screen.getByTestId("screen2-transport-direction-allschwil-zentrum");
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

  it("supports compact embedded panel variant with fixed height contract", () => {
    render(
      <Screen2TransportSlide
        transport={makeTransport()}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
        compact
      />,
    );

    const slide = screen.getByTestId("screen2-transport-slide");
    expect(slide.getAttribute("data-compact")).toBe("true");

    const css = readRepoFile("components/infoboard/screen2/Screen2TransportSlide.module.css");
    expect(css).toContain("height: var(--screen2-transport-panel-height)");
    expect(css).toContain("height: var(--screen2-transport-row-height");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain("text-overflow: ellipsis");
  });

  it("renders max three departures per direction column without cross-column spill", () => {
    const leftDepartures = [
      makeDeparture({
        line: "38",
        destination: "Allschwil, Friedhof",
        plannedDeparture: "2026-09-02T18:49:00+0200",
      }),
      makeDeparture({
        line: "49",
        destination: "Oberwil BL, Hüslimatt",
        plannedDeparture: "2026-09-02T18:56:00+0200",
      }),
      makeDeparture({
        line: "48",
        destination: "Basel, Bahnhof SBB",
        plannedDeparture: "2026-09-02T19:01:00+0200",
      }),
      makeDeparture({
        line: "11",
        destination: "Should Not Render",
        plannedDeparture: "2026-09-02T19:10:00+0200",
      }),
    ];

    const rightDepartures = [
      makeDeparture({
        line: "48",
        destination: "Basel, Bachgraben",
        plannedDeparture: "2026-09-02T18:52:00+0200",
        nextStopName: "Allschwil, Kreuzstrasse",
        nextStopId: "8578171",
      }),
      makeDeparture({
        line: "38",
        destination: "Basel, Claraplatz",
        plannedDeparture: "2026-09-02T18:58:00+0200",
        nextStopName: "Allschwil, Kreuzstrasse",
        nextStopId: "8578171",
      }),
      makeDeparture({
        line: "11",
        destination: "Basel, Aeschenplatz",
        plannedDeparture: "2026-09-02T19:02:00+0200",
        nextStopName: "Allschwil, Kreuzstrasse",
        nextStopId: "8578171",
      }),
      makeDeparture({
        line: "99",
        destination: "Should Not Render Right",
        plannedDeparture: "2026-09-02T19:15:00+0200",
        nextStopName: "Allschwil, Kreuzstrasse",
        nextStopId: "8578171",
      }),
    ];

    render(
      <Screen2TransportSlide
        transport={makeTransport({
          directionGroups: [
            {
              id: "allschwil-zentrum",
              displayName: "Richtung Allschwil Zentrum",
              orientation: "left",
              departures: leftDepartures.slice(0, SCREEN2_TRANSPORT_COMPACT_ROWS_PER_DIRECTION),
            },
            {
              id: "bachgraben-basel",
              displayName: "Richtung Bachgraben / Basel",
              orientation: "right",
              departures: rightDepartures.slice(0, SCREEN2_TRANSPORT_COMPACT_ROWS_PER_DIRECTION),
            },
          ],
        })}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
        compact
      />,
    );

    const leftRows = within(screen.getByTestId("screen2-transport-direction-allschwil-zentrum")).getAllByTestId(
      "screen2-transport-row",
    );
    const rightRows = within(screen.getByTestId("screen2-transport-direction-bachgraben-basel")).getAllByTestId(
      "screen2-transport-row",
    );

    expect(leftRows).toHaveLength(3);
    expect(rightRows).toHaveLength(3);
    expect(screen.queryByText("Should Not Render")).toBeNull();
    expect(screen.queryByText("Should Not Render Right")).toBeNull();
  });

  it("keeps long destination text on one line without extra row height", () => {
    const longDestination =
      "Basel, Bachgraben mit einem sehr langen Zielnamen der nicht umbrechen darf";

    render(
      <Screen2TransportSlide
        transport={makeTransport({
          directionGroups: [
            {
              id: "allschwil-zentrum",
              displayName: "Richtung Allschwil Zentrum",
              orientation: "left",
              departures: [],
            },
            {
              id: "bachgraben-basel",
              displayName: "Richtung Bachgraben / Basel",
              orientation: "right",
              departures: [
                {
                  ...BASE_DEPARTURE,
                  destination: longDestination,
                  delayMinutes: 2,
                },
              ],
            },
          ],
        })}
        timezone="Europe/Zurich"
        nowIso="2026-09-02T16:40:00.000Z"
        compact
      />,
    );

    const row = screen.getByTestId("screen2-transport-row");
    expect(row.textContent).toContain(longDestination);
    expect(readRepoFile("components/infoboard/screen2/Screen2TransportSlide.module.css")).toMatch(
      /\.compact \.row[\s\S]*max-height: var\(--screen2-transport-row-height/,
    );
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

describe("Screen2TransportSlide UX4 sizing contract", () => {
  it("defines deterministic compact panel and row geometry for 1920x1080", () => {
    expect(SCREEN2_TRANSPORT_PANEL_HEIGHT_PX).toBeGreaterThan(0);
    expect(SCREEN2_TRANSPORT_COMPACT_ROW_HEIGHT_PX).toBe(36);
    expect(SCREEN2_TRANSPORT_COMPACT_ROW_GAP_PX).toBe(3);
    expect(SCREEN2_TRANSPORT_COMPACT_ROWS_PER_DIRECTION).toBe(3);

    const centerStackCss = readRepoFile("components/infoboard/screen2/Screen2CenterStack.module.css");
    expect(centerStackCss).toContain("var(--screen2-transport-panel-height)");
  });
});

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
