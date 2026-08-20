/**
 * @vitest-environment jsdom
 */

/**
 * INFOBOARD-FINAL-D3 — Shell empty-state semantics test suite.
 *
 * Verifies that Screen 1 (InfoboardScreen1), Screen 2 Facility Overview
 * (InfoboardScreen2), and Screen 2 Anlageplan (InfoboardAnlageplan) all follow
 * IDENTICAL shell semantics:
 *
 *   SUBTITLE RULES
 *   A. subtitleEnabled=false        => no subtitle text rendered
 *   B. subtitleEnabled=true + empty => no subtitle text rendered (no fallback)
 *   C. subtitleEnabled=true + text  => text rendered exactly
 *
 *   ANNOUNCEMENT RULES
 *   A. announcement.enabled=false       => no announcement text rendered
 *   B. announcement.enabled=true + empty => no announcement text rendered
 *   C. announcement.enabled=true + text  => text rendered exactly
 *
 *   NO IMPLICIT FALLBACK TEXT
 *   - "ANLAGENÜBERSICHT" must never appear implicitly (only if explicitly set)
 *   - "SPORTANLAGE IM BRÜEL" must never appear implicitly in footer
 *
 *   INDEPENDENCE
 *   - Screen 1 populated + Screen 2 empty remain independent
 *   - Screen 2 populated + Screen 1 empty remain independent
 *
 *   WEATHER
 *   - ON/OFF semantics preserved on both Screen 1 and Screen 2 Anlageplan
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import {
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type { InfoboardScreen1Feed, InfoboardScreen2Feed } from "@/lib/publishing/event-types";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { WeatherResult } from "@/lib/weather/weather-types";

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeScreen1Feed(
  overrides: Partial<InfoboardScreen1Feed> = {},
): InfoboardScreen1Feed {
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

function makeScreen2Feed(
  overrides: Partial<InfoboardScreen2Feed> = {},
): InfoboardScreen2Feed {
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
    facilityName: null,
    pitches: [],
    dressingRooms: [],
    unallocated: [],
    ...overrides,
  };
}

function makeAnlageplanPayload(): AnlageplanLivePayload {
  return {
    screen2: {
      feed: makeScreen2Feed(),
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

const AVAILABLE_WEATHER: WeatherResult = {
  isAvailable: true,
  temperatureC: 18,
  conditionCode: 1,
  conditionLabel: "Sonnig",
  windKmh: 10,
  precipitationProbability: null,
  observedAt: "2026-09-12T08:30:00.000Z",
};

// ── SCREEN 1 — subtitle empty-state semantics ──────────────────────────────────

describe("Screen 1 — subtitle empty-state semantics", () => {
  it("subtitle disabled => no subtitle text rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: false, subtitleText: "SOME TEXT" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + empty text => no subtitle text rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + null text => no subtitle text rendered (no implicit fallback)", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + whitespace-only text => no subtitle text rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "   " }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + non-empty text => text rendered exactly", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "HERZLICH WILLKOMMEN" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("HERZLICH WILLKOMMEN");
  });
});

// ── SCREEN 1 — announcement empty-state semantics ─────────────────────────────

describe("Screen 1 — announcement empty-state semantics", () => {
  it("announcement disabled => no announcement text rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: false, text: "HIDDEN TEXT", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("announcement enabled + empty text => no announcement text rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("announcement enabled + null text => no announcement text rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: null, backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("announcement enabled + non-empty text => text rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "PLATZ 2 GESPERRT", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
  });
});

// ── SCREEN 2 FACILITY OVERVIEW (InfoboardScreen2) — subtitle empty-state ───────

describe("Screen 2 (InfoboardScreen2) — subtitle empty-state semantics", () => {
  it("no headerConfig => no implicit subtitle (no ANLAGENÜBERSICHT fallback)", () => {
    render(<InfoboardScreen2 feed={makeScreen2Feed()} />);
    expect(screen.queryByTestId("board-title")).toBeNull();
    const root = screen.getByTestId("infoboard-screen2-root");
    expect(root.textContent?.toUpperCase()).not.toContain("ANLAGENÜBERSICHT");
  });

  it("subtitle disabled => no subtitle text rendered", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        headerConfig={{ subtitleEnabled: false, subtitleText: "SOME TEXT" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + empty text => no subtitle text rendered", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        headerConfig={{ subtitleEnabled: true, subtitleText: "" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + null text => no subtitle text rendered (no implicit fallback)", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        headerConfig={{ subtitleEnabled: true, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + non-empty text => text rendered exactly", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        headerConfig={{ subtitleEnabled: true, subtitleText: "FELDBELEGUNG" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("FELDBELEGUNG");
  });
});

// ── SCREEN 2 FACILITY OVERVIEW (InfoboardScreen2) — announcement empty-state ──

describe("Screen 2 (InfoboardScreen2) — announcement empty-state semantics", () => {
  it("no announcement prop => no announcement text in footer (no SPORTANLAGE IM BRÜEL fallback)", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed({ facilityName: "SPORTANLAGE IM BRÜEL" })}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    // The footer must NOT show the facility name when no announcement is configured
    const footer = screen.getByTestId("kiosk-shell-footer");
    expect(footer.textContent?.toUpperCase()).not.toContain("SPORTANLAGE IM BRÜEL");
  });

  it("announcement disabled => no announcement text rendered", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        announcement={{ enabled: false, text: "HIDDEN TEXT", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("announcement enabled + empty text => no announcement text rendered", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        announcement={{ enabled: true, text: "", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("announcement enabled + null text => no announcement text rendered", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        announcement={{ enabled: true, text: null, backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("announcement enabled + non-empty text => text rendered", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        announcement={{ enabled: true, text: "KABINEN BESENREIN HINTERLASSEN", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
  });
});

// ── SCREEN 2 ANLAGEPLAN (InfoboardAnlageplan) — subtitle empty-state ──────────

describe("Screen 2 Anlageplan (InfoboardAnlageplan) — subtitle empty-state semantics", () => {
  it("no shellConfig => no implicit subtitle (no ANLAGENÜBERSICHT fallback)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent?.toUpperCase()).not.toContain("ANLAGENÜBERSICHT");
  });

  it("subtitle disabled => no subtitle text rendered", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: false, subtitleText: "SOME TEXT" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + empty text => no subtitle text rendered", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + null text => no subtitle text rendered (no implicit fallback)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitle enabled + non-empty text => text rendered exactly", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "ANLAGENÜBERSICHT" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("ANLAGENÜBERSICHT");
  });
});

// ── SCREEN 2 ANLAGEPLAN — announcement empty-state ────────────────────────────

describe("Screen 2 Anlageplan (InfoboardAnlageplan) — announcement empty-state semantics", () => {
  it("no shellConfig => no SPORTANLAGE fallback in footer", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test", facilityName: "SPORTANLAGE IM BRÜEL" }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    // With no announcement, footer should not show the facility name as leftLabel
    const footer = screen.getByTestId("kiosk-shell-footer");
    expect(footer.textContent?.toUpperCase()).not.toContain("SPORTANLAGE IM BRÜEL");
  });

  it("announcement disabled => no announcement text rendered", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: false, text: "HIDDEN", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("announcement enabled + empty text => no announcement text rendered", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: "", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("announcement enabled + null text => no announcement text rendered", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: null, backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("announcement enabled + non-empty text => text rendered", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: "ANLAGE HEUTE GESPERRT", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
  });
});

// ── NO IMPLICIT FALLBACK TEXT ─────────────────────────────────────────────────

describe("No implicit fallback text on any screen", () => {
  it("Screen 1: no implicit ANLAGENÜBERSICHT when subtitle unconfigured", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.textContent?.toUpperCase()).not.toContain("ANLAGENÜBERSICHT");
  });

  it("Screen 1: no implicit SPORTANLAGE IM BRÜEL anywhere", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.textContent?.toUpperCase()).not.toContain("SPORTANLAGE IM BRÜEL");
  });

  it("Screen 2 Facility: no implicit ANLAGENÜBERSICHT when subtitle unconfigured", () => {
    render(<InfoboardScreen2 feed={makeScreen2Feed()} />);
    const root = screen.getByTestId("infoboard-screen2-root");
    expect(root.textContent?.toUpperCase()).not.toContain("ANLAGENÜBERSICHT");
  });

  it("Screen 2 Anlageplan: no implicit ANLAGENÜBERSICHT when shellConfig absent", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent?.toUpperCase()).not.toContain("ANLAGENÜBERSICHT");
  });

  it("Screen 2 Anlageplan: no implicit SPORTANLAGE IM BRÜEL in footer when facilityName set but no announcement", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test", facilityName: "SPORTANLAGE IM BRÜEL" }}
      />,
    );
    const footer = screen.getByTestId("kiosk-shell-footer");
    expect(footer.textContent?.toUpperCase()).not.toContain("SPORTANLAGE IM BRÜEL");
  });
});

// ── PER-BOARD INDEPENDENCE ────────────────────────────────────────────────────

describe("Per-board independence — Screen 1 populated + Screen 2 (Anlageplan) empty", () => {
  it("Screen 1 subtitle renders while Screen 2 subtitle is empty", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "HERZLICH WILLKOMMEN AUF DER SPORTANLAGE" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("HERZLICH WILLKOMMEN");
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
    expect(screen.queryByText("HERZLICH WILLKOMMEN")).toBeNull();
  });

  it("Screen 1 announcement renders while Screen 2 announcement is disabled", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "BITTE DIE KABINEN BESENREIN HINTERLASSEN", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ announcement: { enabled: false, text: null, backgroundColor: null, textColor: null } }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });
});

describe("Per-board independence — Screen 2 (Anlageplan) populated + Screen 1 empty", () => {
  it("Screen 2 subtitle renders while Screen 1 subtitle is empty", () => {
    const { unmount } = render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "ANLAGENÜBERSICHT" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("ANLAGENÜBERSICHT");
    unmount();

    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
    expect(screen.queryByText("ANLAGENÜBERSICHT")).toBeNull();
  });

  it("Screen 2 announcement renders while Screen 1 announcement is absent", () => {
    const { unmount } = render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: "PLATZ 2 GESPERRT", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    unmount();

    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });
});

// ── WEATHER ON/OFF SEMANTICS ──────────────────────────────────────────────────

describe("Weather ON/OFF semantics — Screen 1", () => {
  it("showWeather=true with available weather => weather element visible", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: true }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });

  it("showWeather=false => weather element absent", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: false }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("showWeather absent (default) => weather element absent (default OFF on Screen 1)", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });
});

describe("Weather ON/OFF semantics — Screen 2 Anlageplan (InfoboardAnlageplan)", () => {
  it("showWeather=true with available weather => weather element visible", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ showWeather: true }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });

  it("showWeather=false => weather element absent", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ showWeather: false }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("showWeather absent (default) => weather element absent (default OFF on Anlageplan)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });
});

describe("Weather ON/OFF semantics — Screen 2 Facility Overview (InfoboardScreen2)", () => {
  it("showWeather=false => weather element absent", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        headerConfig={{ showWeather: false }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("showWeather=true => weather element visible", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed()}
        headerConfig={{ showWeather: true }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });
});
