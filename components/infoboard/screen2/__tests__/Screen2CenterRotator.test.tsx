/**
 * @vitest-environment jsdom
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Screen2CenterRotator } from "@/components/infoboard/screen2/Screen2CenterRotator";
import type { TransportResult } from "@/lib/transport/transport-types";

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

describe("Screen2CenterRotator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with the Anlageplan slide", () => {
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
        <div data-testid="anlageplan-child">Anlageplan</div>
      </Screen2CenterRotator>,
    );

    const rotator = screen.getByTestId("screen2-center-rotator");
    expect(rotator.getAttribute("data-active-slide")).toBe("anlageplan");
    expect(screen.getByTestId("anlageplan-child")).toBeTruthy();
  });

  it("transitions to transport and back while keeping shell children mounted", () => {
    render(
      <div>
        <div data-testid="kiosk-shell-header">Header</div>
        <Screen2CenterRotator
          tenantKey="fc-allschwil"
          timezone="Europe/Zurich"
          initialTransport={TRANSPORT}
          refreshIntervalSeconds={45}
          anlageplanDurationMs={100}
          transportDurationMs={100}
          live={false}
        >
          <div data-testid="anlageplan-child">Anlageplan</div>
        </Screen2CenterRotator>
        <div data-testid="kiosk-shell-footer">Footer</div>
      </div>,
    );

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

    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
    expect(screen.getByTestId("anlageplan-child")).toBeTruthy();
  });
});
