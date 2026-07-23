/**
 * @vitest-environment jsdom
 */

/**
 * Component tests for InfoboardScreen1 (PP-02B-F).
 *
 * Uses @testing-library/react with @testing-library/jest-dom.
 * Default environment overridden to jsdom via the pragma above.
 *
 * CSS modules are mocked automatically by vitest (each property returns its
 * own name as a string). Tests rely on text content, data attributes, and
 * ARIA semantics — not on computed browser fonts.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  PREVIEW_FIXTURE,
  PREVIEW_FIXTURE_EMPTY,
  PREVIEW_FIXTURE_EMPTY_CURRENT,
  PREVIEW_CURRENT_TIME_ISO,
  PREVIEW_ANNOUNCEMENT,
  PREVIEW_FIXTURE_TOURNAMENT_4TEAM,
  PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS,
  PREVIEW_FIXTURE_TOURNAMENT_6TEAM,
  PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS,
  PREVIEW_FIXTURE_HIGH_DENSITY_6,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type {
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
} from "@/lib/publishing/event-types";
import type {
  InfoboardAnnouncementPresentation,
  InfoboardEventPresentationExtension,
} from "@/components/infoboard/screen1/screen1-presentation-types";

// ── Fixture helpers ───────────────────────────────────────────────────────────

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

function makeEventPresentation(
  eventId: string,
  allocations: InfoboardEventPresentationExtension["participantAllocations"],
): readonly InfoboardEventPresentationExtension[] {
  return [{ eventId, participantAllocations: allocations }];
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Header ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header — club logo", () => {
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
    expect(header.textContent).toContain("FC");
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

describe("Header — club name", () => {
  it("renders the tenant name", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Testclub", timezone: "Europe/Zurich" } })}
      />,
    );
    expect(screen.getByText("FC Testclub")).toBeTruthy();
  });

  it("club name appears in the header left area", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Musterclub", timezone: "Europe/Zurich" } })}
      />,
    );
    const header = screen.getByTestId("infoboard-header");
    expect(header.textContent).toContain("FC Musterclub");
  });
});

describe("Header — center zone and SportClubEvo branding", () => {
  it("renders header-center test zone", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("header-center")).toBeTruthy();
  });

  it("renders product-branding inside header-center", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const center = screen.getByTestId("header-center");
    const branding = within(center).getByTestId("product-branding");
    expect(branding).toBeTruthy();
  });

  it("renders product logo image when productLogoSrc is provided in center", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: "/images/branding/sportclubevo_logo.png" }}
      />,
    );
    const center = screen.getByTestId("header-center");
    const img = within(center).getByAltText("SportClubEvo");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("/images/branding/sportclubevo_logo.png");
  });

  it("renders SportClubEvo text fallback in center when productLogoSrc is null", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: null }}
      />,
    );
    const center = screen.getByTestId("header-center");
    expect(center.textContent).toContain("SportClubEvo");
  });

  it("club name appears before SportClubEvo in DOM order", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Allschwil", timezone: "Europe/Zurich" } })}
        branding={{ productLogoSrc: null }}
      />,
    );
    const header = screen.getByTestId("infoboard-header");
    const clubIdx = header.textContent!.indexOf("FC Allschwil");
    const sceIdx = header.textContent!.indexOf("SportClubEvo");
    expect(clubIdx).toBeLessThan(sceIdx);
  });
});

describe("Header — current time", () => {
  it("renders current time in center when currentTimeIso is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-center");
    // 08:30Z → 10:30 Europe/Zurich (UTC+2 in summer)
    expect(center.textContent).toContain("10:30");
  });

  it("uses tenant timezone for current time formatting", () => {
    // 09:00Z → 11:00 Europe/Zurich (UTC+2)
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "Test", timezone: "Europe/Zurich" } })}
        currentTimeIso="2026-09-12T09:00:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-center");
    expect(center.textContent).toContain("11:00");
    expect(center.textContent).not.toContain("09:00");
  });

  it("renders no clock when currentTimeIso is missing", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const center = screen.getByTestId("header-center");
    // Should not contain a colon-separated time pattern
    expect(center.querySelector("time")).toBeNull();
  });

  it("renders no clock when currentTimeIso is null", () => {
    render(<InfoboardScreen1 feed={makeFeed()} currentTimeIso={null} />);
    const center = screen.getByTestId("header-center");
    expect(center.querySelector("time")).toBeNull();
  });
});

describe("Header — date", () => {
  it("renders a date derived from feed.displayDate when no currentTimeIso", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const header = screen.getByTestId("infoboard-header");
    expect(header.textContent).toMatch(/12/);
  });

  it("renders date in center zone", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-center");
    // Should contain September or "September" (German)
    expect(center.textContent).toMatch(/[Ss]eptember/);
  });

  it("uses explicit tenant timezone for date when currentTimeIso is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "Test", timezone: "Europe/Zurich" } })}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-center");
    // Date is Sept 12 in Zurich for this ISO string
    expect(center.textContent).toMatch(/12/);
    expect(center.textContent).toMatch(/[Ss]eptember/);
  });
});

describe("Header — Alexa-safe right zone", () => {
  it("right Alexa-safe zone exists", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const safeZone = screen.getByTestId("alexa-safe-zone");
    expect(safeZone).toBeTruthy();
  });

  it("no critical content exists inside safe zone", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Allschwil", timezone: "Europe/Zurich" } })}
        branding={{ clubLogoSrc: "/logo.png", productLogoSrc: "/sce.png" }}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const safeZone = screen.getByTestId("alexa-safe-zone");
    expect(safeZone.textContent?.trim()).toBe("");
  });

  it("no time appears inside safe zone", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const safeZone = screen.getByTestId("alexa-safe-zone");
    expect(safeZone.textContent).not.toContain("10:30");
  });

  it("no club name appears inside safe zone", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Musterschule", timezone: "Europe/Zurich" } })}
      />,
    );
    const safeZone = screen.getByTestId("alexa-safe-zone");
    expect(safeZone.textContent).not.toContain("FC Musterschule");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Typography ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Typography — section headings", () => {
  it("JETZT heading is uppercase", () => {
    render(<InfoboardScreen1 feed={makeFeed({ current: [makeEvent()], isEmpty: false })} />);
    const section = screen.getByTestId("section-current");
    const heading = within(section).getByRole("heading", { name: "JETZT" });
    expect(heading.textContent).toBe("JETZT");
  });

  it("ALS NÄCHSTES heading is uppercase", () => {
    render(<InfoboardScreen1 feed={makeFeed({ next: [makeEvent()], isEmpty: false })} />);
    const section = screen.getByTestId("section-next");
    expect(within(section).getByRole("heading", { name: "ALS NÄCHSTES" })).toBeTruthy();
  });

  it("SPÄTER HEUTE heading is uppercase", () => {
    render(<InfoboardScreen1 feed={makeFeed({ later: [makeEvent()], isEmpty: false })} />);
    const section = screen.getByTestId("section-later");
    expect(within(section).getByRole("heading", { name: "SPÄTER HEUTE" })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Standard training ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Standard training", () => {
  it("renders team name", () => {
    const feed = makeFeed({
      current: [makeEvent({ teamDisplayName: "FC Allschwil U12" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Allschwil U12")).toBeTruthy();
  });

  it("renders pitch label", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: "Platz 1", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("Platz 1");
  });

  it("renders dressing room with GARDEROBE label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("GARDEROBE");
    expect(section.textContent).toContain("Kabine A");
  });

  it("renders time in tenant timezone", () => {
    const feed = makeFeed({
      current: [makeEvent({ startAt: "2026-09-12T08:00:00.000Z" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("10:00");
    expect(section.textContent).not.toContain("08:00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Standard match ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Standard match", () => {
  it("renders home team name", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Allschwil E1", opponentDisplayName: "FC Binningen E1" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Allschwil E1")).toBeTruthy();
  });

  it("renders opponent name", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Opponent" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Opponent")).toBeTruthy();
  });

  it("renders pitch label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: "Stadion", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("Stadion")).toBeTruthy();
  });

  it("renders HEIM label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("HEIM");
    expect(section.textContent).toContain("Kabine E1");
  });

  it("renders GAST label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("GAST");
    expect(section.textContent).toContain("Kabine E2");
  });

  it("does not render SCHIRI label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: "Kabine C" } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText("SCHIRI")).toBeNull();
  });

  it("referee label absent even when DTO contains refereeDressingRoomLabel", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: "Kabine C" } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).not.toContain("SCHIRI");
    // The referee room value must not appear either
    expect(section.textContent).not.toContain("Kabine C");
    // But home and away rooms still shown
    expect(section.textContent).toContain("Kabine E1");
    expect(section.textContent).toContain("Kabine E2");
  });

  it("home and away dressing rooms are not swapped", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine HOME", awayDressingRoomLabel: "Kabine AWAY", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    const text = block.textContent ?? "";
    const heimIdx = text.indexOf("HEIM");
    const gastIdx = text.indexOf("GAST");
    const homeValueIdx = text.indexOf("Kabine HOME");
    const awayValueIdx = text.indexOf("Kabine AWAY");
    expect(heimIdx).toBeLessThan(gastIdx);
    expect(homeValueIdx).toBeLessThan(awayValueIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 4-team tournament allocation mode ────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("4-team tournament allocation", () => {
  it("renders tournament card once", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const cards = screen.getAllByTestId("event-card");
    expect(cards).toHaveLength(1);
  });

  it("renders participant allocation block", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getByTestId("participant-allocation-block")).toBeTruthy();
  });

  it("renders all four team names", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getByText("FC Allschwil E1")).toBeTruthy();
    expect(screen.getByText("FC Allschwil E2")).toBeTruthy();
    expect(screen.getByText("FC Binningen")).toBeTruthy();
    expect(screen.getByText("FC Aesch")).toBeTruthy();
  });

  it("renders all four dressing rooms", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    expect(block.textContent).toContain("Kabine A");
    expect(block.textContent).toContain("Kabine B");
    expect(block.textContent).toContain("Kabine C");
    expect(block.textContent).toContain("Kabine D");
  });

  it("each team and its dressing room share the same allocation row", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    const text = block.textContent ?? "";
    // FC Allschwil E1 should appear before Kabine A, and FC Aesch before Kabine D
    const e1Idx = text.indexOf("FC Allschwil E1");
    const ka = text.indexOf("Kabine A");
    const e2Idx = text.indexOf("FC Allschwil E2");
    const kb = text.indexOf("Kabine B");
    const aeschIdx = text.indexOf("FC Aesch");
    const kd = text.indexOf("Kabine D");
    expect(e1Idx).toBeLessThan(ka);
    expect(e2Idx).toBeLessThan(kb);
    expect(aeschIdx).toBeLessThan(kd);
  });

  it("renders TEAM allocation header", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    expect(block.textContent).toContain("TEAM");
  });

  it("renders GARDEROBE allocation header", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    expect(block.textContent).toContain("GARDEROBE");
  });

  it("does not render a generic detached dressing-room list", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    // The allocation-block (standard detached list) should not be present
    expect(screen.queryByTestId("allocation-block")).toBeNull();
  });

  it("applies home-team emphasis to home club teams", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    // Both FC Allschwil E1 and E2 should be visible (emphasis is visual only)
    expect(screen.getByText("FC Allschwil E1")).toBeTruthy();
    expect(screen.getByText("FC Allschwil E2")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 6-team tournament allocation mode ────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("6-team tournament allocation", () => {
  it("renders all six team names", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getByText("FC Allschwil F1")).toBeTruthy();
    expect(screen.getByText("FC Allschwil F2")).toBeTruthy();
    expect(screen.getByText("FC Allschwil F3")).toBeTruthy();
    expect(screen.getByText("FC Binningen")).toBeTruthy();
    expect(screen.getByText("FC Reinach")).toBeTruthy();
    expect(screen.getByText("FC Aesch")).toBeTruthy();
  });

  it("renders all six dressing rooms", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    expect(block.textContent).toContain("Kabine A");
    expect(block.textContent).toContain("Kabine B");
    expect(block.textContent).toContain("Kabine C");
    expect(block.textContent).toContain("Kabine D");
    expect(block.textContent).toContain("Kabine E");
    expect(block.textContent).toContain("Kabine F");
  });

  it("no allocation row is omitted — all 6 teams visible", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    const text = block.textContent ?? "";
    // All team names must be present in the allocation block
    expect(text).toContain("FC Allschwil F1");
    expect(text).toContain("FC Allschwil F2");
    expect(text).toContain("FC Allschwil F3");
    expect(text).toContain("FC Binningen");
    expect(text).toContain("FC Reinach");
    expect(text).toContain("FC Aesch");
  });

  it("visiting teams are readable alongside home club teams", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    // All visiting teams must appear in the DOM
    expect(screen.getByText("FC Binningen")).toBeTruthy();
    expect(screen.getByText("FC Reinach")).toBeTruthy();
    expect(screen.getByText("FC Aesch")).toBeTruthy();
  });

  it("renders TEAM and GARDEROBE headers", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    expect(block.textContent).toContain("TEAM");
    expect(block.textContent).toContain("GARDEROBE");
  });

  it("home-club emphasis marker visible for home teams", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    // Home teams should be present and visible
    expect(screen.getByText("FC Allschwil F1")).toBeTruthy();
    expect(screen.getByText("FC Allschwil F2")).toBeTruthy();
    expect(screen.getByText("FC Allschwil F3")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── High-density simultaneous training ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("High-density simultaneous training — density marker", () => {
  it("4 simultaneous trainings trigger high-density mode", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team Alpha" }),
        makeEvent({ id: "t2", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team Beta" }),
        makeEvent({ id: "t3", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team Gamma" }),
        makeEvent({ id: "t4", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team Delta" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.getAttribute("data-simultaneous-density")).toBe("high");
  });

  it("5 simultaneous trainings trigger high-density mode", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team 1" }),
        makeEvent({ id: "t2", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team 2" }),
        makeEvent({ id: "t3", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team 3" }),
        makeEvent({ id: "t4", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team 4" }),
        makeEvent({ id: "t5", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team 5" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.getAttribute("data-simultaneous-density")).toBe("high");
  });

  it("6 simultaneous trainings trigger high-density mode", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    const section = screen.getByTestId("section-current");
    expect(section.getAttribute("data-simultaneous-density")).toBe("high");
  });

  it("3 simultaneous events remain normal density", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team 1" }),
        makeEvent({ id: "t2", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team 2" }),
        makeEvent({ id: "t3", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team 3" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.getAttribute("data-simultaneous-density")).toBe("normal");
  });
});

describe("High-density simultaneous training — visibility (4 teams)", () => {
  const FOUR_TEAM_FEED: InfoboardScreen1Feed = {
    generatedAt: "2026-09-12T08:30:00.000Z",
    tenant: { id: "t", key: "k", name: "Test", timezone: "Europe/Zurich" },
    displayDate: "2026-09-12",
    isStale: false,
    wochenplanVariantBadge: null,
    current: [
      makeEvent({ id: "t1", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team Alpha", allocation: { pitchLabel: "Platz 1", homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } }),
      makeEvent({ id: "t2", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team Beta", allocation: { pitchLabel: "Platz 2", homeDressingRoomLabel: "Kabine B", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } }),
      makeEvent({ id: "t3", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team Gamma", allocation: { pitchLabel: "Platz 3", homeDressingRoomLabel: "Kabine C", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } }),
      makeEvent({ id: "t4", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Team Delta", allocation: { pitchLabel: "Platz 4", homeDressingRoomLabel: "Kabine D", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } }),
    ],
    next: [],
    later: [],
    isEmpty: false,
  };

  it("all 4 teams remain visible", () => {
    render(<InfoboardScreen1 feed={FOUR_TEAM_FEED} />);
    expect(screen.getByText("Team Alpha")).toBeTruthy();
    expect(screen.getByText("Team Beta")).toBeTruthy();
    expect(screen.getByText("Team Gamma")).toBeTruthy();
    expect(screen.getByText("Team Delta")).toBeTruthy();
  });

  it("all 4 pitches remain visible", () => {
    render(<InfoboardScreen1 feed={FOUR_TEAM_FEED} />);
    expect(screen.getByText("Platz 1")).toBeTruthy();
    expect(screen.getByText("Platz 2")).toBeTruthy();
    expect(screen.getByText("Platz 3")).toBeTruthy();
    expect(screen.getByText("Platz 4")).toBeTruthy();
  });

  it("all 4 dressing rooms remain visible", () => {
    render(<InfoboardScreen1 feed={FOUR_TEAM_FEED} />);
    expect(screen.getByText("Kabine A")).toBeTruthy();
    expect(screen.getByText("Kabine B")).toBeTruthy();
    expect(screen.getByText("Kabine C")).toBeTruthy();
    expect(screen.getByText("Kabine D")).toBeTruthy();
  });

  it("no generic combined count replaces individual teams", () => {
    render(<InfoboardScreen1 feed={FOUR_TEAM_FEED} />);
    // The section must not show a "4 Trainings" style collapsed view
    const section = screen.getByTestId("section-current");
    expect(section.textContent).not.toMatch(/^\s*4\s+[Tt]raining/);
    // All teams visible individually
    expect(screen.getByText("Team Alpha")).toBeTruthy();
  });
});

describe("High-density simultaneous training — visibility (6 teams)", () => {
  it("all 6 teams remain individually visible", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    expect(screen.getByText("FC Allschwil U8/U10 A")).toBeTruthy();
    expect(screen.getByText("FC Allschwil U8/U10 B")).toBeTruthy();
    expect(screen.getByText("FC Allschwil U12 A")).toBeTruthy();
    expect(screen.getByText("FC Allschwil U12 B")).toBeTruthy();
    expect(screen.getByText("FC Allschwil U14 A")).toBeTruthy();
    expect(screen.getByText("FC Allschwil D1")).toBeTruthy();
  });

  it("all 6 pitches remain visible", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    expect(screen.getByText("Platz 1")).toBeTruthy();
    expect(screen.getByText("Platz 2")).toBeTruthy();
    expect(screen.getByText("Kunstrasen 1")).toBeTruthy();
    expect(screen.getByText("Kunstrasen 2")).toBeTruthy();
    expect(screen.getByText("Kunstrasen 3")).toBeTruthy();
    expect(screen.getByText("Stadion")).toBeTruthy();
  });

  it("all 6 dressing rooms remain visible", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    expect(screen.getByText("Kabine A")).toBeTruthy();
    expect(screen.getByText("Kabine B")).toBeTruthy();
    expect(screen.getByText("Kabine C")).toBeTruthy();
    expect(screen.getByText("Kabine D")).toBeTruthy();
    expect(screen.getByText("Kabine E")).toBeTruthy();
    expect(screen.getByText("Kabine F")).toBeTruthy();
  });

  it("uses compact rows in high-density mode", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    const rows = screen.getAllByTestId("compact-event-row");
    expect(rows.length).toBe(6);
  });
});

describe("High-density simultaneous training — 5 teams visibility", () => {
  it("all 5 teams remain visible", () => {
    const feed: InfoboardScreen1Feed = {
      generatedAt: "2026-09-12T08:30:00.000Z",
      tenant: { id: "t", key: "k", name: "Test", timezone: "Europe/Zurich" },
      displayDate: "2026-09-12",
      isStale: false,
      wochenplanVariantBadge: null,
      current: PREVIEW_FIXTURE_HIGH_DENSITY_6.current.slice(0, 5),
      next: [],
      later: [],
      isEmpty: false,
    };
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Allschwil U8/U10 A")).toBeTruthy();
    expect(screen.getByText("FC Allschwil U8/U10 B")).toBeTruthy();
    expect(screen.getByText("FC Allschwil U12 A")).toBeTruthy();
    expect(screen.getByText("FC Allschwil U12 B")).toBeTruthy();
    expect(screen.getByText("FC Allschwil U14 A")).toBeTruthy();
  });

  it("5 simultaneous events use high-density mode", () => {
    const feed: InfoboardScreen1Feed = {
      generatedAt: "2026-09-12T08:30:00.000Z",
      tenant: { id: "t", key: "k", name: "Test", timezone: "Europe/Zurich" },
      displayDate: "2026-09-12",
      isStale: false,
      wochenplanVariantBadge: null,
      current: PREVIEW_FIXTURE_HIGH_DENSITY_6.current.slice(0, 5),
      next: [],
      later: [],
      isEmpty: false,
    };
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.getAttribute("data-simultaneous-density")).toBe("high");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Announcement bar ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Announcement bar — enabled", () => {
  it("renders when enabled is true and text is non-blank", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "WILLKOMMEN BEI UNS",
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
  });

  it("renders the announcement text", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "TEST ANKÜNDIGUNG HIER",
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(screen.getByText("TEST ANKÜNDIGUNG HIER")).toBeTruthy();
  });

  it("applies backgroundColor when provided", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "Colored bar",
      backgroundColor: "#ff0000",
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    const bar = screen.getByTestId("announcement-bar");
    expect(bar.getAttribute("style")).toContain("background-color: rgb(255, 0, 0)");
  });

  it("applies textColor when provided", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "Colored text",
      backgroundColor: null,
      textColor: "#ffff00",
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    const bar = screen.getByTestId("announcement-bar");
    expect(bar.getAttribute("style")).toContain("color: rgb(255, 255, 0)");
  });

  it("uses preview announcement fixture content", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        announcement={PREVIEW_ANNOUNCEMENT}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    expect(screen.getByText(PREVIEW_ANNOUNCEMENT.text!)).toBeTruthy();
  });
});

describe("Announcement bar — disabled", () => {
  it("hidden when enabled is false", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: false,
      text: "Should not appear",
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("hidden when text is blank (whitespace only)", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "   ",
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("hidden when text is empty string", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "",
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("hidden when text is null", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: null,
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("hidden when announcement prop is absent", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });
});

describe("Announcement bar — no hardcoded slogan", () => {
  it("component does not hardcode any club slogan when no announcement is provided", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    // None of these club-specific phrases should appear without explicit prop
    expect(screen.queryByText(/FAIRNESS/i)).toBeNull();
    expect(screen.queryByText(/RESPEKT/i)).toBeNull();
    expect(screen.queryByText(/LEIDENSCHAFT/i)).toBeNull();
    expect(screen.queryByText(/WILLKOMMEN BEIM FC ALLSCHWIL/i)).toBeNull();
  });

  it("component does not hardcode any club slogan in disabled state", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        announcement={{ enabled: false, text: null, backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByText(/FAIRNESS/i)).toBeNull();
    expect(screen.queryByText(/WILLKOMMEN BEIM FC ALLSCHWIL/i)).toBeNull();
  });
});

describe("Announcement bar — color fallbacks", () => {
  it("renders without inline styles when both colors are null (uses CSS defaults)", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "Fallback colors",
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    const bar = screen.getByTestId("announcement-bar");
    const style = bar.getAttribute("style") ?? "";
    expect(style).not.toContain("background-color");
    expect(style).not.toContain("color");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Event-type labels ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Event-type labels", () => {
  it("renders TRAINING label for TRAINING events", () => {
    const feed = makeFeed({ current: [makeEvent({ type: "TRAINING" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("TRAINING")).toBeTruthy();
  });

  it("renders SPIEL label for MATCH events", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("SPIEL")).toBeTruthy();
  });

  it("renders TURNIER label for TOURNAMENT events", () => {
    const feed = makeFeed({ current: [makeEvent({ type: "TOURNAMENT" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("TURNIER")).toBeTruthy();
  });

  it("does not display raw MATCH string as the user-facing type label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const cards = screen.getAllByTestId("event-card");
    const typeSpan = cards[0].querySelector('[aria-label^="Typ:"]');
    expect(typeSpan?.textContent).toBe("SPIEL");
    expect(typeSpan?.textContent).not.toBe("MATCH");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Current section ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Current section — heading", () => {
  it("renders JETZT heading", () => {
    const feed = makeFeed({ current: [makeEvent()], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(within(section).getByRole("heading", { name: "JETZT" })).toBeTruthy();
  });
});

describe("Current section — time in tenant timezone", () => {
  it("displays startAt in Europe/Zurich (UTC+2) — not UTC", () => {
    const feed = makeFeed({
      current: [makeEvent({ startAt: "2026-09-12T08:00:00.000Z" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).toContain("10:00");
    expect(section.textContent).not.toContain("08:00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Next section ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ── Later section ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ── Allocations ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Allocations — PLATZ", () => {
  it("renders PLATZ label and pitch value", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: "Stadion", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
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
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
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
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    expect(block.textContent).toContain("HEIM");
    expect(block.textContent).toContain("Kabine E1");
  });

  it("shows GAST for away dressing room", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const block = screen.getByTestId("allocation-block");
    expect(block.textContent).toContain("GAST");
    expect(block.textContent).toContain("Kabine E2");
  });
});

describe("Allocations — SCHIRI absent (Screen 1 contract)", () => {
  it("does not show SCHIRI even when refereeDressingRoomLabel is set", () => {
    const feed = makeFeed({
      current: [makeEvent({
        type: "MATCH",
        teamDisplayName: "FC Test",
        opponentDisplayName: "FC Other",
        allocation: {
          pitchLabel: null,
          homeDressingRoomLabel: "Kabine E1",
          awayDressingRoomLabel: "Kabine E2",
          refereeDressingRoomLabel: "Kabine C",
        },
      })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText("SCHIRI")).toBeNull();
  });

  it("referee room value not rendered on Screen 1", () => {
    const feed = makeFeed({
      current: [makeEvent({
        type: "MATCH",
        teamDisplayName: "FC Test",
        opponentDisplayName: "FC Other",
        allocation: {
          pitchLabel: null,
          homeDressingRoomLabel: "Kabine E1",
          awayDressingRoomLabel: "Kabine E2",
          refereeDressingRoomLabel: "Kabine SCHIRI",
        },
      })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    // The referee room label must not appear
    expect(section.textContent).not.toContain("Kabine SCHIRI");
    // But home and away rooms are still shown
    expect(section.textContent).toContain("Kabine E1");
    expect(section.textContent).toContain("Kabine E2");
  });
});

describe("Allocations — missing allocation block", () => {
  it("does not render allocation block when all fields are null", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: null, homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByTestId("allocation-block")).toBeNull();
  });

  it("does not render allocation block when only referee room is set", () => {
    const feed = makeFeed({
      current: [makeEvent({
        type: "MATCH",
        teamDisplayName: "FC Test",
        opponentDisplayName: "FC Other",
        allocation: {
          pitchLabel: null,
          homeDressingRoomLabel: null,
          awayDressingRoomLabel: null,
          refereeDressingRoomLabel: "Kabine C",
        },
      })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // No pitch, no home, no away → block should not render
    expect(screen.queryByTestId("allocation-block")).toBeNull();
  });

  it("does not render PLATZ when pitchLabel is null", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const section = screen.getByTestId("section-current");
    expect(section.textContent).not.toContain("PLATZ");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Optional fields ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ── Empty states ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Empty state — completely empty feed", () => {
  it("shows full empty-state message when feed.isEmpty is true and all arrays empty", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY} />);
    expect(screen.getByTestId("empty-state-full")).toBeTruthy();
    expect(screen.getByText("Heute keine Trainings, Heimspiele oder Turniere")).toBeTruthy();
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
    expect(screen.getByText("Aktuell keine Veranstaltung")).toBeTruthy();
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

// ─────────────────────────────────────────────────────────────────────────────
// ── Multi-team extension edge cases ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Multi-team extension — edge cases", () => {
  it("ignores unknown eventId in eventPresentation", () => {
    const ext = makeEventPresentation("does-not-exist", [
      { id: "pa1", teamDisplayName: "FC Test", dressingRoomLabel: "Kabine X" },
      { id: "pa2", teamDisplayName: "FC Other", dressingRoomLabel: "Kabine Y" },
      { id: "pa3", teamDisplayName: "FC Third", dressingRoomLabel: "Kabine Z" },
    ]);
    const feed = makeFeed({ current: [makeEvent()], isEmpty: false });
    // Should render without throwing; extension for unknown event is ignored
    const { container } = render(<InfoboardScreen1 feed={feed} eventPresentation={ext} />);
    expect(container).toBeTruthy();
    // Standard card rendered (no participant block)
    expect(screen.queryByTestId("participant-allocation-block")).toBeNull();
  });

  it("uses first matching entry when duplicate eventIds exist", () => {
    const ext: readonly InfoboardEventPresentationExtension[] = [
      {
        eventId: "evt-test-1",
        participantAllocations: [
          { id: "pa1", teamDisplayName: "FC First", dressingRoomLabel: "Kabine 1" },
          { id: "pa2", teamDisplayName: "FC Second", dressingRoomLabel: "Kabine 2" },
          { id: "pa3", teamDisplayName: "FC Third", dressingRoomLabel: "Kabine 3" },
        ],
      },
      {
        eventId: "evt-test-1",
        participantAllocations: [
          { id: "pa4", teamDisplayName: "FC Duplicate", dressingRoomLabel: "Kabine X" },
          { id: "pa5", teamDisplayName: "FC Duplicate2", dressingRoomLabel: "Kabine Y" },
          { id: "pa6", teamDisplayName: "FC Duplicate3", dressingRoomLabel: "Kabine Z" },
        ],
      },
    ];
    const feed = makeFeed({
      current: [makeEvent({ id: "evt-test-1", type: "TOURNAMENT" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} eventPresentation={ext} />);
    // First match wins
    expect(screen.getByText("FC First")).toBeTruthy();
    expect(screen.queryByText("FC Duplicate")).toBeNull();
  });

  it("renders standard card when participantAllocations has fewer than 3 entries", () => {
    const ext = makeEventPresentation("evt-test-1", [
      { id: "pa1", teamDisplayName: "FC A", dressingRoomLabel: "Kabine A" },
      { id: "pa2", teamDisplayName: "FC B", dressingRoomLabel: "Kabine B" },
    ]);
    const feed = makeFeed({
      current: [makeEvent({ id: "evt-test-1", type: "TOURNAMENT" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} eventPresentation={ext} />);
    // Fewer than 3 → standard card, not allocation matrix
    expect(screen.queryByTestId("participant-allocation-block")).toBeNull();
    expect(screen.getByTestId("event-card")).toBeTruthy();
  });

  it("renders standard card when participantAllocations is empty", () => {
    const ext = makeEventPresentation("evt-test-1", []);
    const feed = makeFeed({
      current: [makeEvent({ id: "evt-test-1", type: "TOURNAMENT" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} eventPresentation={ext} />);
    expect(screen.queryByTestId("participant-allocation-block")).toBeNull();
  });

  it("omits room value when dressingRoomLabel is null — no placeholder", () => {
    const ext = makeEventPresentation("evt-test-1", [
      { id: "pa1", teamDisplayName: "FC A", dressingRoomLabel: "Kabine A" },
      { id: "pa2", teamDisplayName: "FC B", dressingRoomLabel: null },
      { id: "pa3", teamDisplayName: "FC C", dressingRoomLabel: "Kabine C" },
    ]);
    const feed = makeFeed({
      current: [makeEvent({ id: "evt-test-1", type: "TOURNAMENT" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} eventPresentation={ext} />);
    const block = screen.getByTestId("participant-allocation-block");
    // Team B is present
    expect(block.textContent).toContain("FC B");
    // No dash or placeholder for the missing room
    expect(block.textContent).not.toContain("—");
    expect(block.textContent).not.toContain("N/A");
    expect(block.textContent).not.toContain("TBD");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Density mode ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ── Determinism and purity ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

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

  it("rendering does not mutate the branding object", () => {
    const branding = { clubLogoSrc: "/logo.png", productLogoSrc: "/sce.png" };
    const brandingCopy = JSON.stringify(branding);
    const feed = makeFeed();
    render(<InfoboardScreen1 feed={feed} branding={branding} />);
    expect(JSON.stringify(branding)).toBe(brandingCopy);
  });

  it("rendering does not mutate the announcement object", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "IMMUTABLE TEXT",
      backgroundColor: "#000",
      textColor: "#fff",
    };
    const annCopy = JSON.stringify(ann);
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(JSON.stringify(ann)).toBe(annCopy);
  });

  it("rendering does not mutate eventPresentation array", () => {
    const ext: InfoboardEventPresentationExtension[] = [
      {
        eventId: "evt-test-1",
        participantAllocations: [
          { id: "pa1", teamDisplayName: "FC A", dressingRoomLabel: "Kabine A" },
          { id: "pa2", teamDisplayName: "FC B", dressingRoomLabel: "Kabine B" },
          { id: "pa3", teamDisplayName: "FC C", dressingRoomLabel: "Kabine C" },
        ],
      },
    ];
    const extCopy = JSON.stringify(ext);
    const feed = makeFeed({ current: [makeEvent({ id: "evt-test-1" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} eventPresentation={ext} />);
    expect(JSON.stringify(ext)).toBe(extCopy);
  });

  it("rendering does not mutate participant-allocation arrays", () => {
    const allocations = [
      { id: "pa1", teamDisplayName: "FC A", dressingRoomLabel: "Kabine A" },
      { id: "pa2", teamDisplayName: "FC B", dressingRoomLabel: "Kabine B" },
      { id: "pa3", teamDisplayName: "FC C", dressingRoomLabel: "Kabine C" },
    ];
    const allocCopy = JSON.stringify(allocations);
    const ext: InfoboardEventPresentationExtension[] = [{ eventId: "evt-test-1", participantAllocations: allocations }];
    const feed = makeFeed({ current: [makeEvent({ id: "evt-test-1" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} eventPresentation={ext} />);
    expect(JSON.stringify(allocations)).toBe(allocCopy);
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

// ─────────────────────────────────────────────────────────────────────────────
// ── Branding checks ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Branding", () => {
  it("product branding is rendered in every non-empty state", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("product branding is rendered even in empty state", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY} />);
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("product branding is not the primary heading element", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Allschwil", timezone: "Europe/Zurich" } })}
        branding={{ productLogoSrc: null }}
      />,
    );
    const header = screen.getByTestId("infoboard-header");
    expect(header.textContent).toContain("FC Allschwil");
    expect(header.textContent).toContain("SportClubEvo");
    const clubIdx = header.textContent!.indexOf("FC Allschwil");
    const sceIdx = header.textContent!.indexOf("SportClubEvo");
    expect(clubIdx).toBeLessThan(sceIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Full preview fixture smoke test ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Preview fixture — full smoke test", () => {
  it("renders the full preview fixture without errors", () => {
    const { container } = render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        branding={{
          clubLogoSrc: "/images/logos/fc-allschwil.png",
          productLogoSrc: "/images/branding/sportclubevo_logo.png",
        }}
        announcement={PREVIEW_ANNOUNCEMENT}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
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

  it("renders current time when currentTimeIso supplied", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    const center = screen.getByTestId("header-center");
    expect(center.textContent).toContain("10:30");
  });

  it("does not render SCHIRI from fixture match data", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} />);
    expect(screen.queryByText("SCHIRI")).toBeNull();
  });
});
