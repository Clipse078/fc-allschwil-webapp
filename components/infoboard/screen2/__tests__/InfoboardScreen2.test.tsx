/**
 * @vitest-environment jsdom
 */

/**
 * Component tests for InfoboardScreen2.
 *
 * Verifies:
 *   - Dark-theme root attribute
 *   - Facility/pitch overview present, using the full content width
 *   - Event-type statuses rendered
 *   - Free status rendered where applicable
 *   - No duplicate next-event list
 *   - No sponsor section / column rendered (INFOBOARD-INTEGRATION-01C-C1)
 *   - No standalone weather panel rendered; weather renders compactly in the
 *     header instead (INFOBOARD-INTEGRATION-01C-C1)
 *   - Header weather: temperature, condition text, MeteoSwiss attribution,
 *     unavailable fallback
 *   - Time/date remain rendered in the header
 *   - Alexa-reserved header zone remains structurally preserved
 *   - Dressing-room section renders per-resource allocations (INFOBOARD-INTEGRATION-01C)
 *   - Unallocated activities render in a compact, restrained section
 *   - DARK/LIGHT themes render the same operational content
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import {
  PREVIEW_FIXTURE_SCREEN2,
  PREVIEW_FIXTURE_SCREEN2_ALL_FREE,
  PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED,
  PREVIEW_CURRENT_TIME_ISO_S2,
  PREVIEW_WEATHER,
} from "@/components/infoboard/screen2/screen2-preview-fixture";
import type {
  InfoboardScreen2Feed,
  PitchOccupancy,
} from "@/lib/publishing/event-types";
import type { WeatherDto } from "@/lib/weather/weather-types";
import { WEATHER_UNAVAILABLE } from "@/lib/weather/weather-types";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeFeed(
  overrides: Partial<InfoboardScreen2Feed> = {},
): InfoboardScreen2Feed {
  return {
    generatedAt: "2026-09-12T08:30:00.000Z",
    tenant: {
      id: "tenant-test",
      key: "test-club",
      name: "Test Club",
      timezone: "Europe/Zurich",
    },
    displayDate: "2026-09-12",
    isStale: false,
    facilityName: "Test Facility",
    pitches: [],
    dressingRooms: [],
    unallocated: [],
    ...overrides,
  };
}

function makePitch(overrides: Partial<PitchOccupancy> = {}): PitchOccupancy {
  return {
    code: "P-TEST",
    displayLabel: "Testplatz",
    facilityName: "Test Facility",
    facilityId: "fac-test",
    resourceType: "FULL_PITCH",
    state: "FREE_NOW",
    hasAllocationConflict: false,
    currentEvent: null,
    nextEvent: null,
    ...overrides,
  };
}

const SAMPLE_WEATHER: WeatherDto = {
  isAvailable: true,
  temperatureC: 22,
  conditionCode: 2,
  conditionLabel: "Teilweise bewölkt",
  windKmh: 6,
  precipitationProbability: null,
  observedAt: "2026-09-12T15:30:00Z",
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Dark theme ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Dark theme", () => {
  it("root element has data-theme='dark' attribute by default", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    const root = screen.getByTestId("infoboard-screen2-root");
    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it("renders infoboard-screen2-root test id", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("infoboard-screen2-root")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Theme (INFOBOARD-INTEGRATION-01C — reuses Tenant.infoboardDisplayTheme) ──
// ─────────────────────────────────────────────────────────────────────────────

describe("Theme", () => {
  it("14. root element has data-theme='dark' when theme='DARK'", () => {
    render(<InfoboardScreen2 feed={makeFeed()} theme="DARK" />);
    expect(screen.getByTestId("infoboard-screen2-root").getAttribute("data-theme")).toBe("dark");
  });

  it("14. root element has data-theme='light' when theme='LIGHT'", () => {
    render(<InfoboardScreen2 feed={makeFeed()} theme="LIGHT" />);
    expect(screen.getByTestId("infoboard-screen2-root").getAttribute("data-theme")).toBe("light");
  });

  it("14. DARK/LIGHT content parity — same pitch, header and dressing-room text renders under both themes", () => {
    const feed = makeFeed({
      pitches: [makePitch({ code: "P-ST", displayLabel: "Stadion" })],
      dressingRooms: [
        { code: "DR-E1", displayLabel: "Kabine E1", state: "OCCUPIED_NOW", current: { code: "DR-E1", displayLabel: "Kabine E1", role: "HOME", assignedTo: "FC Test", eventId: "e1" }, next: null },
      ],
    });

    const { unmount } = render(<InfoboardScreen2 feed={feed} theme="DARK" />);
    const darkText = screen.getByTestId("infoboard-screen2-root").textContent;
    unmount();

    render(<InfoboardScreen2 feed={feed} theme="LIGHT" />);
    const lightText = screen.getByTestId("infoboard-screen2-root").textContent;

    expect(darkText).toBe(lightText);
  });

  it("15. renders the full preview fixture under the LIGHT theme without crashing", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
        theme="LIGHT"
      />,
    );
    expect(screen.getByTestId("infoboard-screen2-root").getAttribute("data-theme")).toBe("light");
    expect(screen.getAllByTestId("pitch-card").length).toBeGreaterThan(0);
    expect(screen.getByTestId("dressing-room-section")).toBeTruthy();
  });

  it("16. header weather remains readable under LIGHT theme (same content as DARK)", () => {
    const { unmount } = render(
      <InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} theme="DARK" />,
    );
    const darkTemp = screen.getByTestId("header-weather-temperature").textContent;
    unmount();

    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} theme="LIGHT" />);
    const lightTemp = screen.getByTestId("header-weather-temperature").textContent;

    expect(darkTemp).toBe(lightTemp);
    expect(screen.getByTestId("header-weather-condition").textContent).toBe("Teilweise bewölkt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Header ────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header", () => {
  it("renders club name in header", () => {
    render(<InfoboardScreen2 feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Testclub", timezone: "Europe/Zurich" } })} />);
    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.textContent).toContain("FC Testclub");
  });

  it("renders facility name in header", () => {
    render(<InfoboardScreen2 feed={makeFeed({ facilityName: "Mein Stadion" })} />);
    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.textContent).toContain("Mein Stadion");
  });

  it("renders current time when currentTimeIso is provided", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-center");
    expect(center.textContent).toContain("10:30");
  });

  it("time/date block is rendered inside header-center, and weather is in the right slot alongside it", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
        weather={SAMPLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-center")).toBeTruthy();
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });

  it("Alexa-safe zone exists as the canonical right-slot container", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    const safe = screen.getByTestId("alexa-safe-zone");
    expect(safe).toBeTruthy();
  });

  it("Alexa-safe zone is present in the shared kiosk header", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
        weather={SAMPLE_WEATHER}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    const safe = screen.getByTestId("alexa-safe-zone");
    expect(header.contains(safe)).toBe(true);
  });

  it("weather renders inside the canonical right slot (alexa-safe-zone) when provided", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const safe = screen.getByTestId("alexa-safe-zone");
    expect(within(safe).getByTestId("header-weather-temperature")).toBeTruthy();
  });

  it("renders club logo when branding.clubLogoSrc provided", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Test", timezone: "Europe/Zurich" } })}
        branding={{ clubLogoSrc: "/logo.png" }}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    const img = header.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/logo.png");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Facility overview ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Facility overview", () => {
  it("renders facility-overview section", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("facility-overview")).toBeTruthy();
  });

  it("11. renders pitch grid when pitches are present", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [makePitch()] })}
      />,
    );
    expect(screen.getByTestId("pitch-grid")).toBeTruthy();
  });

  it("11. renders one pitch card per pitch", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({ code: "P-1", displayLabel: "Platz 1" }),
            makePitch({ code: "P-2", displayLabel: "Platz 2" }),
          ],
        })}
      />,
    );
    const cards = screen.getAllByTestId("pitch-card");
    expect(cards).toHaveLength(2);
  });

  it("renders pitch name in each card", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [makePitch({ code: "P-ST", displayLabel: "Stadion" })] })}
      />,
    );
    expect(screen.getByText("Stadion")).toBeTruthy();
  });

  it("renders empty message when no pitches", () => {
    render(<InfoboardScreen2 feed={makeFeed({ pitches: [] })} />);
    expect(screen.getByTestId("pitch-grid-empty")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Event-type status on pitch cards ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Pitch card — event-type statuses", () => {
  it("pitch card with MATCH event has data-event-type='match'", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              code: "P-ST",
              state: "OCCUPIED_NOW",
              currentEvent: {
                eventId: "e1",
                displayTitle: "FC Test – FC Other",
                teamDisplayName: "FC Test",
                opponentDisplayName: "FC Other",
                startAt: "2026-09-12T15:00:00.000Z",
                endAt: null,
                status: "LIVE",
                type: "MATCH",
                temporalRelation: "current",
                dressingRooms: [],
              },
              nextEvent: null,
            }),
          ],
        })}
      />,
    );
    const card = screen.getByTestId("pitch-card");
    expect(card.getAttribute("data-event-type")).toBe("match");
  });

  it("pitch card with TRAINING event has data-event-type='training'", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              code: "P-KR1",
              state: "OCCUPIED_NOW",
              currentEvent: {
                eventId: "e2",
                displayTitle: "FC Test Training",
                teamDisplayName: "FC Test U12",
                opponentDisplayName: null,
                startAt: "2026-09-12T16:00:00.000Z",
                endAt: null,
                status: "SCHEDULED",
                type: "TRAINING",
                temporalRelation: "current",
                dressingRooms: [],
              },
              nextEvent: null,
            }),
          ],
        })}
      />,
    );
    const card = screen.getByTestId("pitch-card");
    expect(card.getAttribute("data-event-type")).toBe("training");
  });

  it("pitch card with TOURNAMENT event has data-event-type='tournament'", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              code: "P-KR2",
              state: "OCCUPIED_NOW",
              currentEvent: {
                eventId: "e3",
                displayTitle: "Sommer-Cup E",
                teamDisplayName: "FC Allschwil",
                opponentDisplayName: null,
                startAt: "2026-09-12T17:00:00.000Z",
                endAt: null,
                status: "SCHEDULED",
                type: "TOURNAMENT",
                temporalRelation: "current",
                dressingRooms: [],
              },
              nextEvent: null,
            }),
          ],
        })}
      />,
    );
    const card = screen.getByTestId("pitch-card");
    expect(card.getAttribute("data-event-type")).toBe("tournament");
  });

  it("pitch card status shows TRAINING for a training event (simplified status)", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              state: "OCCUPIED_NOW",
              currentEvent: {
                eventId: "e1",
                displayTitle: "Test",
                teamDisplayName: "Team A",
                opponentDisplayName: null,
                startAt: "2026-09-12T16:00:00.000Z",
                endAt: null,
                status: "LIVE",
                type: "TRAINING",
                temporalRelation: "current",
                dressingRooms: [],
              },
              nextEvent: null,
            }),
          ],
        })}
      />,
    );
    const statusBadge = screen.getByTestId("pitch-card-status");
    expect(statusBadge.textContent).toContain("TRAINING");
  });

  it("pitch card status shows MATCH for a match event", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              state: "OCCUPIED_NOW",
              currentEvent: {
                eventId: "e-match",
                displayTitle: "FC Test – FC Other",
                teamDisplayName: "FC Test",
                opponentDisplayName: "FC Other",
                startAt: "2026-09-12T15:00:00.000Z",
                endAt: null,
                status: "LIVE",
                type: "MATCH",
                temporalRelation: "current",
                dressingRooms: [],
              },
              nextEvent: null,
            }),
          ],
        })}
      />,
    );
    const statusBadge = screen.getByTestId("pitch-card-status");
    expect(statusBadge.textContent).toContain("MATCH");
  });

  it("pitch card status shows TURNIER for a tournament event", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              state: "OCCUPIED_NOW",
              currentEvent: {
                eventId: "e-tour",
                displayTitle: "Cup",
                teamDisplayName: "FC Cup",
                opponentDisplayName: null,
                startAt: "2026-09-12T14:00:00.000Z",
                endAt: null,
                status: "LIVE",
                type: "TOURNAMENT",
                temporalRelation: "current",
                dressingRooms: [],
              },
              nextEvent: null,
            }),
          ],
        })}
      />,
    );
    const statusBadge = screen.getByTestId("pitch-card-status");
    expect(statusBadge.textContent).toContain("TURNIER");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Simplified status — orientation-first (INFOBOARD-FINAL-C) ────────────────
// ─────────────────────────────────────────────────────────────────────────────
//
// Screen 2 shows only FREI / TRAINING / MATCH / TURNIER.
// No temporal labels (JETZT/DANACH), no team names, no times.
// The current event determines the status; if absent the pitch is FREI.

describe("Pitch card — simplified orientation-first status", () => {
  it("pitch with currentEvent TRAINING shows TRAINING status (not JETZT)", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              code: "P-KR2",
              displayLabel: "KR2",
              state: "OCCUPIED_NOW",
              currentEvent: {
                eventId: "e1",
                displayTitle: "Juniorinnen FF-14",
                teamDisplayName: "Juniorinnen FF-14",
                opponentDisplayName: null,
                startAt: "2026-09-12T17:00:00.000Z",
                endAt: "2026-09-12T18:00:00.000Z",
                status: "LIVE",
                type: "TRAINING",
                temporalRelation: "current",
                dressingRooms: [],
              },
              nextEvent: {
                eventId: "e2",
                displayTitle: "FC Allschwil D1",
                teamDisplayName: "FC Allschwil D1",
                opponentDisplayName: null,
                startAt: "2026-09-12T18:30:00.000Z",
                endAt: "2026-09-12T20:00:00.000Z",
                status: "SCHEDULED",
                type: "TRAINING",
                temporalRelation: "next",
                dressingRooms: [],
              },
            }),
          ],
        })}
      />,
    );
    const statusBadge = screen.getByTestId("pitch-card-status");
    expect(statusBadge.textContent).toContain("TRAINING");
    // Orientation-first: temporal labels (JETZT/DANACH) are not shown
    expect(screen.queryByTestId("pitch-card-temporal-current")).toBeNull();
    expect(screen.queryByTestId("pitch-card-temporal-next")).toBeNull();
    // Team names are not displayed in pitch cards
    expect(screen.queryByText("Juniorinnen FF-14")).toBeNull();
    expect(screen.queryByText("FC Allschwil D1")).toBeNull();
  });

  it("pitch with only a nextEvent shows FREI (pitch is currently free)", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              code: "P-KR3",
              state: "UPCOMING",
              currentEvent: null,
              nextEvent: {
                eventId: "e3",
                displayTitle: "Sommer-Cup",
                teamDisplayName: "FC Allschwil Junioren",
                opponentDisplayName: null,
                startAt: "2026-09-12T19:00:00.000Z",
                endAt: null,
                status: "SCHEDULED",
                type: "TOURNAMENT",
                temporalRelation: "next",
                dressingRooms: [],
              },
            }),
          ],
        })}
      />,
    );
    const statusBadge = screen.getByTestId("pitch-card-status");
    // No current event: pitch is free regardless of upcoming events
    expect(statusBadge.textContent).toContain("FREI");
    expect(screen.queryByTestId("pitch-card-temporal-current")).toBeNull();
    expect(screen.queryByTestId("pitch-card-temporal-next")).toBeNull();
  });

  it("preview fixture: occupied pitches show correct simplified status types", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const statusBadges = screen.getAllByTestId("pitch-card-status");
    const statusTexts = statusBadges.map((b) => b.textContent ?? "");
    // Only FREI/TRAINING/MATCH/TURNIER are allowed — no BELEGT, DEMNÄCHST, etc.
    for (const text of statusTexts) {
      const allowed = ["FREI", "TRAINING", "MATCH", "TURNIER"];
      expect(allowed.some((s) => text.includes(s))).toBe(true);
    }
    // The preview fixture has a MATCH (Stadion) and a TRAINING (KR1)
    expect(statusTexts.some((t) => t.includes("MATCH"))).toBe(true);
    expect(statusTexts.some((t) => t.includes("TRAINING"))).toBe(true);
  });

  it("temporal labels (JETZT/DANACH) are never rendered in pitch cards", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    expect(screen.queryAllByTestId("pitch-card-temporal-current")).toHaveLength(0);
    expect(screen.queryAllByTestId("pitch-card-temporal-next")).toHaveLength(0);
  });

  it("no team names are displayed within pitch cards", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const facilityOverview = screen.getByTestId("facility-overview");
    // Team names from the fixture should not appear in pitch cards
    expect(within(facilityOverview).queryByText("FC Allschwil E1")).toBeNull();
    expect(within(facilityOverview).queryByText("FC Binningen E1")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Free pitch status ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Free pitch status", () => {
  it("pitch card with FREE_NOW state has data-state='free'", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [makePitch({ state: "FREE_NOW" })] })}
      />,
    );
    const card = screen.getByTestId("pitch-card");
    expect(card.getAttribute("data-state")).toBe("free");
  });

  it("free pitch status badge says FREI", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [makePitch({ state: "FREE_NOW" })] })}
      />,
    );
    const status = screen.getByTestId("pitch-card-status");
    expect(status.textContent).toContain("FREI");
  });

  it("free pitch card shows FREI text", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [makePitch({ state: "FREE_NOW" })] })}
      />,
    );
    const freeArea = screen.getByTestId("pitch-card-free");
    expect(freeArea.textContent).toContain("FREI");
  });

  it("all pitches free scenario renders all pitch cards", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_ALL_FREE} />);
    const cards = screen.getAllByTestId("pitch-card");
    expect(cards.length).toBeGreaterThan(0);
    const freeCards = cards.filter(
      (c) => c.getAttribute("data-state") === "free",
    );
    expect(freeCards.length).toBe(cards.length);
  });

  it("mixed pitch activity scenario renders correct status attributes", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const cards = screen.getAllByTestId("pitch-card");
    expect(cards.length).toBe(4);
    const stateValues = cards.map((c) => c.getAttribute("data-state"));
    expect(stateValues).toContain("free");
    expect(stateValues).toContain("occupied");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Header weather — compact (INFOBOARD-INTEGRATION-01C-C1) ─────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header weather — available", () => {
  it("2. renders compact weather in the header when weather data is available", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const header = screen.getByTestId("kiosk-shell-header");
    expect(within(header).getByTestId("header-weather")).toBeTruthy();
  });

  it("3. temperature renders in °C", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const temp = screen.getByTestId("header-weather-temperature");
    expect(temp.textContent).toContain("22");
    expect(temp.textContent).toContain("°C");
  });

  it("4. German condition text renders", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const condition = screen.getByTestId("header-weather-condition");
    expect(condition.textContent).toBe("Teilweise bewölkt");
  });

  it("does not render header-weather-unavailable when data is available", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    expect(screen.queryByTestId("header-weather-unavailable")).toBeNull();
  });

  it("weather icon is rendered alongside temperature", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const weather = screen.getByTestId("header-weather");
    expect(weather.querySelector("svg")).toBeTruthy();
  });
});

describe("Header weather — unavailable", () => {
  it("5. renders fallback safely when weather is null", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={null} />);
    expect(screen.getByTestId("header-weather")).toBeTruthy();
    expect(screen.getByTestId("header-weather-unavailable")).toBeTruthy();
  });

  it("5. renders fallback when weather is WEATHER_UNAVAILABLE", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={WEATHER_UNAVAILABLE} />);
    expect(screen.getByTestId("header-weather-unavailable")).toBeTruthy();
  });

  it("5. fallback text indicates weather is unavailable", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={null} />);
    const fallback = screen.getByTestId("header-weather-unavailable");
    expect(fallback.textContent?.toUpperCase()).toContain("WETTER");
  });

  it("no header-weather-temperature when unavailable", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={null} />);
    expect(screen.queryByTestId("header-weather-temperature")).toBeNull();
  });

  it("renders without crashing when weather prop is omitted", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("header-weather")).toBeTruthy();
    expect(screen.getByTestId("header-weather-unavailable")).toBeTruthy();
  });
});

describe("Header weather — MeteoSwiss OGD attribution (WEATHER-01)", () => {
  it("renders header-weather-attribution when weather data is available", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    expect(screen.getByTestId("header-weather-attribution")).toBeTruthy();
  });

  it("attribution text contains 'MeteoSwiss'", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const attribution = screen.getByTestId("header-weather-attribution");
    expect(attribution.textContent).toContain("MeteoSwiss");
  });

  it("attribution uses 'Quelle: MeteoSwiss' wording (OGD requirement)", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const attribution = screen.getByTestId("header-weather-attribution");
    expect(attribution.textContent).toContain("Quelle");
  });

  it("attribution is not shown when weather is unavailable", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={null} />);
    expect(screen.queryByTestId("header-weather-attribution")).toBeNull();
  });
});

describe("Header weather — preview fixture", () => {
  it("PREVIEW_WEATHER renders correctly in the header", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} weather={PREVIEW_WEATHER} />);
    expect(screen.getByTestId("header-weather")).toBeTruthy();
    expect(screen.getByTestId("header-weather-temperature")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Sponsor section removed (INFOBOARD-INTEGRATION-01C-C1) ──────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Sponsor section removed", () => {
  it("does not render a sponsor-section test id", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.queryByTestId("sponsor-section")).toBeNull();
  });

  it("does not render a sponsor-aside test id", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.queryByTestId("sponsor-aside")).toBeNull();
  });

  it("does not render any sponsor-card", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.queryAllByTestId("sponsor-card")).toHaveLength(0);
  });

  it("does not render sponsor-related text anywhere on screen", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    const root = screen.getByTestId("infoboard-screen2-root");
    expect(root.textContent?.toUpperCase()).not.toContain("SPONSOREN");
  });

  it("does not render a standalone weather-panel test id", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} weather={PREVIEW_WEATHER} />);
    expect(screen.queryByTestId("weather-panel")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── No "Next Events" panel ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("No Next Events panel", () => {
  it("10. does not render a 'next events' heading anywhere", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    const headings = screen.queryAllByRole("heading");
    for (const h of headings) {
      expect(h.textContent?.toLowerCase()).not.toContain("next events");
      expect(h.textContent?.toLowerCase()).not.toContain("nächste events");
      expect(h.textContent?.toLowerCase()).not.toContain("nächste veranstaltungen");
    }
  });

  it("10. does not render a test-id 'next-events-section'", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.queryByTestId("next-events-section")).toBeNull();
  });

  it("does not contain 'next-events-list' test id", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.queryByTestId("next-events-list")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Dressing-room section (INFOBOARD-INTEGRATION-01C) ────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Dressing-room section", () => {
  it("8. renders dressing-room-section when dressingRooms are present in the feed", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            {
              code: "DR-E1",
              displayLabel: "Kabine E1",
              state: "OCCUPIED_NOW",
              current: {
                code: "DR-E1",
                displayLabel: "Kabine E1",
                role: "HOME",
                assignedTo: "FC Allschwil E1",
                eventId: "evt-1",
              },
              next: null,
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId("dressing-room-section")).toBeTruthy();
  });

  it("does not render dressing-room-section when dressingRooms is empty", () => {
    render(<InfoboardScreen2 feed={makeFeed({ dressingRooms: [] })} />);
    expect(screen.queryByTestId("dressing-room-section")).toBeNull();
  });

  it("9. renders dressing-room-list", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            {
              code: "DR-E2",
              displayLabel: "Kabine E2",
              state: "OCCUPIED_NOW",
              current: { code: "DR-E2", displayLabel: "Kabine E2", role: "AWAY", assignedTo: "Team B", eventId: "e1" },
              next: null,
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId("dressing-room-list")).toBeTruthy();
  });

  it("9. renders the assigned team name for an occupied dressing room", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            {
              code: "DR-E1",
              displayLabel: "Kabine E1",
              state: "OCCUPIED_NOW",
              current: { code: "DR-E1", displayLabel: "Kabine E1", role: "HOME", assignedTo: "FC Test Team", eventId: "e1" },
              next: null,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("FC Test Team")).toBeTruthy();
    expect(screen.getByText("Kabine E1")).toBeTruthy();
  });

  it("renders FREI for a dressing room with no current or next assignment", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            { code: "DR-E3", displayLabel: "Kabine E3", state: "FREE_NOW", current: null, next: null },
          ],
        })}
      />,
    );
    expect(screen.getByTestId("dressing-room-free")).toBeTruthy();
  });

  it("does not invent an assignment for a free dressing room", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            { code: "DR-E3", displayLabel: "Kabine E3", state: "FREE_NOW", current: null, next: null },
          ],
        })}
      />,
    );
    expect(screen.queryByTestId("dressing-room-occupant")).toBeNull();
  });

  it("8. full preview fixture renders dressing-room-section", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    expect(screen.getByTestId("dressing-room-section")).toBeTruthy();
  });

  it("renders GARDEROBEN heading", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.getByText("GARDEROBEN")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Unallocated section (removed — INFOBOARD-FINAL-C orientation-first) ──────
// ─────────────────────────────────────────────────────────────────────────────
//
// Screen 2 is orientation-first. The "unallocated" section was detailed event
// metadata that violated the simplified status contract (FREI/TRAINING/MATCH/
// TURNIER only). It is no longer rendered. Feed data still accepted for compat.

describe("Unallocated section (removed — orientation-first)", () => {
  it("does not render unallocated-section even when unallocated data is present", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          unallocated: [
            {
              eventId: "evt-u1",
              displayTitle: "Aktive Herren",
              teamDisplayName: "Aktive Herren",
              opponentDisplayName: null,
              startAt: "2026-09-12T18:00:00.000Z",
              endAt: null,
              status: "SCHEDULED",
              type: "TRAINING",
              temporalRelation: "next",
              dressingRooms: [],
            },
          ],
        })}
      />,
    );
    expect(screen.queryByTestId("unallocated-section")).toBeNull();
  });

  it("does not render unallocated-section when unallocated is empty", () => {
    render(<InfoboardScreen2 feed={makeFeed({ unallocated: [] })} />);
    expect(screen.queryByTestId("unallocated-section")).toBeNull();
  });

  it("full preview fixture no longer renders unallocated-section", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    expect(screen.queryByTestId("unallocated-section")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 12. Alexa-safe zone ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("12. Alexa-safe zone", () => {
  it("Alexa-safe zone (canonical right slot) is present in the shared header", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    const safe = screen.getByTestId("alexa-safe-zone");
    expect(safe).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Footer — product branding ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Footer — product branding", () => {
  it("renders product-branding section", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("renders POWERED BY text", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("product-branding").textContent).toContain("POWERED BY");
  });

  it("renders product logo when productLogoSrc provided", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed()}
        branding={{ productLogoSrc: "/images/branding/sportclubevo_logo.png" }}
      />,
    );
    const branding = screen.getByTestId("product-branding");
    const img = branding.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("SportClubEvo");
  });

  it("renders SportClubEvo fallback when productLogoSrc is null", () => {
    render(<InfoboardScreen2 feed={makeFeed()} branding={{ productLogoSrc: null }} />);
    expect(screen.getByTestId("product-branding").textContent).toContain("SportClubEvo");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Full preview fixture ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Full preview fixture", () => {
  it("1. renders 4 pitch cards for the preview fixture", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const cards = screen.getAllByTestId("pitch-card");
    expect(cards).toHaveLength(4);
  });

  it("Stadion pitch appears with match event data", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    expect(screen.getByText("Stadion")).toBeTruthy();
  });

  it("no sponsor content renders alongside the full preview fixture", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    expect(screen.queryAllByTestId("sponsor-card")).toHaveLength(0);
    expect(screen.queryByTestId("sponsor-aside")).toBeNull();
  });

  it("facility overview is not replaced by any event-list content", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const facility = screen.getByTestId("facility-overview");
    expect(facility).toBeTruthy();
    expect(within(facility).queryByTestId("event-row")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Missing optional data safety ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Missing optional data safety", () => {
  it("renders without crashing when weather is absent (default)", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("infoboard-screen2-root")).toBeTruthy();
  });

  it("renders without crashing when branding is absent", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("infoboard-screen2-root")).toBeTruthy();
  });

  it("renders null string is never visible", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [makePitch({ displayLabel: "Testfeld" })] })}
      />,
    );
    expect(screen.queryByText("null")).toBeNull();
    expect(screen.queryByText("undefined")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── All pitches occupied fixture ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("All pitches occupied fixture", () => {
  it("renders all 4 pitch cards as occupied", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const cards = screen.getAllByTestId("pitch-card");
    expect(cards.length).toBe(4);
    const occupiedCards = cards.filter(
      (c) => c.getAttribute("data-state") === "occupied",
    );
    expect(occupiedCards.length).toBe(4);
  });

  it("8. dressing-room-section still renders in all-occupied scenario", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED} />);
    expect(screen.getByTestId("dressing-room-section")).toBeTruthy();
  });

  it("no sponsor content renders in all-occupied scenario", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED} />);
    expect(screen.queryByTestId("sponsor-section")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Live route safety ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Live route safety", () => {
  it("empty pitches renders pitch-grid-empty with informative message", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
        branding={{ clubLogoSrc: "/logo.png" }}
      />,
    );
    expect(screen.getByTestId("pitch-grid-empty")).toBeTruthy();
    expect(screen.getByTestId("pitch-grid-empty").textContent).toContain("KEINE FELDDATEN");
  });

  it("empty state does not render any pitch-card", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
      />,
    );
    expect(screen.queryAllByTestId("pitch-card")).toHaveLength(0);
  });

  it("facility-overview section is still present in empty state", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
      />,
    );
    expect(screen.getByTestId("facility-overview")).toBeTruthy();
  });

  it("no sponsor section renders in empty state", () => {
    render(<InfoboardScreen2 feed={makeFeed({ pitches: [], dressingRooms: [] })} />);
    expect(screen.queryByTestId("sponsor-section")).toBeNull();
  });

  it("header weather still renders in empty pitch state", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
        weather={SAMPLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 13. No visual regression to Screen 1 ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("13. No visual regression to Screen 1", () => {
  it("does not render screen1-specific test ids", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.queryByTestId("infoboard-screen1-root")).toBeNull();
    expect(screen.queryByTestId("event-card")).toBeNull();
    expect(screen.queryByTestId("event-list")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-FINAL-C — Orientation-first acceptance tests ───────────────────
// ─────────────────────────────────────────────────────────────────────────────

import {
  PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV,
} from "@/components/infoboard/screen2/screen2-preview-fixture";

describe("Orientation-first: whole-pitch when all-free", () => {
  it("all-free fixture shows all pitch cards as free", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_ALL_FREE} />);
    const cards = screen.getAllByTestId("pitch-card");
    expect(cards.length).toBeGreaterThan(0);
    const freeCards = cards.filter((c) => c.getAttribute("data-state") === "free");
    expect(freeCards.length).toBe(cards.length);
  });

  it("all-free pitch cards show FREI status", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_ALL_FREE} />);
    const statusBadges = screen.getAllByTestId("pitch-card-status");
    for (const badge of statusBadges) {
      expect(badge.textContent).toContain("FREI");
    }
  });

  it("pitch names are displayed when all pitches are free", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_ALL_FREE} />);
    // All pitches from the preview fixture should still show their names
    const names = screen.getAllByTestId("pitch-card-name");
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("Orientation-first: Feld A/B split for HALF_PITCH facilities", () => {
  it("physical-TV fixture with occupied HALF_PITCH produces pitch-half-pair containers", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV} />);
    const halfPairs = screen.queryAllByTestId("pitch-half-pair");
    // KR2 and KR3 each have one half occupied → both appear as half-pairs
    expect(halfPairs.length).toBeGreaterThan(0);
  });

  it("half-pair contains two pitch-card elements representing the two halves", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV} />);
    const halfPairs = screen.queryAllByTestId("pitch-half-pair");
    for (const pair of halfPairs) {
      const halves = within(pair).getAllByTestId("pitch-card");
      expect(halves.length).toBe(2);
    }
  });

  it("Feld A and B have different statuses when one is occupied and one is free", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV} />);
    const halfPairs = screen.queryAllByTestId("pitch-half-pair");
    expect(halfPairs.length).toBeGreaterThan(0);
    // At least one pair should have one occupied and one free half
    const hasMixedPair = halfPairs.some((pair) => {
      const halves = within(pair).getAllByTestId("pitch-card");
      const states = halves.map((h) => h.getAttribute("data-state"));
      return states.includes("occupied") && states.includes("free");
    });
    expect(hasMixedPair).toBe(true);
  });

  it("STADION is shown as a single FULL_PITCH card (not split)", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV} />);
    const allCards = screen.getAllByTestId("pitch-card");
    // STADION card shows its name
    const stadionCard = allCards.find((c) =>
      within(c).queryByTestId("pitch-card-name")?.textContent?.toUpperCase().includes("STADION"),
    );
    expect(stadionCard).toBeTruthy();
    // STADION is not inside a half-pair
    const halfPairs = screen.queryAllByTestId("pitch-half-pair");
    for (const pair of halfPairs) {
      const names = within(pair).queryAllByTestId("pitch-card-name");
      const pairHasStadion = names.some((n) => n.textContent?.toUpperCase().includes("STADION"));
      expect(pairHasStadion).toBe(false);
    }
  });
});

describe("Orientation-first: allowed statuses only", () => {
  const ALLOWED_STATUSES = ["FREI", "TRAINING", "MATCH", "TURNIER"];

  it("status badges only contain allowed values across all-occupied fixture", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED} />);
    const badges = screen.getAllByTestId("pitch-card-status");
    for (const badge of badges) {
      const text = badge.textContent ?? "";
      expect(ALLOWED_STATUSES.some((s) => text.includes(s))).toBe(true);
    }
  });

  it("UPCOMING pitch state maps to FREI simplified status", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          pitches: [
            makePitch({
              state: "UPCOMING",
              currentEvent: null,
              nextEvent: {
                eventId: "e-next",
                displayTitle: "Upcoming Event",
                teamDisplayName: "Team X",
                opponentDisplayName: null,
                startAt: "2026-09-12T20:00:00.000Z",
                endAt: null,
                status: "SCHEDULED",
                type: "TRAINING",
                temporalRelation: "next",
                dressingRooms: [],
              },
            }),
          ],
        })}
      />,
    );
    const badge = screen.getByTestId("pitch-card-status");
    expect(badge.textContent).toContain("FREI");
  });

  it("no BELEGT status badge appears anywhere", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const root = screen.getByTestId("infoboard-screen2-root");
    const badgesWithBelegt = Array.from(
      root.querySelectorAll("[data-testid='pitch-card-status']"),
    ).filter((el) => el.textContent?.includes("BELEGT"));
    expect(badgesWithBelegt).toHaveLength(0);
  });

  it("no DEMNÄCHST status badge appears anywhere", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    const root = screen.getByTestId("infoboard-screen2-root");
    const badgesWithDemnaechst = Array.from(
      root.querySelectorAll("[data-testid='pitch-card-status']"),
    ).filter((el) => el.textContent?.includes("DEMNÄCHST"));
    expect(badgesWithDemnaechst).toHaveLength(0);
  });
});

describe("Orientation-first: facility names are present and dominant", () => {
  it("facility names are present in all pitch regions", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    const nameEls = screen.getAllByTestId("pitch-card-name");
    expect(nameEls.length).toBeGreaterThan(0);
    // All pitch cards must have a non-empty name
    for (const el of nameEls) {
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("Stadion, Kunstrasen 1, Kunstrasen 2, Kunstrasen 3 appear in the preview fixture", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    const root = screen.getByTestId("infoboard-screen2-root");
    expect(root.textContent).toContain("Stadion");
    expect(root.textContent).toContain("Kunstrasen 1");
    expect(root.textContent).toContain("Kunstrasen 2");
    expect(root.textContent).toContain("Kunstrasen 3");
  });

  it("facility names in physical-TV fixture are present", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV} />);
    const nameEls = screen.getAllByTestId("pitch-card-name");
    const allNames = nameEls.map((n) => n.textContent ?? "").join(" ");
    // Stadion should appear
    expect(allNames.toUpperCase()).toContain("STADION");
  });
});

describe("Orientation-first: no detailed event metadata in pitch cards", () => {
  it("does not render pitch-card-event testid", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.queryAllByTestId("pitch-card-event")).toHaveLength(0);
  });

  it("does not render pitch-card-next-event testid", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.queryAllByTestId("pitch-card-next-event")).toHaveLength(0);
  });

  it("does not render pitch-card-temporal-current or pitch-card-temporal-next", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />);
    expect(screen.queryAllByTestId("pitch-card-temporal-current")).toHaveLength(0);
    expect(screen.queryAllByTestId("pitch-card-temporal-next")).toHaveLength(0);
  });

  it("InfoboardScreen2 is the orientation renderer (data-testid=infoboard-screen2-root)", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("infoboard-screen2-root")).toBeTruthy();
  });

  it("groupFacilityPitches is applied: HALF_PITCH hierarchy produces correct visible set", () => {
    // Physical-TV fixture: KR2 and KR3 have HALF_PITCH entries with current events.
    // groupFacilityPitches should suppress the FULL_PITCH entries and show halves.
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV} />);
    const cards = screen.getAllByTestId("pitch-card");
    // Expected: 1 Stadion (FULL) + 2 KR2 halves + 2 KR3 halves = 5
    // FULL KR2 and FULL KR3 are suppressed by groupFacilityPitches
    expect(cards.length).toBe(5);
  });
});
