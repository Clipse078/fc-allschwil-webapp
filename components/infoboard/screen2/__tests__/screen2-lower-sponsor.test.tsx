/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-TRANSPORT-02-UX1 — lower center sponsor zone focused tests.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { PREVIEW_FIXTURE } from "@/components/infoboard/screen1/screen1-preview-fixture";
import { Screen2CenterRotator } from "@/components/infoboard/screen2/Screen2CenterRotator";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import {
  SCREEN2_ANLAGEPLAN_MAP_DIMENSIONS,
  SCREEN2_BODY_SHELL_MEASUREMENT_CONTRACT,
  SCREEN2_CENTER_HEIGHT_PX,
  SCREEN2_CENTER_WIDTH_PX,
  SCREEN2_LOWER_SPONSOR_ZONE_HEIGHT_PX,
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
      provider: "opendata.ch",
      hasRealtime: true,
    },
  ],
  fetchedAt: "2026-09-02T16:40:00.000Z",
  isStale: false,
  hasRealtimeData: true,
};

vi.mock("@/components/infoboard/kiosk-transport", () => ({
  useKioskTransport: (initial: TransportResult | null) => initial,
}));

describe("INFOBOARD-TRANSPORT-02-UX1 — lower center sponsor zone", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. Anlageplan slide renders lower sponsor placeholder", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
      />,
    );

    expect(screen.getByTestId("anlageplan-slide")).toBeTruthy();
    expect(screen.getByTestId("screen2-lower-sponsor-zone")).toBeTruthy();
  });

  it("2. lower sponsor text contains IHRE WERBUNG, HIER, SPONSOR", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
      />,
    );

    const lowerSponsor = screen.getByTestId("screen2-lower-sponsor-zone");
    expect(lowerSponsor.textContent).toContain("IHRE WERBUNG");
    expect(lowerSponsor.textContent).toContain("HIER");
    expect(lowerSponsor.textContent).toContain("SPONSOR");
  });

  it("3. left sponsor remains present", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
      />,
    );

    expect(screen.getByTestId("screen2-sponsor-rail-left")).toBeTruthy();
  });

  it("4. right sponsor remains present", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
      />,
    );

    expect(screen.getByTestId("screen2-sponsor-rail-right")).toBeTruthy();
  });

  it("5. transport slide does not render lower sponsor placeholder", () => {
    render(
      <Screen2CenterRotator
        tenantKey="fc-allschwil"
        timezone="Europe/Zurich"
        initialTransport={TRANSPORT}
        refreshIntervalSeconds={45}
        activeSlide="transport"
        autoRotate={false}
        live={false}
      >
        <div data-testid="anlageplan-child">Anlageplan</div>
      </Screen2CenterRotator>,
    );

    expect(screen.getByTestId("screen2-transport-slide")).toBeTruthy();
    expect(screen.queryByTestId("screen2-lower-sponsor-zone")).toBeNull();
  });

  it("6. transport continues to use full center slide", () => {
    const transportCss = readRepoFile(
      "components/infoboard/screen2/Screen2TransportSlide.module.css",
    );
    const rotatorCss = readRepoFile(
      "components/infoboard/screen2/Screen2CenterRotator.module.css",
    );

    expect(transportCss).toMatch(/width:\s*100%/);
    expect(transportCss).toMatch(/height:\s*100%/);
    expect(rotatorCss).toContain("inset: 0");

    render(
      <Screen2CenterRotator
        tenantKey="fc-allschwil"
        timezone="Europe/Zurich"
        initialTransport={TRANSPORT}
        refreshIntervalSeconds={45}
        activeSlide="transport"
        autoRotate={false}
        live={false}
      >
        <div data-testid="anlageplan-child">Anlageplan</div>
      </Screen2CenterRotator>,
    );

    const transportSlide = screen.getByTestId("screen2-center-slide-transport");
    expect(transportSlide.contains(screen.getByTestId("screen2-transport-slide"))).toBe(true);
    expect(transportSlide.contains(screen.getByTestId("anlageplan-child"))).toBe(false);
  });

  it("7. Anlageplan dimensions/fit contract unchanged", () => {
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
    expect(SCREEN2_LOWER_SPONSOR_ZONE_HEIGHT_PX).toBe(
      SCREEN2_CENTER_HEIGHT_PX - mapDimensions.heightPx,
    );

    const anlageplanCss = readRepoFile(
      "components/infoboard/anlageplan/InfoboardAnlageplan.module.css",
    );
    expect(anlageplanCss).toContain("aspect-ratio: 16 / 9");
    expect(anlageplanCss).toContain("width: min(100cqw, calc(100cqh * 16 / 9))");
    expect(anlageplanCss).toContain("height: min(100cqh, calc(100cqw * 9 / 16))");
  });

  it("8. Screen2BodyShell geometry unchanged", () => {
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

  it("9. Screen 1 unaffected", () => {
    const screen1 = readRepoFile("components/infoboard/screen1/InfoboardScreen1.tsx");
    expect(screen1).not.toContain("Screen2LowerSponsorZone");

    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} liveClock={false} />);

    expect(screen.queryByTestId("screen2-lower-sponsor-zone")).toBeNull();
    expect(screen.getByTestId("infoboard-screen1-root")).toBeTruthy();
  });

  it("10. rotator still transitions Anlageplan → Transport → Anlageplan", () => {
    render(
      <Screen2CenterRotator
        tenantKey="fc-allschwil"
        timezone="Europe/Zurich"
        initialTransport={TRANSPORT}
        refreshIntervalSeconds={45}
        anlageplanDurationMs={100}
        transportDurationMs={100}
        live={false}
      >
        <div data-testid="anlageplan-slide-child">
          <div data-testid="screen2-lower-sponsor-zone">Lower sponsor</div>
        </div>
      </Screen2CenterRotator>,
    );

    expect(screen.getByTestId("screen2-center-rotator").getAttribute("data-active-slide")).toBe(
      "anlageplan",
    );
    expect(screen.getByTestId("screen2-lower-sponsor-zone")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId("screen2-center-rotator").getAttribute("data-active-slide")).toBe(
      "transport",
    );
    expect(screen.getByTestId("screen2-transport-slide")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId("screen2-center-rotator").getAttribute("data-active-slide")).toBe(
      "anlageplan",
    );
  });

  it("lower sponsor belongs to Anlageplan slide inside center content", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        tenantKey="fc-allschwil"
        transport={TRANSPORT}
      />,
    );

    const center = screen.getByTestId("screen2-center-content");
    const slide = screen.getByTestId("anlageplan-slide");
    const lowerSponsor = screen.getByTestId("screen2-lower-sponsor-zone");
    const canvas = screen.getByTestId("anlageplan-map-canvas");

    expect(center.contains(slide)).toBe(true);
    expect(slide.contains(canvas)).toBe(true);
    expect(slide.contains(lowerSponsor)).toBe(true);
    expect(canvas.compareDocumentPosition(lowerSponsor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reuses Screen2 sponsor rail visual primitives", () => {
    const lowerSponsor = readRepoFile(
      "components/infoboard/screen2/Screen2LowerSponsorZone.tsx",
    );
    expect(lowerSponsor).toContain("Screen2BodyShell.module.css");
    expect(lowerSponsor).toContain("railHeadline");
    expect(lowerSponsor).toContain("railSubline");
    expect(lowerSponsor).toContain("railLabel");
    expect(lowerSponsor).toContain("Handshake");
  });
});
