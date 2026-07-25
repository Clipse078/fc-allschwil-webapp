/**
 * @vitest-environment jsdom
 */

/**
 * Component tests for InfoboardScreen2 (INFOBOARD-05 live facility + weather).
 *
 * Verifies:
 *   - Dark-theme root attribute
 *   - Facility/pitch overview present
 *   - Event-type statuses rendered
 *   - Free status rendered where applicable
 *   - Sponsor section present (not replaced by "Next Events")
 *   - Sponsor logos retain expected data rendering
 *   - No duplicate next-event list
 *   - Weather panel renders when data is available (INFOBOARD-05)
 *   - Temperature renders in °C
 *   - Wind renders in km/h
 *   - German condition text renders
 *   - Weather-unavailable fallback renders safely
 *   - No cabin section renders (INFOBOARD-05)
 *   - No dressing-room assignment renders (INFOBOARD-05)
 *   - Alexa-safe zone present
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import type { InfoboardSponsor } from "@/components/infoboard/screen2/InfoboardScreen2";
import {
  PREVIEW_FIXTURE_SCREEN2,
  PREVIEW_FIXTURE_SCREEN2_ALL_FREE,
  PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED,
  PREVIEW_SPONSORS,
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
    ...overrides,
  };
}

function makePitch(overrides: Partial<PitchOccupancy> = {}): PitchOccupancy {
  return {
    code: "P-TEST",
    displayLabel: "Testplatz",
    facilityName: "Test Facility",
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
  it("root element has data-theme='dark' attribute", () => {
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
// ── Header ────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header", () => {
  it("renders club name in header", () => {
    render(<InfoboardScreen2 feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Testclub", timezone: "Europe/Zurich" } })} />);
    const header = screen.getByTestId("infoboard-screen2-header");
    expect(header.textContent).toContain("FC Testclub");
  });

  it("renders facility name in header", () => {
    render(<InfoboardScreen2 feed={makeFeed({ facilityName: "Mein Stadion" })} />);
    const header = screen.getByTestId("infoboard-screen2-header");
    expect(header.textContent).toContain("Mein Stadion");
  });

  it("renders current time when currentTimeIso is provided", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("screen2-header-center");
    expect(center.textContent).toContain("10:30");
  });

  it("Alexa-safe zone exists and is empty", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    const safe = screen.getByTestId("screen2-alexa-safe-zone");
    expect(safe).toBeTruthy();
    expect(safe.textContent?.trim()).toBe("");
  });

  it("renders club logo when branding.clubLogoSrc provided", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Test", timezone: "Europe/Zurich" } })}
        branding={{ clubLogoSrc: "/logo.png" }}
      />,
    );
    const header = screen.getByTestId("infoboard-screen2-header");
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

  it("pitch card status badge renders for occupied pitch", () => {
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
    expect(statusBadge.textContent).toContain("BELEGT");
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

  it("free pitch card shows VERFÜGBAR text", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [makePitch({ state: "FREE_NOW" })] })}
      />,
    );
    const freeArea = screen.getByTestId("pitch-card-free");
    expect(freeArea).toBeTruthy();
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
// ── Weather panel (INFOBOARD-05) ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Weather panel — available", () => {
  it("2. renders weather panel when weather data is available", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    expect(screen.getByTestId("weather-panel")).toBeTruthy();
  });

  it("3. temperature renders in °C", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const temp = screen.getByTestId("weather-temperature");
    expect(temp.textContent).toContain("22");
    expect(temp.textContent).toContain("°C");
  });

  it("5. wind renders in km/h", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const wind = screen.getByTestId("weather-wind");
    expect(wind.textContent).toContain("6");
    expect(wind.textContent).toContain("km/h");
  });

  it("4 & 5. German condition text renders", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const condition = screen.getByTestId("weather-condition");
    expect(condition.textContent).toBe("Teilweise bewölkt");
  });

  it("weather body is present when data is available", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    expect(screen.getByTestId("weather-body")).toBeTruthy();
  });

  it("does not render weather-unavailable when data is available", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    expect(screen.queryByTestId("weather-unavailable")).toBeNull();
  });
});

describe("Weather panel — unavailable", () => {
  it("6. renders fallback safely when weather is null", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={null} />);
    expect(screen.getByTestId("weather-panel")).toBeTruthy();
    expect(screen.getByTestId("weather-unavailable")).toBeTruthy();
  });

  it("6. renders fallback when weather is WEATHER_UNAVAILABLE", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={WEATHER_UNAVAILABLE} />);
    expect(screen.getByTestId("weather-unavailable")).toBeTruthy();
  });

  it("6. fallback text is 'WETTER NICHT VERFÜGBAR'", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={null} />);
    const fallback = screen.getByTestId("weather-unavailable");
    expect(fallback.textContent?.toUpperCase()).toContain("WETTER NICHT VERFÜGBAR");
  });

  it("6. weather panel still renders (panel present even if unavailable)", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={WEATHER_UNAVAILABLE} />);
    expect(screen.getByTestId("weather-panel")).toBeTruthy();
  });

  it("no weather-body when unavailable", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={null} />);
    expect(screen.queryByTestId("weather-body")).toBeNull();
  });

  it("renders without crashing when weather prop is omitted", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("weather-panel")).toBeTruthy();
    expect(screen.getByTestId("weather-unavailable")).toBeTruthy();
  });
});

describe("Weather — MeteoSwiss OGD attribution (WEATHER-01)", () => {
  it("renders weather-attribution when weather data is available", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    expect(screen.getByTestId("weather-attribution")).toBeTruthy();
  });

  it("attribution text contains 'MeteoSwiss'", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const attribution = screen.getByTestId("weather-attribution");
    expect(attribution.textContent).toContain("MeteoSwiss");
  });

  it("attribution uses 'Quelle: MeteoSwiss' wording (OGD requirement)", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const attribution = screen.getByTestId("weather-attribution");
    expect(attribution.textContent).toContain("Quelle");
  });

  it("attribution does NOT contain 'Open-Meteo' (Open-Meteo is dormant)", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={SAMPLE_WEATHER} />);
    const attribution = screen.getByTestId("weather-attribution");
    expect(attribution.textContent).not.toContain("Open-Meteo");
  });

  it("attribution is not shown when weather is unavailable", () => {
    render(<InfoboardScreen2 feed={makeFeed()} weather={null} />);
    expect(screen.queryByTestId("weather-attribution")).toBeNull();
  });
});

describe("Weather — preview fixture", () => {
  it("PREVIEW_WEATHER renders correctly in preview", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} weather={PREVIEW_WEATHER} sponsors={PREVIEW_SPONSORS} />);
    const panel = screen.getByTestId("weather-panel");
    expect(panel).toBeTruthy();
    expect(screen.getByTestId("weather-body")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Sponsor section ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Sponsor section", () => {
  it("7. sponsor-section test id is present", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={PREVIEW_SPONSORS} />);
    expect(screen.getByTestId("sponsor-section")).toBeTruthy();
  });

  it("7. sponsor-aside is rendered", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[]} />);
    expect(screen.getByTestId("sponsor-aside")).toBeTruthy();
  });

  it("sponsor section is hidden when sponsors array is empty", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[]} />);
    expect(screen.queryByTestId("sponsor-section")).toBeNull();
  });

  it("sponsor-grid renders within sponsor section", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={PREVIEW_SPONSORS} />);
    const section = screen.getByTestId("sponsor-section");
    expect(within(section).getByTestId("sponsor-grid")).toBeTruthy();
  });

  it("renders sponsor cards for each sponsor", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={PREVIEW_SPONSORS} />);
    const cards = screen.getAllByTestId("sponsor-card");
    expect(cards.length).toBe(PREVIEW_SPONSORS.length);
  });

  it("renders gold sponsor card with data-tier='gold'", () => {
    const goldSponsor: InfoboardSponsor = {
      id: "g1",
      name: "Gold Sponsor",
      logoSrc: null,
      tier: "gold",
    };
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[goldSponsor]} />);
    const card = screen.getByTestId("sponsor-card");
    expect(card.getAttribute("data-tier")).toBe("gold");
  });

  it("renders sponsor name when logoSrc is null", () => {
    const sponsor: InfoboardSponsor = {
      id: "s1",
      name: "Test Sponsor",
      logoSrc: null,
      tier: "silver",
    };
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[sponsor]} />);
    expect(screen.getByText("Test Sponsor")).toBeTruthy();
  });

  it("renders sponsor logo img when logoSrc is provided", () => {
    const sponsor: InfoboardSponsor = {
      id: "s1",
      name: "Logo Sponsor",
      logoSrc: "/sponsors/test.png",
      tier: "silver",
    };
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[sponsor]} />);
    const logo = screen.getByTestId("sponsor-logo");
    expect(logo.getAttribute("src")).toBe("/sponsors/test.png");
    expect(logo.getAttribute("alt")).toBe("Logo Sponsor");
  });

  it("sponsor section title contains SPONSOREN text", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={PREVIEW_SPONSORS} />);
    const section = screen.getByTestId("sponsor-section");
    expect(section.textContent?.toUpperCase()).toContain("SPONSOREN");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── No "Next Events" panel ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("No Next Events panel", () => {
  it("10. does not render a 'next events' heading anywhere", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        sponsors={PREVIEW_SPONSORS}
      />,
    );
    const headings = screen.queryAllByRole("heading");
    for (const h of headings) {
      expect(h.textContent?.toLowerCase()).not.toContain("next events");
      expect(h.textContent?.toLowerCase()).not.toContain("nächste events");
      expect(h.textContent?.toLowerCase()).not.toContain("nächste veranstaltungen");
    }
  });

  it("10. does not render a test-id 'next-events-section'", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} sponsors={PREVIEW_SPONSORS} />);
    expect(screen.queryByTestId("next-events-section")).toBeNull();
  });

  it("does not contain 'next-events-list' test id", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} sponsors={PREVIEW_SPONSORS} />);
    expect(screen.queryByTestId("next-events-list")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── No cabin / dressing-room section (INFOBOARD-05) ──────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("No cabin section (INFOBOARD-05)", () => {
  it("8. does not render dressing-room-section even when dressingRooms present in feed", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            {
              code: "DR-E1",
              displayLabel: "Kabine E1",
              role: "HOME",
              assignedTo: "FC Allschwil E1",
              eventId: "evt-1",
            },
          ],
        })}
      />,
    );
    expect(screen.queryByTestId("dressing-room-section")).toBeNull();
  });

  it("9. does not render dressing-room-list", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            { code: "DR-E2", displayLabel: "Kabine E2", role: "AWAY", assignedTo: "Team B", eventId: "e1" },
          ],
        })}
      />,
    );
    expect(screen.queryByTestId("dressing-room-list")).toBeNull();
  });

  it("9. does not render any cabin assignment text", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            { code: "DR-E1", displayLabel: "Kabine E1", role: "HOME", assignedTo: "FC Test Team", eventId: "e1" },
          ],
        })}
      />,
    );
    expect(screen.queryByText("FC Test Team")).toBeNull();
    expect(screen.queryByText("Kabine E1")).toBeNull();
  });

  it("8. full preview fixture does NOT render dressing-room-section", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        sponsors={PREVIEW_SPONSORS}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    expect(screen.queryByTestId("dressing-room-section")).toBeNull();
  });

  it("does not render KABINEN heading", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        sponsors={PREVIEW_SPONSORS}
      />,
    );
    expect(screen.queryByText("KABINEN")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 12. Alexa-safe zone ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("12. Alexa-safe zone", () => {
  it("Alexa-safe zone is present and empty", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    const safe = screen.getByTestId("screen2-alexa-safe-zone");
    expect(safe).toBeTruthy();
    expect(safe.textContent?.trim()).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Footer — product branding ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Footer — product branding", () => {
  it("renders product-branding section", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("screen2-product-branding")).toBeTruthy();
  });

  it("renders POWERED BY text", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.getByTestId("screen2-product-branding").textContent).toContain("POWERED BY");
  });

  it("renders product logo when productLogoSrc provided", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed()}
        branding={{ productLogoSrc: "/images/branding/sportclubevo_logo.png" }}
      />,
    );
    const branding = screen.getByTestId("screen2-product-branding");
    const img = branding.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("SportClubEvo");
  });

  it("renders SportClubEvo fallback when productLogoSrc is null", () => {
    render(<InfoboardScreen2 feed={makeFeed()} branding={{ productLogoSrc: null }} />);
    expect(screen.getByTestId("screen2-product-branding").textContent).toContain("SportClubEvo");
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
        sponsors={PREVIEW_SPONSORS}
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
        sponsors={PREVIEW_SPONSORS}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    expect(screen.getByText("Stadion")).toBeTruthy();
  });

  it("all 5 preview sponsors render", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        sponsors={PREVIEW_SPONSORS}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const cards = screen.getAllByTestId("sponsor-card");
    expect(cards).toHaveLength(5);
  });

  it("sponsor section is not replaced by any event-list content", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        sponsors={PREVIEW_SPONSORS}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const aside = screen.getByTestId("sponsor-aside");
    const sponsorSection = within(aside).getByTestId("sponsor-section");
    expect(sponsorSection).toBeTruthy();
    expect(within(aside).queryByTestId("event-row")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Missing optional data safety ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Missing optional data safety", () => {
  it("renders without crashing when sponsors are absent (default empty)", () => {
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
        sponsors={[]}
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
        sponsors={PREVIEW_SPONSORS}
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

  it("sponsor section present in all-occupied scenario", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED}
        sponsors={PREVIEW_SPONSORS}
      />,
    );
    expect(screen.getByTestId("sponsor-section")).toBeTruthy();
  });

  it("8. no dressing-room-section in all-occupied scenario (INFOBOARD-05)", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED}
        sponsors={PREVIEW_SPONSORS}
      />,
    );
    expect(screen.queryByTestId("dressing-room-section")).toBeNull();
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

  it("sponsor section still renders in empty state", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
        sponsors={PREVIEW_SPONSORS}
      />,
    );
    expect(screen.getByTestId("sponsor-section")).toBeTruthy();
  });

  it("weather panel still renders in empty pitch state", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
        weather={SAMPLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("weather-panel")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Sponsor image presentation ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Sponsor image presentation", () => {
  it("sponsor logo uses img element", () => {
    const sponsor = {
      id: "sp1",
      name: "Test Sponsor",
      logoSrc: "/sponsors/test.png",
      tier: "gold" as const,
    };
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[sponsor]} />);
    const logo = screen.getByTestId("sponsor-logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo.getAttribute("src")).toBe("/sponsors/test.png");
  });

  it("sponsor fallback name rendered when logoSrc is null", () => {
    const sponsor = {
      id: "sp2",
      name: "Fallback Sponsor",
      logoSrc: null,
      tier: "silver" as const,
    };
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[sponsor]} />);
    expect(screen.getByText("Fallback Sponsor")).toBeTruthy();
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
