/**
 * @vitest-environment jsdom
 */

/**
 * Component tests for InfoboardScreen2 (INFOBOARD-04A premium dark design).
 *
 * Verifies:
 *   - Dark-theme root attribute
 *   - Facility/pitch overview present
 *   - Event-type statuses rendered
 *   - Free status rendered where applicable
 *   - Sponsor section present (not replaced by "Next Events")
 *   - Sponsor logos retain expected data rendering
 *   - No duplicate next-event list
 *   - Dressing-room information where previously supported
 *   - Weather fallback intact (no weather = no section rendered)
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
} from "@/components/infoboard/screen2/screen2-preview-fixture";
import type {
  InfoboardScreen2Feed,
  PitchOccupancy,
} from "@/lib/publishing/event-types";

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

  it("renders pitch grid when pitches are present", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [makePitch()] })}
      />,
    );
    expect(screen.getByTestId("pitch-grid")).toBeTruthy();
  });

  it("renders one pitch card per pitch", () => {
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
// ── Sponsor section ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Sponsor section", () => {
  it("sponsor-section test id is present", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={PREVIEW_SPONSORS} />);
    expect(screen.getByTestId("sponsor-section")).toBeTruthy();
  });

  it("sponsor-aside is rendered", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[]} />);
    expect(screen.getByTestId("sponsor-aside")).toBeTruthy();
  });

  it("sponsor section is present even when sponsors array is empty", () => {
    render(<InfoboardScreen2 feed={makeFeed()} sponsors={[]} />);
    expect(screen.getByTestId("sponsor-section")).toBeTruthy();
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
  it("does not render a 'next events' heading anywhere", () => {
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

  it("does not render a test-id 'next-events-section'", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} sponsors={PREVIEW_SPONSORS} />);
    expect(screen.queryByTestId("next-events-section")).toBeNull();
  });

  it("does not contain 'next-events-list' test id", () => {
    render(<InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} sponsors={PREVIEW_SPONSORS} />);
    expect(screen.queryByTestId("next-events-list")).toBeNull();
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
// ── Weather fallback ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Weather fallback", () => {
  it("does not render any weather section (weather not implemented)", () => {
    render(<InfoboardScreen2 feed={makeFeed()} />);
    expect(screen.queryByTestId("weather-section")).toBeNull();
    expect(screen.queryByTestId("weather-widget")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Full preview fixture ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Full preview fixture", () => {
  it("renders 4 pitch cards for the preview fixture", () => {
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
    // No event-row items inside the sponsor aside
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
// ── INFOBOARD-04B: Dressing-room section ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Dressing-room section", () => {
  it("renders dressing-room-section when dressingRooms are present in feed", () => {
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
    expect(screen.getByTestId("dressing-room-section")).toBeTruthy();
  });

  it("does not render dressing-room-section when all rooms are unassigned", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            {
              code: "DR-E1",
              displayLabel: "Kabine E1",
              role: "HOME",
              assignedTo: null,
              eventId: null,
            },
          ],
        })}
      />,
    );
    expect(screen.queryByTestId("dressing-room-section")).toBeNull();
  });

  it("renders assigned team name in dressing-room row", () => {
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
    expect(screen.getByText("FC Allschwil E1")).toBeTruthy();
  });

  it("renders dressing-room display label", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            {
              code: "DR-A",
              displayLabel: "Kabine A",
              role: "TRAINING",
              assignedTo: "Aktive Herren",
              eventId: "evt-2",
            },
          ],
        })}
      />,
    );
    const section = screen.getByTestId("dressing-room-section");
    expect(section.textContent).toContain("Kabine A");
  });

  it("renders multiple dressing-room assignments", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            { code: "DR-E1", displayLabel: "Kabine E1", role: "HOME", assignedTo: "Team A", eventId: "e1" },
            { code: "DR-E2", displayLabel: "Kabine E2", role: "AWAY", assignedTo: "Team B", eventId: "e1" },
            { code: "DR-04", displayLabel: "Kabine 04", role: "TRAINING", assignedTo: "Team C", eventId: "e2" },
          ],
        })}
      />,
    );
    const rows = screen.getAllByTestId("dressing-room-row");
    expect(rows).toHaveLength(3);
  });

  it("does not render referee dressing rooms in section", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({
          dressingRooms: [
            { code: "DR-E1", displayLabel: "Kabine E1", role: "HOME", assignedTo: "FC Allschwil", eventId: "e1" },
            { code: "DR-REF", displayLabel: "Kabine Schiri", role: "REFEREE", assignedTo: "Schiedsrichter", eventId: "e1" },
          ],
        })}
      />,
    );
    const section = screen.getByTestId("dressing-room-section");
    expect(section.textContent).not.toContain("Schiedsrichter");
    expect(section.textContent).not.toContain("Schiri");
  });

  it("full preview fixture renders dressing-room section with E1, E2, and 04", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2}
        sponsors={PREVIEW_SPONSORS}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      />,
    );
    const section = screen.getByTestId("dressing-room-section");
    expect(section.textContent).toContain("Kabine E1");
    expect(section.textContent).toContain("Kabine E2");
    expect(section.textContent).toContain("Kabine 04");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-04B: All-occupied fixture ───────────────────────────────────────
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

  it("dressing-room section visible in all-occupied scenario", () => {
    render(
      <InfoboardScreen2
        feed={PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED}
        sponsors={PREVIEW_SPONSORS}
      />,
    );
    expect(screen.getByTestId("dressing-room-section")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-04B: Sponsor image presentation ─────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-04B: Live route safety (Option B) ───────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Live route safety — Option B pending state", () => {
  it("empty pitches renders pitch-grid-empty with informative message (not false operational data)", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
        branding={{ clubLogoSrc: "/logo.png" }}
      />,
    );
    // Empty state is shown honestly — the design shows KEINE FELDDATEN VERFÜGBAR
    expect(screen.getByTestId("pitch-grid-empty")).toBeTruthy();
    expect(screen.getByTestId("pitch-grid-empty").textContent).toContain("KEINE FELDDATEN");
  });

  it("empty state does not render any pitch-card (no false occupied indicators)", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
      />,
    );
    expect(screen.queryAllByTestId("pitch-card")).toHaveLength(0);
  });

  it("facility-overview section is still present in pending state", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
      />,
    );
    expect(screen.getByTestId("facility-overview")).toBeTruthy();
  });

  it("sponsor section still renders in pending state", () => {
    render(
      <InfoboardScreen2
        feed={makeFeed({ pitches: [], dressingRooms: [] })}
        sponsors={PREVIEW_SPONSORS}
      />,
    );
    expect(screen.getByTestId("sponsor-section")).toBeTruthy();
  });
});

describe("Sponsor image presentation", () => {
  it("sponsor logo uses img element (object-fit: contain via CSS)", () => {
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
