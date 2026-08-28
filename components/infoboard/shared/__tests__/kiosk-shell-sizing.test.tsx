/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-TV-SHELL-01B — canonical shared shell sizing contract.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";
import {
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import { PREVIEW_FIXTURE_SCREEN2 } from "@/components/infoboard/screen2/screen2-preview-fixture";
import {
  KIOSK_SHELL_CSS_VARS,
  KIOSK_SHELL_HEADER_HEIGHT_PX,
  KIOSK_SHELL_MEASUREMENT_CONTRACT,
} from "@/lib/infoboard/kiosk-shell-sizing";
import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";

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
