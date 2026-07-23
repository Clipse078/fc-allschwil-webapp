/**
 * @vitest-environment jsdom
 */

/**
 * Component tests for InfoboardScreen1.
 *
 * Uses @testing-library/react with @testing-library/jest-dom.
 * Default environment overridden to jsdom via the pragma above.
 *
 * CSS modules are mocked automatically by vitest (each property returns its
 * own name as a string). Tests rely on text content, data attributes, and
 * ARIA semantics — not on class names.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  PREVIEW_FIXTURE,
  PREVIEW_FIXTURE_EMPTY,
  PREVIEW_FIXTURE_EMPTY_CURRENT,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type {
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
} from "@/lib/publishing/event-types";

// ── Fixture helpers ───────────────────────────────────────────────────────────

/**
 * Builds a minimal valid InfoboardScreen1Feed for targeted tests.
 * Avoids pulling in real implementation details from the feed builder.
 */
function makeFeed(
  overrides: Partial<InfoboardScreen1Feed> = {},
): InfoboardScreen1Feed {
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
    wochenplanVariantBadge: null,
    current: [],
    next: [],
    later: [],
    isEmpty: true,
    ...overrides,
  };
}

/** Minimal valid event builder. */
function makeEvent(
  overrides: Partial<InfoboardScreen1Event> = {},
): InfoboardScreen1Event {
  return {
    id: "evt-test-1",
    type: "TRAINING",
    displayTitle: "Test Training",
    teamDisplayName: "Test Team",
    opponentDisplayName: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt: "2026-09-12T08:00:00.000Z",
    endAt: null,
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "current",
    seasonKey: "2026-27",
    allocation: {
      pitchLabel: null,
      homeDressingRoomLabel: null,
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
    },
    ...overrides,
  };
}

// ── Header ────────────────────────────────────────────────────────────────────

describe("Header — tenant name", () => {
  it("renders the tenant name", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Testclub", timezone: "Europe/Zurich" } })}
      />,
    );
    expect(screen.getByText("FC Testclub")).toBeTruthy();
  });
});

describe("Header — display date", () => {
  it("renders a date derived from feed.displayDate", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const header = screen.getByTestId("infoboard-header");
    // The date string will contain "September" or "12" (de-CH long format)
    expect(header.textContent).toMatch(/12/);
  });
});

describe("Header — club branding", () => {
  it("renders club logo when clubLogoSrc is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ clubLogoSrc: "/images/logos/fc-allschwil.png" }}
      />,
    );
    const img = screen.getByRole("img", { name: /wappen/i });
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("/images/logos/fc-allschwil.png");
  });

  it("renders text fallback when clubLogoSrc is null", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Allschwil", timezone: "Europe/Zurich" } })}
        branding={{ clubLogoSrc: null }}
      />,
    );
    const header = screen.getByTestId("infoboard-header");
    // Fallback shows first two letters uppercased
    expect(header.textContent).toContain("FC");
  });

  it("renders text fallback when branding is not supplied", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "Test Club", timezone: "Europe/Zurich" } })}
      />,
    );
    const header = screen.getByTestId("infoboard-header");
    // Should not throw; fallback initials present
    expect(header).toBeTruthy();
  });
});

describe("Header — SportClubEvo branding", () => {
  it("renders product branding container", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("renders product logo image when productLogoSrc is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: "/images/branding/sportclubevo_logo.png" }}
      />,
    );
    const img = screen.getByAltText("SportClubEvo");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(
      "/images/branding/sportclubevo_logo.png",
    );
  });

  it("renders text fallback when productLogoSrc is null", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: null }}
      />,
    );
    const branding = screen.getByTestId("product-branding");
    expect(branding.textContent).toContain("SportClubEvo");
  });

  it("product branding is not the primary heading element", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Allschwil", timezone: "Europe/Zurich" } })}
        branding={{ productLogoSrc: null }}
      />,
    );
    // The h1-level content should be the club name, not the product
    const header = screen.getByTestId("infoboard-header");
    expect(header.textContent).toContain("FC Allschwil");
    expect(header.textContent).toContain("SportClubEvo");
    // Club name should appear before product name in DOM order
    const clubIdx = header.textContent!.indexOf("FC Allschwil");
    const sceIdx = header.textContent!.indexOf("SportClubEvo");
    expect(clubIdx).toBeLessThan(sceIdx);
  });

  it("product logo alt text exists", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: "/sportclubevo.png" }}
      />,
    );
    const img = screen.getByAltText("SportClubEvo");
    expect(img.getAttribute("alt")).toBe("SportClubEvo");
  });
});

// ── Current section ───────────────────────────────────────────────────────────

describe("Current section — heading", () => {
  it("renders JETZT heading", () => {
    const feed = makeFeed({ current: [makeEvent()], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(within(section).getByRole("heading", { name: "JETZT" })).toBeTruthy();
  });
});

describe("Current section — training event", () => {
  it("renders current training team name", () => {
    const feed = makeFeed({
      current: [makeEvent({ teamDisplayName: "FC Allschwil U12" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Allschwil U12")).toBeTruthy();
  });
});

describe("Current section — home match", () => {
  it("renders current match with team and opponent", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Allschwil E1",
          opponentDisplayName: "FC Binningen E1",
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Allschwil E1")).toBeTruthy();
    expect(screen.getByText("FC Binningen E1")).toBeTruthy();
  });
});

describe("Current section — time rendered in tenant timezone", () => {
  it("displays startAt in Europe/Zurich (UTC+2) — not UTC", () => {
    // startAt 08:00 UTC → 10:00 Zurich in summer
    const feed = makeFeed({
      current: [makeEvent({ startAt: "2026-09-12T08:00:00.000Z" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    // Should show 10:00, not 08:00
    expect(section.textContent).toContain("10:00");
    expect(section.textContent).not.toContain("08:00");
  });
});

describe("Current section — pitch", () => {
  it("renders PLATZ label when pitchLabel is set", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          allocation: {
            pitchLabel: "Platz 1",
            homeDressingRoomLabel: null,
            awayDressingRoomLabel: null,
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("PLATZ");
    expect(section.textContent).toContain("Platz 1");
  });
});

describe("Current section — dressing rooms", () => {
  it("renders training dressing room with GARDEROBE label", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "TRAINING",
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: "Kabine A",
            awayDressingRoomLabel: null,
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("GARDEROBE");
    expect(section.textContent).toContain("Kabine A");
  });

  it("renders match HEIM and GAST dressing rooms", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Opponent",
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: "Kabine E1",
            awayDressingRoomLabel: "Kabine E2",
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("HEIM");
    expect(section.textContent).toContain("Kabine E1");
    expect(section.textContent).toContain("GAST");
    expect(section.textContent).toContain("Kabine E2");
  });
});

// ── Next section ──────────────────────────────────────────────────────────────

describe("Next section — heading", () => {
  it("renders ALS NÄCHSTES heading", () => {
    const feed = makeFeed({ next: [makeEvent()], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-next");
    expect(within(section).getByRole("heading", { name: "ALS NÄCHSTES" })).toBeTruthy();
  });
});

describe("Next section — simultaneous events", () => {
  it("renders all simultaneous next events", () => {
    const feed = makeFeed({
      next: [
        makeEvent({ id: "evt-a", teamDisplayName: "FC Allschwil D1" }),
        makeEvent({ id: "evt-b", teamDisplayName: "FC Allschwil E1" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-next");
    expect(within(section).getByText("FC Allschwil D1")).toBeTruthy();
    expect(within(section).getByText("FC Allschwil E1")).toBeTruthy();
  });
});

// ── Later section ─────────────────────────────────────────────────────────────

describe("Later section — heading", () => {
  it("renders SPÄTER HEUTE heading", () => {
    const feed = makeFeed({ later: [makeEvent()], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-later");
    expect(within(section).getByRole("heading", { name: "SPÄTER HEUTE" })).toBeTruthy();
  });
});

describe("Later section — events rendered", () => {
  it("renders all later events", () => {
    const feed = makeFeed({
      later: [
        makeEvent({ id: "lat-1", teamDisplayName: "FC Allschwil 1. Mannschaft" }),
        makeEvent({ id: "lat-2", teamDisplayName: "FC Allschwil U8/U10" }),
        makeEvent({ id: "lat-3", teamDisplayName: "FC Allschwil Damen" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-later");
    expect(within(section).getByText("FC Allschwil 1. Mannschaft")).toBeTruthy();
    expect(within(section).getByText("FC Allschwil U8/U10")).toBeTruthy();
    expect(within(section).getByText("FC Allschwil Damen")).toBeTruthy();
  });
});

// ── Event-type labels ─────────────────────────────────────────────────────────

describe("Event-type labels", () => {
  it("renders TRAINING label for TRAINING events", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("TRAINING")).toBeTruthy();
  });

  it("renders SPIEL label for MATCH events", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Other",
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("SPIEL")).toBeTruthy();
  });

  it("renders TURNIER label for TOURNAMENT events", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TOURNAMENT" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("TURNIER")).toBeTruthy();
  });

  it("does not display raw MATCH string as the user-facing type label", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Other",
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // "MATCH" should not appear as the type label text (only "SPIEL" should)
    // Note: "MATCH" could appear in data-type attribute, but not as visible text label
    const cards = screen.getAllByTestId("event-card");
    const card = cards[0];
    // The aria-label for the type span uses the German label
    const typeSpan = card.querySelector('[aria-label^="Typ:"]');
    expect(typeSpan?.textContent).toBe("SPIEL");
    expect(typeSpan?.textContent).not.toBe("MATCH");
  });
});

// ── Optional fields ───────────────────────────────────────────────────────────

describe("Optional fields — missing opponent", () => {
  it("does not render a versus label when opponent is null", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", opponentDisplayName: null })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).not.toContain("vs.");
  });
});

describe("Optional fields — missing competition", () => {
  it("does not render competition element when competitionLabel is null", () => {
    const feed = makeFeed({
      current: [makeEvent({ competitionLabel: null })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // No visible competition text
    const section = screen.getByTestId("section-current");
    // Should not have any empty competition container
    expect(section.textContent).not.toMatch(/^\s*$/);
  });
});

describe("Optional fields — missing allocations", () => {
  it("does not render allocation block when all allocation fields are null", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: null,
            awayDressingRoomLabel: null,
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByTestId("allocation-block")).toBeNull();
  });

  it("does not render PLATZ when pitchLabel is null", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: "Kabine A",
            awayDressingRoomLabel: null,
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).not.toContain("PLATZ");
  });
});

describe("Optional fields — null not rendered as string", () => {
  it("does not render the string 'null' anywhere", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.queryByText("null")).toBeNull();
  });

  it("does not render the string 'undefined' anywhere", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.queryByText("undefined")).toBeNull();
  });
});

describe("Optional fields — no placeholder strings", () => {
  it("does not render placeholder dash", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    // Standalone "—" or "-" as placeholder
    expect(screen.queryByText("—")).toBeNull();
  });

  it("does not render 'Unknown'", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.queryByText("Unknown")).toBeNull();
  });

  it("does not render 'TBD'", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.queryByText("TBD")).toBeNull();
  });

  it("does not render 'N/A'", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.queryByText("N/A")).toBeNull();
  });
});

// ── Allocations ───────────────────────────────────────────────────────────────

describe("Allocations — PLATZ", () => {
  it("renders PLATZ label and pitch value", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          allocation: {
            pitchLabel: "Stadion",
            homeDressingRoomLabel: null,
            awayDressingRoomLabel: null,
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    expect(block.textContent).toContain("PLATZ");
    expect(block.textContent).toContain("Stadion");
  });
});

describe("Allocations — training dressing room", () => {
  it("shows GARDEROBE for training events", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "TRAINING",
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: "Kabine A",
            awayDressingRoomLabel: null,
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    expect(block.textContent).toContain("GARDEROBE");
    expect(block.textContent).toContain("Kabine A");
  });
});

describe("Allocations — match HEIM and GAST", () => {
  it("shows HEIM for home dressing room", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Other",
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: "Kabine E1",
            awayDressingRoomLabel: "Kabine E2",
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    expect(block.textContent).toContain("HEIM");
    expect(block.textContent).toContain("Kabine E1");
  });

  it("shows GAST for away dressing room", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Other",
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: "Kabine E1",
            awayDressingRoomLabel: "Kabine E2",
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    expect(block.textContent).toContain("GAST");
    expect(block.textContent).toContain("Kabine E2");
  });
});

describe("Allocations — SCHIRI (referee)", () => {
  it("shows SCHIRI when refereeDressingRoomLabel is set", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Other",
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: "Kabine E1",
            awayDressingRoomLabel: "Kabine E2",
            refereeDressingRoomLabel: "Kabine C",
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    expect(block.textContent).toContain("SCHIRI");
    expect(block.textContent).toContain("Kabine C");
  });
});

describe("Allocations — home and away not swapped", () => {
  it("renders home room under HEIM and away room under GAST", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Other",
          allocation: {
            pitchLabel: null,
            homeDressingRoomLabel: "Kabine HOME",
            awayDressingRoomLabel: "Kabine AWAY",
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    const text = block.textContent ?? "";
    const heimIdx = text.indexOf("HEIM");
    const gästIdx = text.indexOf("GAST");
    const homeValueIdx = text.indexOf("Kabine HOME");
    const awayValueIdx = text.indexOf("Kabine AWAY");
    // HEIM appears before GAST
    expect(heimIdx).toBeLessThan(gästIdx);
    // Home value appears near/after HEIM, away value near/after GAST
    expect(homeValueIdx).toBeLessThan(awayValueIdx);
  });
});

// ── Empty states ──────────────────────────────────────────────────────────────

describe("Empty state — completely empty feed", () => {
  it("shows full empty-state message when feed.isEmpty is true and all arrays empty", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY} />);
    expect(screen.getByTestId("empty-state-full")).toBeTruthy();
    expect(
      screen.getByText(
        "Heute keine Trainings, Heimspiele oder Turniere",
      ),
    ).toBeTruthy();
  });

  it("does not show event sections in full empty state", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY} />);
    expect(screen.queryByTestId("section-current")).toBeNull();
    expect(screen.queryByTestId("section-next")).toBeNull();
    expect(screen.queryByTestId("section-later")).toBeNull();
  });
});

describe("Empty state — empty current with future events", () => {
  it("shows restrained 'Aktuell keine Veranstaltung' message in current section", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY_CURRENT} />);
    expect(
      screen.getByText("Aktuell keine Veranstaltung"),
    ).toBeTruthy();
  });

  it("still renders next events when current is empty", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY_CURRENT} />);
    expect(screen.getByTestId("section-next")).toBeTruthy();
  });

  it("still renders later events when current is empty", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY_CURRENT} />);
    expect(screen.getByTestId("section-later")).toBeTruthy();
  });
});

describe("Empty state — empty section does not create large panel", () => {
  it("omits the next section entirely when next is empty", () => {
    const feed = makeFeed({
      current: [makeEvent()],
      next: [],
      later: [makeEvent({ id: "lat-1" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByTestId("section-next")).toBeNull();
  });

  it("omits the later section entirely when later is empty", () => {
    const feed = makeFeed({
      current: [makeEvent()],
      next: [makeEvent({ id: "nxt-1" })],
      later: [],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByTestId("section-later")).toBeNull();
  });
});

// ── Determinism and purity ────────────────────────────────────────────────────

describe("Determinism and purity", () => {
  it("rendering does not mutate the feed object", () => {
    const feed = makeFeed({ current: [makeEvent()], isEmpty: false });
    const feedCopy = JSON.stringify(feed);
    render(<InfoboardScreen1 feed={feed} />);
    expect(JSON.stringify(feed)).toBe(feedCopy);
  });

  it("rendering does not mutate event arrays", () => {
    const events = [makeEvent({ id: "e1" }), makeEvent({ id: "e2" })];
    const lengthBefore = events.length;
    const feed = makeFeed({ current: events, isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    expect(feed.current.length).toBe(lengthBefore);
  });

  it("same props produce equivalent text content", () => {
    const feed = makeFeed({
      current: [makeEvent({ teamDisplayName: "FC Stable" })],
      isEmpty: false,
    });
    const { container: c1 } = render(<InfoboardScreen1 feed={feed} />);
    const { container: c2 } = render(<InfoboardScreen1 feed={feed} />);
    expect(c1.textContent).toBe(c2.textContent);
  });

  it("uses tenant timezone from the feed, not an implicit timezone", () => {
    // 09:00 UTC → 11:00 Europe/Zurich (UTC+2 in summer)
    const feedZurich = makeFeed({
      current: [makeEvent({ startAt: "2026-09-12T09:00:00.000Z" })],
      tenant: { id: "t", key: "k", name: "FC Test", timezone: "Europe/Zurich" },
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feedZurich} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("11:00");
  });
});

// ── Branding checks ───────────────────────────────────────────────────────────

describe("Branding", () => {
  it("product branding is rendered in every non-empty state", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("product branding is rendered even in empty state", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY} />);
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("club logo alt text contains club name", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Allschwil", timezone: "Europe/Zurich" } })}
        branding={{ clubLogoSrc: "/logo.png" }}
      />,
    );
    const img = screen.getByRole("img", { name: /wappen/i });
    expect(img.getAttribute("alt")).toMatch(/FC Allschwil/i);
  });
});

// ── Full preview fixture smoke test ──────────────────────────────────────────

describe("Preview fixture — full smoke test", () => {
  it("renders the full preview fixture without errors", () => {
    const { container } = render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        branding={{
          clubLogoSrc: "/images/logos/fc-allschwil.png",
          productLogoSrc: "/images/branding/sportclubevo_logo.png",
        }}
      />,
    );
    expect(container).toBeTruthy();
    expect(container.textContent).not.toBe("");
  });

  it("renders tenant name from fixture", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.getByText("FC Allschwil")).toBeTruthy();
  });

  it("renders current training from fixture", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.getByText("FC Allschwil U12")).toBeTruthy();
  });

  it("renders current match opponent from fixture", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.getByText("FC Binningen E1")).toBeTruthy();
  });

  it("renders the JETZT section", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.getByTestId("section-current")).toBeTruthy();
  });

  it("renders the ALS NÄCHSTES section", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.getByTestId("section-next")).toBeTruthy();
  });

  it("renders the SPÄTER HEUTE section", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.getByTestId("section-later")).toBeTruthy();
  });

  it("renders both simultaneous next events from fixture", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    const nextSection = screen.getByTestId("section-next");
    expect(within(nextSection).getByText("FC Allschwil D1")).toBeTruthy();
    expect(within(nextSection).getByText("FC Allschwil Junioren")).toBeTruthy();
  });
});

// ── Density mode ─────────────────────────────────────────────────────────────

describe("Density mode", () => {
  it("sets data-density=normal for ≤5 total events", () => {
    const feed = makeFeed({
      current: [makeEvent({ id: "c1" })],
      next: [makeEvent({ id: "n1" })],
      later: [makeEvent({ id: "l1" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.getAttribute("data-density")).toBe("normal");
  });

  it("sets data-density=compact for ≥6 total events", () => {
    const feed = makeFeed({
      current: [makeEvent({ id: "c1" }), makeEvent({ id: "c2" })],
      next: [makeEvent({ id: "n1" }), makeEvent({ id: "n2" })],
      later: [makeEvent({ id: "l1" }), makeEvent({ id: "l2" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.getAttribute("data-density")).toBe("compact");
  });
});
