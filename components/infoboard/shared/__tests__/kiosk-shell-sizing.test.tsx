/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-TV-SHELL-01B — canonical shared shell sizing contract.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";
import {
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import {
  PREVIEW_FIXTURE_SCREEN2,
  PREVIEW_WEATHER,
} from "@/components/infoboard/screen2/screen2-preview-fixture";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import {
  KIOSK_SHELL_ALEXA_SAFE_ZONE_WIDTH_PX,
  KIOSK_SHELL_CSS_VARS,
  KIOSK_SHELL_HEADER_HEIGHT_PX,
  KIOSK_SHELL_MEASUREMENT_CONTRACT,
  KIOSK_SHELL_WEATHER_ZONE_MAX_WIDTH_PX,
  KIOSK_SHELL_WEATHER_ZONE_MIN_WIDTH_PX,
} from "@/lib/infoboard/kiosk-shell-sizing";
import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";
import type { WeatherResult } from "@/lib/weather/weather-types";

afterEach(() => {
  cleanup();
});

function makeFeed(): InfoboardScreen1Feed {
  return {
    generatedAt: "2026-09-12T08:30:00.000Z",
    tenant: {
      id: "tenant-test",
      key: "test-club",
      name: "FC Test",
      timezone: "Europe/Zurich",
    },
    displayDate: "2026-09-12",
    isStale: false,
    wochenplanVariantBadge: null,
    current: [],
    next: [],
    later: [],
    isEmpty: true,
    emptyStateReason: "NO_EVENTS_TODAY",
  };
}

function shellHeaderBar() {
  return screen.getByTestId("kiosk-shell-header-bar");
}

function shellFooter() {
  return screen.getByTestId("kiosk-shell-footer");
}

const AVAILABLE_WEATHER: WeatherResult = {
  isAvailable: true,
  temperatureC: 19,
  conditionCode: 2,
  conditionLabel: "Teilweise sonnig",
  windKmh: 8,
  precipitationProbability: null,
  observedAt: "2026-09-12T08:30:00.000Z",
};

function makeAnlageplanPayload(): AnlageplanLivePayload {
  return {
    screen2: {
      feed: PREVIEW_FIXTURE_SCREEN2,
      branding: { clubLogoSrc: null, productLogoSrc: null },
      currentTimeIso: PREVIEW_CURRENT_TIME_ISO,
      theme: "DARK",
    },
    anlageplanConfig: {
      version: 1,
      elements: [],
      backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    },
    backgroundUrl: null,
    backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    currentTimeIso: PREVIEW_CURRENT_TIME_ISO,
  };
}

describe("kiosk shell measurement contract", () => {
  it("exposes the canonical 1920×1080 canvas and shell heights", () => {
    expect(KIOSK_SHELL_MEASUREMENT_CONTRACT).toEqual({
      canvasWidth: 1920,
      canvasHeight: 1080,
      headerHeightPx: 81,
      subtitleHeightPx: 41,
      footerHeightPx: 49,
      crestHeightPx: 59,
      clubNameFontPx: 38,
      clockFontPx: 65,
      weekdayFontPx: 18,
      dateFontPx: 17,
      footerTickerFontPx: 16,
      brandingHeightPx: 29,
    });
  });
});

describe("KioskShellHeader — canonical sizing", () => {
  it("applies the shared CSS variable contract", () => {
    render(
      <KioskShellHeader
        clubName="FC Test"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
        subtitle="WELCOME"
        subtitleEnabled
      />,
    );

    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.getAttribute("data-kiosk-shell-contract")).toBe("true");
    expect(header.style.getPropertyValue("--kiosk-shell-header-height")).toBe(
      `${KIOSK_SHELL_HEADER_HEIGHT_PX}px`,
    );
    expect(shellHeaderBar().style.height).toBe(
      KIOSK_SHELL_CSS_VARS["--kiosk-shell-header-height"],
    );
  });
});

describe("KioskShellFooter — canonical sizing", () => {
  it("uses the shared footer height contract", () => {
    render(<KioskShellFooter />);
    expect(shellFooter().style.minHeight).toBe(
      KIOSK_SHELL_CSS_VARS["--kiosk-shell-footer-height"],
    );
  });
});

describe("Screen 1 and Screen 2 shell parity inside kiosk canvas", () => {
  const subtitle = "HERZLICH WILLKOMMEN AUF DER SPORTANLAGE";

  function renderScreen1() {
    return render(
      <KioskViewportScaler>
        <InfoboardScreen1
          feed={makeFeed()}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          headerConfig={{ subtitleEnabled: true, subtitleText: subtitle }}
        />
      </KioskViewportScaler>,
    );
  }

  function renderScreen2() {
    return render(
      <KioskViewportScaler>
        <InfoboardScreen2
          feed={PREVIEW_FIXTURE_SCREEN2}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          headerConfig={{ subtitleEnabled: true, subtitleText: subtitle }}
        />
      </KioskViewportScaler>,
    );
  }

  it("uses the same header height on both screens", () => {
    renderScreen1();
    const screen1Height = shellHeaderBar().style.height;
    cleanup();

    renderScreen2();
    const screen2Height = shellHeaderBar().style.height;

    expect(screen1Height).toBe(screen2Height);
    expect(screen1Height).toBe(`${KIOSK_SHELL_HEADER_HEIGHT_PX}px`);
  });

  it("uses the same footer height on both screens", () => {
    renderScreen1();
    const screen1Footer = shellFooter().style.minHeight;
    cleanup();

    renderScreen2();
    const screen2Footer = shellFooter().style.minHeight;

    expect(screen1Footer).toBe(screen2Footer);
    expect(screen1Footer).toBe(KIOSK_SHELL_CSS_VARS["--kiosk-shell-footer-height"]);
  });

  it("uses the same subtitle strip height on both screens", () => {
    renderScreen1();
    const screen1Subtitle = screen.getByTestId("board-title").style.height;
    cleanup();

    renderScreen2();
    const screen2Subtitle = screen.getByTestId("board-title").style.height;

    expect(screen1Subtitle).toBe(screen2Subtitle);
    expect(screen1Subtitle).toBe(KIOSK_SHELL_CSS_VARS["--kiosk-shell-subtitle-height"]);
  });
});

describe("Screen 2 preview/kiosk renderer contract", () => {
  it("wraps InfoboardScreen2 in the logical 1920×1080 canvas", () => {
    render(
      <KioskViewportScaler>
        <InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />
      </KioskViewportScaler>,
    );

    expect(screen.getByTestId("kiosk-viewport-canvas").style.width).toBe("1920px");
    expect(screen.getByTestId("kiosk-viewport-canvas").style.height).toBe("1080px");
    expect(screen.getByTestId("infoboard-screen2-root")).toBeTruthy();
  });
});

describe("INFOBOARD-TV-SHELL-01D — weather in calibrated shell", () => {
  it("reserves the canonical weather and Alexa widths in KioskShellHeader", () => {
    render(
      <KioskShellHeader
        clubName="FC ALLSCHWIL"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
        weather={AVAILABLE_WEATHER}
      />,
    );

    const weatherZone = screen.getByTestId("weather-zone");
    const alexaZone = screen.getByTestId("alexa-safe-zone");

    expect(weatherZone.style.minWidth).toBe(`${KIOSK_SHELL_WEATHER_ZONE_MIN_WIDTH_PX}px`);
    expect(weatherZone.style.maxWidth).toBe(`${KIOSK_SHELL_WEATHER_ZONE_MAX_WIDTH_PX}px`);
    expect(alexaZone.style.width).toBe(`${KIOSK_SHELL_ALEXA_SAFE_ZONE_WIDTH_PX}px`);
    expect(shellHeaderBar().style.height).toBe(`${KIOSK_SHELL_HEADER_HEIGHT_PX}px`);
  });

  it("renders weather-enabled Screen 1 inside the kiosk canvas", () => {
    render(
      <KioskViewportScaler>
        <InfoboardScreen1
          feed={makeFeed()}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          headerConfig={{ showWeather: true }}
          weather={AVAILABLE_WEATHER}
        />
      </KioskViewportScaler>,
    );

    const weatherZone = screen.getByTestId("weather-zone");
    expect(screen.getByTestId("header-weather")).toBeTruthy();
    expect(screen.getByTestId("header-weather-temperature").textContent).toContain("19");
    expect(screen.getByTestId("header-weather-condition").textContent).toBe(
      "Teilweise sonnig",
    );
    expect(weatherZone.contains(screen.getByTestId("header-weather"))).toBe(true);
    expect(screen.getByTestId("header-time-zone")).toBeTruthy();
    expect(screen.getByTestId("header-date-zone")).toBeTruthy();
  });

  it("hides weather on Screen 1 when per-board config disables it", () => {
    render(
      <KioskViewportScaler>
        <InfoboardScreen1
          feed={makeFeed()}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          headerConfig={{ showWeather: false }}
          weather={AVAILABLE_WEATHER}
        />
      </KioskViewportScaler>,
    );

    expect(screen.queryByTestId("header-weather")).toBeNull();
    expect(screen.getByTestId("header-time-zone")).toBeTruthy();
    expect(screen.getByTestId("header-date-zone")).toBeTruthy();
  });

  it("renders weather-enabled Screen 2 facility overview inside the kiosk canvas", () => {
    render(
      <KioskViewportScaler>
        <InfoboardScreen2
          feed={PREVIEW_FIXTURE_SCREEN2}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          headerConfig={{ showWeather: true }}
          weather={PREVIEW_WEATHER as WeatherResult}
        />
      </KioskViewportScaler>,
    );

    expect(screen.getByTestId("header-weather")).toBeTruthy();
    expect(screen.getByTestId("weather-zone").contains(screen.getByTestId("header-weather"))).toBe(
      true,
    );
  });

  it("renders weather-enabled Screen 2 Anlageplan shell with shared weather presentation", () => {
    render(
      <KioskViewportScaler>
        <InfoboardAnlageplan
          payload={makeAnlageplanPayload()}
          branding={{ clubName: "FC ALLSCHWIL" }}
          shellConfig={{ showWeather: true }}
          weather={AVAILABLE_WEATHER}
        />
      </KioskViewportScaler>,
    );

    expect(screen.getByTestId("header-weather")).toBeTruthy();
    expect(screen.getByTestId("header-weather-condition").textContent).toBe(
      "Teilweise sonnig",
    );
  });

  it("keeps clock, date, and weather coexistence with unchanged shell height on both screens", () => {
    render(
      <KioskViewportScaler>
        <InfoboardScreen1
          feed={makeFeed()}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          headerConfig={{ showWeather: true, subtitleEnabled: true, subtitleText: "WELCOME" }}
          weather={AVAILABLE_WEATHER}
        />
      </KioskViewportScaler>,
    );

    const screen1HeaderHeight = shellHeaderBar().style.height;
    expect(screen.getByTestId("header-time-zone").textContent?.length).toBeGreaterThan(0);
    expect(screen.getByTestId("header-date-zone").textContent?.length).toBeGreaterThan(0);
    expect(screen.getByTestId("header-weather")).toBeTruthy();
    cleanup();

    render(
      <KioskViewportScaler>
        <InfoboardScreen2
          feed={PREVIEW_FIXTURE_SCREEN2}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          headerConfig={{ showWeather: true, subtitleEnabled: true, subtitleText: "WELCOME" }}
          weather={PREVIEW_WEATHER as WeatherResult}
        />
      </KioskViewportScaler>,
    );

    expect(shellHeaderBar().style.height).toBe(screen1HeaderHeight);
    expect(screen.getByTestId("header-time-zone").textContent?.length).toBeGreaterThan(0);
    expect(screen.getByTestId("header-date-zone").textContent?.length).toBeGreaterThan(0);
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });
});
