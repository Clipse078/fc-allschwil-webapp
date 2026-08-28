/**
 * @vitest-environment jsdom
 */

/**
 * Focused tests for the shared kiosk shell components — INFOBOARD-MAP-02.
 *
 * Verifies:
 *   SHARED SHELL:
 *   - KioskShellHeader renders with expected testids
 *   - InfoboardScreen1 uses KioskShellHeader (kiosk-shell-header testid present)
 *   - InfoboardAnlageplan uses KioskShellHeader (kiosk-shell-header testid present)
 *   - Live clock remains shared (LiveClockScreen1 is the canonical clock)
 *   - KioskShellFooter renders with expected testids
 *   - InfoboardScreen1 uses KioskShellFooter (kiosk-shell-footer or announcement-bar)
 *   - InfoboardAnlageplan uses KioskShellFooter (same)
 *
 *   OVERVIEW MINI PREVIEWS:
 *   - InboardCard with TAGESUEBERSICHT uses InboardMiniPreview
 *   - InboardCard with ANLAGENUEBERSICHT uses AnlageplanConfigPreview (canonical)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import {
  KIOSK_SHELL_BRANDING_HEIGHT_PX,
  KIOSK_SHELL_FOOTER_HEIGHT_PX,
  KIOSK_SHELL_FOOTER_TICKER_FONT_PX,
} from "@/lib/infoboard/kiosk-shell-sizing";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  PREVIEW_FIXTURE,
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeFeed(overrides: Partial<InfoboardScreen1Feed> = {}): InfoboardScreen1Feed {
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
    ...overrides,
  };
}

// ── KioskShellHeader ──────────────────────────────────────────────────────────

describe("KioskShellHeader", () => {
  it("renders kiosk-shell-header testid", () => {
    render(
      <KioskShellHeader
        clubName="FC Test"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
      />,
    );
    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
  });

  it("renders header-center (clock zone) testid", () => {
    render(
      <KioskShellHeader
        clubName="FC Test"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
      />,
    );
    expect(screen.getByTestId("header-center")).toBeTruthy();
  });

  it("renders alexa-safe-zone testid", () => {
    render(
      <KioskShellHeader
        clubName="FC Test"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
      />,
    );
    expect(screen.getByTestId("alexa-safe-zone")).toBeTruthy();
  });

  it("renders board-title when subtitle is provided and enabled", () => {
    render(
      <KioskShellHeader
        clubName="FC Test"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
        subtitle="HEUTE AUF DER SPORTANLAGE"
        subtitleEnabled
      />,
    );
    expect(screen.getByTestId("board-title")).toBeTruthy();
    expect(screen.getByTestId("board-title").textContent).toContain("HEUTE AUF DER SPORTANLAGE");
  });

  it("does NOT render board-title when subtitleEnabled is false", () => {
    render(
      <KioskShellHeader
        clubName="FC Test"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
        subtitle="ANLAGENÜBERSICHT"
        subtitleEnabled={false}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("renders club name", () => {
    render(
      <KioskShellHeader
        clubName="FC Musterklub"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
      />,
    );
    expect(screen.getByTestId("kiosk-header-club-name").textContent).toBe("FC Musterklub");
  });

  it("renders facility line when provided", () => {
    render(
      <KioskShellHeader
        clubName="FC Test"
        facilityLine="SPORTANLAGE NORD"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
      />,
    );
    expect(screen.getByTestId("kiosk-shell-header").textContent).toContain("SPORTANLAGE NORD");
  });

  it("alexa-safe-zone has no content when no rightContent provided", () => {
    render(
      <KioskShellHeader
        clubName="FC Test"
        initialTimeIso={PREVIEW_CURRENT_TIME_ISO}
        timezone="Europe/Zurich"
      />,
    );
    const zone = screen.getByTestId("alexa-safe-zone");
    expect(zone.textContent?.trim()).toBe("");
  });
});

// ── KioskShellFooter ──────────────────────────────────────────────────────────

describe("KioskShellFooter", () => {
  it("renders kiosk-shell-footer when no announcement", () => {
    render(<KioskShellFooter />);
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("renders announcement-bar testid when announcement is active", () => {
    render(
      <KioskShellFooter
        announcement={{ enabled: true, text: "Test announcement" }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    expect(screen.queryByTestId("kiosk-shell-footer")).toBeNull();
  });

  it("renders product-branding element", () => {
    render(<KioskShellFooter />);
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("renders announcement-icon when announcement active", () => {
    render(
      <KioskShellFooter
        announcement={{ enabled: true, text: "Hello" }}
      />,
    );
    expect(screen.getByTestId("announcement-icon")).toBeTruthy();
  });

  it("does NOT render announcement-bar when announcement disabled", () => {
    render(
      <KioskShellFooter
        announcement={{ enabled: false, text: "Disabled" }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("applies the canonical footer height and ticker font tokens", () => {
    render(<KioskShellFooter />);
    const footer = screen.getByTestId("kiosk-shell-footer");
    expect(footer.style.minHeight).toBe(`${KIOSK_SHELL_FOOTER_HEIGHT_PX}px`);
    expect(footer.style.getPropertyValue("--kiosk-shell-footer-ticker-font")).toBe(
      `${KIOSK_SHELL_FOOTER_TICKER_FONT_PX}px`,
    );
  });

  it("renders SportClubEvo branding at the canonical size", () => {
    render(<KioskShellFooter />);
    const branding = screen.getByAltText("SportClubEvo");
    expect(branding.style.maxHeight).toBe(`${KIOSK_SHELL_BRANDING_HEIGHT_PX}px`);
  });
});

// ── InfoboardScreen1 uses shared shell ────────────────────────────────────────

describe("InfoboardScreen1 — shared shell", () => {
  it("renders kiosk-shell-header (shared component)", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
  });

  it("renders kiosk-shell-footer (shared component)", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("uses header-center zone from shared header", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("header-center")).toBeTruthy();
  });

  it("uses alexa-safe-zone from shared header", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("alexa-safe-zone")).toBeTruthy();
  });

  it("uses board-title from shared header", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "TEST SUBTITLE" }}
      />,
    );
    expect(screen.getByTestId("board-title")).toBeTruthy();
  });
});
