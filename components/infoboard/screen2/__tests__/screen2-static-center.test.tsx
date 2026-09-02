/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-TRANSPORT-02-UX3 — static center layout focused tests.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { PREVIEW_FIXTURE } from "@/components/infoboard/screen1/screen1-preview-fixture";
import { Screen2CenterStack } from "@/components/infoboard/screen2/Screen2CenterStack";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import {
  SCREEN2_ANLAGEPLAN_MAP_DIMENSIONS,
  SCREEN2_BODY_SHELL_MEASUREMENT_CONTRACT,
  SCREEN2_CENTER_HEIGHT_PX,
  SCREEN2_CENTER_WIDTH_PX,
  SCREEN2_TRANSPORT_PANEL_HEIGHT_PX,
  computeAnlageplanMapDimensions,
} from "@/lib/infoboard/screen2-body-shell-sizing";
import type { TransportResult } from "@/lib/transport/transport-types";

const REPO_ROOT = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

function makeAnlageplanPayload(): AnlageplanLivePayload {
  return {
    screen2: {
      feed: {
        generatedAt: "2026-09-01T10:00:00.000Z",
        tenant: {
          id: "tenant-fca",
          key: "fc-allschwil",
          name: "FC Allschwil",
          timezone: "Europe/Zurich",
        },
        displayDate: "2026-09-01",
        isStale: false,
        facilityName: "Sportanlage",
        pitches: [],
        dressingRooms: [],
        unallocated: [],
      },
      branding: { clubLogoSrc: null, productLogoSrc: null },
      currentTimeIso: "2026-09-01T10:00:00.000Z",
      theme: "DARK",
    },
    anlageplanConfig: {
      version: 1,
      elements: [],
      backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    },
    backgroundUrl: null,
    backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    currentTimeIso: "2026-09-01T10:00:00.000Z",
  };
}

const TRANSPORT: TransportResult = {
  isAvailable: true,
  stationDisplayName: "Allschwil, Im Brüel",
  stationId: "8578172",
  departures: [
    {
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
    },
  ],
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
        },
      ],
    },
  ],
  fetchedAt: "2026-09-02T16:40:00.000Z",
  isStale: false,
  hasRealtimeData: true,
};

vi.mock("@/components/infoboard/kiosk-transport", () => ({
  useKioskTransport: (initial: TransportResult | null) => initial,
}));

describe("INFOBOARD-TRANSPORT-02-UX3 — static center layout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders Sportanlage and ÖV panel permanently when transport is configured", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        tenantKey="fc-allschwil"
        transport={TRANSPORT}
      />,
    );

    expect(screen.getByTestId("anlageplan-slide")).toBeTruthy();
    expect(screen.getByTestId("anlageplan-map-canvas")).toBeTruthy();
    expect(screen.getByTestId("screen2-center-stack")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-panel")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-slide")).toBeTruthy();
  });

  it("does not render lower center sponsor placeholder", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        tenantKey="fc-allschwil"
        transport={TRANSPORT}
      />,
    );

    expect(screen.queryByTestId("screen2-lower-sponsor-zone")).toBeNull();
  });

  it("keeps left and right sponsor rails present", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        tenantKey="fc-allschwil"
        transport={TRANSPORT}
      />,
    );

    expect(screen.getByTestId("screen2-sponsor-rail-left")).toBeTruthy();
    expect(screen.getByTestId("screen2-sponsor-rail-right")).toBeTruthy();
  });

  it("keeps header and footer present", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        tenantKey="fc-allschwil"
        transport={TRANSPORT}
      />,
    );

    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("does not rotate center content after 60 seconds", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        tenantKey="fc-allschwil"
        transport={TRANSPORT}
        liveClock={false}
      />,
    );

    expect(screen.getByTestId("anlageplan-map-canvas")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-slide")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId("anlageplan-map-canvas")).toBeTruthy();
    expect(screen.getByTestId("screen2-transport-slide")).toBeTruthy();
    expect(screen.queryByTestId("screen2-center-rotator")).toBeNull();
  });

  it("places ÖV panel below the map inside center content", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        tenantKey="fc-allschwil"
        transport={TRANSPORT}
      />,
    );

    const center = screen.getByTestId("screen2-center-content");
    const stack = screen.getByTestId("screen2-center-stack");
    const slide = screen.getByTestId("anlageplan-slide");
    const canvas = screen.getByTestId("anlageplan-map-canvas");
    const transportPanel = screen.getByTestId("screen2-transport-panel");

    expect(center.contains(stack)).toBe(true);
    expect(stack.contains(slide)).toBe(true);
    expect(stack.contains(transportPanel)).toBe(true);
    expect(slide.contains(canvas)).toBe(true);
    expect(canvas.compareDocumentPosition(transportPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Anlageplan dimensions/fit contract unchanged", () => {
    const mapDimensions = computeAnlageplanMapDimensions(
      SCREEN2_CENTER_WIDTH_PX,
      SCREEN2_CENTER_HEIGHT_PX,
    );

    expect(SCREEN2_BODY_SHELL_MEASUREMENT_CONTRACT.anlageplanMapWidthPx).toBe(
      mapDimensions.widthPx,
    );
    expect(SCREEN2_BODY_SHELL_MEASUREMENT_CONTRACT.anlageplanMapHeightPx).toBe(
      mapDimensions.heightPx,
    );
    expect(SCREEN2_ANLAGEPLAN_MAP_DIMENSIONS.widthPx).toBe(mapDimensions.widthPx);
    expect(SCREEN2_ANLAGEPLAN_MAP_DIMENSIONS.heightPx).toBe(mapDimensions.heightPx);
    expect(SCREEN2_TRANSPORT_PANEL_HEIGHT_PX).toBe(
      SCREEN2_CENTER_HEIGHT_PX - mapDimensions.heightPx,
    );

    const anlageplanCss = readRepoFile(
      "components/infoboard/anlageplan/InfoboardAnlageplan.module.css",
    );
    expect(anlageplanCss).toContain("aspect-ratio: 16 / 9");
    expect(anlageplanCss).toContain("width: min(100cqw, calc(100cqh * 16 / 9))");
    expect(anlageplanCss).toContain("height: min(100cqh, calc(100cqw * 9 / 16))");
  });

  it("Screen2BodyShell geometry unchanged", () => {
    const shellCss = readRepoFile("components/infoboard/screen2/Screen2BodyShell.module.css");
    const shellTs = readRepoFile("components/infoboard/screen2/Screen2BodyShell.tsx");
    const sizing = readRepoFile("lib/infoboard/screen2-body-shell-sizing.ts");

    expect(shellCss).toContain("grid-template-columns:");
    expect(shellCss).toContain("var(--screen2-sponsor-rail-width)");
    expect(shellCss).toContain("var(--screen2-center-width)");
    expect(shellTs).not.toContain("Screen2LowerSponsorZone");
    expect(sizing).toContain("SCREEN2_SPONSOR_RAIL_SHARE = 0.19");
    expect(sizing).toContain("SCREEN2_CENTER_SHARE = 0.62");
  });

  it("Screen 1 unaffected", () => {
    const screen1 = readRepoFile("components/infoboard/screen1/InfoboardScreen1.tsx");
    expect(screen1).not.toContain("Screen2CenterStack");
    expect(screen1).not.toContain("Screen2TransportSlide");

    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} liveClock={false} />);

    expect(screen.queryByTestId("screen2-transport-slide")).toBeNull();
    expect(screen.getByTestId("infoboard-screen1-root")).toBeTruthy();
  });

  it("Screen2CenterStack keeps map and transport mounted together", () => {
    render(
      <Screen2CenterStack
        tenantKey="fc-allschwil"
        timezone="Europe/Zurich"
        initialTransport={TRANSPORT}
        refreshIntervalSeconds={45}
        live={false}
      >
        <div data-testid="anlageplan-child">Anlageplan</div>
      </Screen2CenterStack>,
    );

    const stack = screen.getByTestId("screen2-center-stack");
    expect(stack.contains(screen.getByTestId("anlageplan-child"))).toBe(true);
    expect(stack.contains(screen.getByTestId("screen2-transport-slide"))).toBe(true);
    expect(screen.getByTestId("screen2-transport-slide").getAttribute("data-compact")).toBe("true");
  });

  it("does not retain center rotator implementation", () => {
    expect(() => readRepoFile("components/infoboard/screen2/Screen2CenterRotator.tsx")).toThrow();
    const anlageplan = readRepoFile("components/infoboard/anlageplan/InfoboardAnlageplan.tsx");
    expect(anlageplan).not.toContain("Screen2CenterRotator");
    expect(anlageplan).toContain("Screen2CenterStack");
  });
});
