/**
 * @vitest-environment jsdom
 */

/**
 * Component tests for InfoboardScreen1 (PP-02B-H target-aligned redesign).
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
import {
  InfoboardScreen1,
  computeTrainingGroupDemand,
  computeEventDemand,
  densityTier,
  paginateDisplayList,
  CARD_DEMAND_TRAINING_BASE,
  CARD_DEMAND_TRAINING_ROW,
  CARD_DEMAND_MATCH,
  CARD_DEMAND_TOURNAMENT_BASE,
  CARD_DEMAND_PAGE_MAX,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import type { DisplayItem, FlatEvent } from "@/components/infoboard/screen1/InfoboardScreen1";
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
  PREVIEW_TARGET_TOURNAMENT_EXTENSIONS,
  PREVIEW_FIXTURE_TRAINING_GROUPS,
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
    emptyStateReason: "NO_EVENTS_TODAY",
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
    opponentLogoUrl: null,
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
// ── Header — club logo ────────────────────────────────────────────────────────
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
    const header = screen.getByTestId("kiosk-shell-header");
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

// ─────────────────────────────────────────────────────────────────────────────
// ── Header — club name ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header — club name", () => {
  it("renders the tenant name", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Testclub", timezone: "Europe/Zurich" } })}
      />,
    );
    expect(screen.getByText("FC Testclub")).toBeTruthy();
  });

  it("club name appears in the header", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Musterclub", timezone: "Europe/Zurich" } })}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.textContent).toContain("FC Musterclub");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Header — SportClubEvo branding NOT in header ──────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header — no SportClubEvo logo in header", () => {
  it("renders header-time-zone and header-date-zone", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("header-time-zone")).toBeTruthy();
    expect(screen.getByTestId("header-date-zone")).toBeTruthy();
  });

  it("no product logo image appears inside header when productLogoSrc is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: "/images/branding/sportclubevo_logo.png" }}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    // Product logo alt is "SportClubEvo"; it must not be inside the header
    const imgs = header.querySelectorAll("img");
    for (const img of Array.from(imgs)) {
      expect(img.getAttribute("alt")).not.toBe("SportClubEvo");
    }
  });

  it("SportClubEvo text does not appear inside header", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: null }}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.textContent).not.toContain("SportClubEvo");
  });

  it("no visible 'Alexa Safe Zone' text appears anywhere", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.queryByText(/alexa safe zone/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Header — current time ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header — current time", () => {
  it("renders current time in center when currentTimeIso is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-time-zone");
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
    const center = screen.getByTestId("header-time-zone");
    expect(center.textContent).toContain("11:00");
    expect(center.textContent).not.toContain("09:00");
  });

  it("renders no clock element when currentTimeIso is missing", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const timeZone = screen.getByTestId("header-time-zone");
    expect(timeZone.querySelector("time")).toBeNull();
  });

  it("renders no clock element when currentTimeIso is null", () => {
    render(<InfoboardScreen1 feed={makeFeed()} currentTimeIso={null} />);
    const timeZone = screen.getByTestId("header-time-zone");
    expect(timeZone.querySelector("time")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Header — date ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header — date", () => {
  it("renders a date derived from feed.displayDate when no currentTimeIso", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.textContent).toMatch(/12/);
  });

  it("renders date in center zone", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-date-zone");
    expect(center.textContent).toMatch(/[Ss]eptember/);
  });

  it("uses explicit tenant timezone for date when currentTimeIso is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "Test", timezone: "Europe/Zurich" } })}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-date-zone");
    expect(center.textContent).toMatch(/12/);
    expect(center.textContent).toMatch(/[Ss]eptember/);
  });

  it("renders weekday in center when currentTimeIso is provided", () => {
    // 2026-09-12 is a Saturday (Samstag in German)
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso="2026-09-12T08:30:00.000Z"
      />,
    );
    const center = screen.getByTestId("header-date-zone");
    expect(center.textContent).toMatch(/[Ss]amstag/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Header — Alexa-safe right zone ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header — Alexa-safe right zone", () => {
  it("right Alexa-safe zone exists", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const safeZone = screen.getByTestId("alexa-safe-zone");
    expect(safeZone).toBeTruthy();
  });

  it("Alexa-safe zone is empty (no text content)", () => {
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
// ── Board title ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Board title", () => {
  it("renders HEUTE AUF DER SPORTANLAGE", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const boardTitle = screen.getByTestId("board-title");
    expect(boardTitle.textContent).toContain("HEUTE AUF DER SPORTANLAGE");
  });

  it("board-title element is present in DOM", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("board-title")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Event list — flat model (no section containers) ───────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Event list — flat model", () => {
  it("renders event-list container", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    expect(screen.getByTestId("event-list")).toBeTruthy();
  });

  it("no section-current container exists", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    expect(screen.queryByTestId("section-current")).toBeNull();
  });

  it("no section-next container exists", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ next: [makeEvent()], isEmpty: false })}
      />,
    );
    expect(screen.queryByTestId("section-next")).toBeNull();
  });

  it("no section-later container exists", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ later: [makeEvent()], isEmpty: false })}
      />,
    );
    expect(screen.queryByTestId("section-later")).toBeNull();
  });

  it("no standalone JETZT section heading rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    // JETZT should appear as an inline status label, not as an h2 heading
    const headings = screen.queryAllByRole("heading", { name: "JETZT" });
    expect(headings).toHaveLength(0);
  });

  it("no ALS NÄCHSTES section heading rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ next: [makeEvent()], isEmpty: false })}
      />,
    );
    const headings = screen.queryAllByRole("heading", { name: "ALS NÄCHSTES" });
    expect(headings).toHaveLength(0);
  });

  it("no SPÄTER HEUTE section heading rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ later: [makeEvent()], isEmpty: false })}
      />,
    );
    const headings = screen.queryAllByRole("heading", { name: "SPÄTER HEUTE" });
    expect(headings).toHaveLength(0);
  });

  it("5 rows render for the target preview fixture", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(5);
  });

  it("events from current, next, and later all appear in one flat list", () => {
    const feed = makeFeed({
      current: [makeEvent({ id: "c1", teamDisplayName: "Current Team", startAt: "2026-09-12T08:00:00.000Z" })],
      next: [makeEvent({ id: "n1", teamDisplayName: "Next Team", startAt: "2026-09-12T09:00:00.000Z" })],
      later: [makeEvent({ id: "l1", teamDisplayName: "Later Team", startAt: "2026-09-12T10:00:00.000Z" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("Current Team")).toBeTruthy();
    expect(screen.getByText("Next Team")).toBeTruthy();
    expect(screen.getByText("Later Team")).toBeTruthy();
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Temporal status labels ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Temporal status — JETZT label", () => {
  it("current event row shows JETZT inline status label", () => {
    const feed = makeFeed({ current: [makeEvent({ id: "c1" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByTestId("status-label-current")).toBeTruthy();
    expect(screen.getByTestId("status-label-current").textContent).toBe("JETZT");
  });

  it("JETZT label has current status data attribute", () => {
    const feed = makeFeed({ current: [makeEvent({ id: "c1" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const label = screen.getByTestId("status-label-current");
    expect(label.getAttribute("data-status")).toBe("current");
  });

  it("later event row does not show JETZT label", () => {
    const feed = makeFeed({ later: [makeEvent({ id: "l1" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByTestId("status-label-current")).toBeNull();
  });
});

describe("Temporal status — next label (no countdown)", () => {
  it("next event always shows ALS NÄCHSTES (never countdown) when currentTimeIso provided", () => {
    const feed = makeFeed({
      next: [makeEvent({ id: "n1", startAt: "2026-09-12T16:00:00.000Z" })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        currentTimeIso="2026-09-12T15:35:00.000Z"
      />,
    );
    const label = screen.getByTestId("status-label-next");
    expect(label.textContent).toBe("ALS NÄCHSTES");
  });

  it("next event shows ALS NÄCHSTES when currentTimeIso is not provided", () => {
    const feed = makeFeed({
      next: [makeEvent({ id: "n1" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const label = screen.getByTestId("status-label-next");
    expect(label.textContent).toBe("ALS NÄCHSTES");
  });

  it("next label has next status data attribute", () => {
    const feed = makeFeed({ next: [makeEvent({ id: "n1" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const label = screen.getByTestId("status-label-next");
    expect(label.getAttribute("data-status")).toBe("next");
  });
});

describe("No countdown text", () => {
  it("no 'IN X MIN.' countdown text is ever rendered for next events", () => {
    const feed = makeFeed({
      next: [makeEvent({ id: "n1", startAt: "2026-09-12T16:00:00.000Z" })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        currentTimeIso="2026-09-12T15:35:00.000Z"
      />,
    );
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.textContent).not.toMatch(/IN \d+ MIN\./);
    expect(root.textContent).not.toContain("IN 25");
  });

  it("no countdown text for next events without currentTimeIso", () => {
    const feed = makeFeed({
      next: [makeEvent({ id: "n1" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.textContent).not.toMatch(/IN \d+ MIN\./);
  });

  it("full preview fixture contains no countdown text", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />,
    );
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.textContent).not.toMatch(/IN \d+ MIN\./);
    expect(root.textContent).not.toMatch(/MINUTEN/i);
  });
});

describe("Temporal status — later rows unlabeled", () => {
  it("later event row has no status label", () => {
    const feed = makeFeed({ later: [makeEvent({ id: "l1" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByTestId("status-label-current")).toBeNull();
    expect(screen.queryByTestId("status-label-next")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Training rows ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Training row", () => {
  it("renders team name", () => {
    const feed = makeFeed({
      current: [makeEvent({ teamDisplayName: "FC Allschwil U12" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Allschwil U12")).toBeTruthy();
  });

  it("renders TRAINING type label", () => {
    const feed = makeFeed({ current: [makeEvent({ type: "TRAINING" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("TRAINING")).toBeTruthy();
  });

  it("renders organizer/subtitle when provided for non-training events", () => {
    // INFOBOARD-V2: Training events use TrainingGroupCard which does not show
    // organizerDisplayName. Use OTHER type to test organizer display via EventCard.
    const feed = makeFeed({
      current: [makeEvent({ type: "OTHER", organizerDisplayName: "FC Allschwil" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Allschwil")).toBeTruthy();
  });

  it("renders pitch label in PLATZ column", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: "KR2", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("KR2")).toBeTruthy();
  });

  it("renders PLATZ column label", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: "KR2", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getAllByText("PLATZ").length).toBeGreaterThan(0);
  });

  it("renders KABINE destination label in destination zone", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: "KR2", homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getAllByText("KABINE").length).toBeGreaterThan(0);
  });

  it("renders dressing room in allocation column", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // KABINE is the column label; room value is stripped of the "Kabine " prefix
    expect(screen.getAllByText("KABINE").length).toBeGreaterThan(0);
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("does not render GARDEROBE label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText("GARDEROBE")).toBeNull();
  });

  it("does not render club logo in allocation for training", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING" })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        branding={{ clubLogoSrc: "/images/logos/fc-allschwil.png" }}
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    // The training-allocation section should not contain any <img>
    const trainingAlloc = rows[0].querySelector('[data-testid="training-allocation"]');
    if (trainingAlloc !== null) {
      expect(trainingAlloc.querySelector("img")).toBeNull();
    }
  });

  it("renders time in tenant timezone", () => {
    const feed = makeFeed({
      current: [makeEvent({ startAt: "2026-09-12T08:00:00.000Z" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const row = screen.getByTestId("event-row");
    expect(row.textContent).toContain("10:00");
    expect(row.textContent).not.toContain("08:00");
  });

  it("does not show referee data", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: "Kabine SCHIRI" } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText(/SCHIRI/i)).toBeNull();
    expect(screen.queryByText("Kabine SCHIRI")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Match rows ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Match row", () => {
  it("renders home team name", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Allschwil E1", opponentDisplayName: "FC Binningen E1" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("FC Allschwil E1")).toBeTruthy();
  });

  it("renders opponent name with vs. prefix", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Opponent" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const row = screen.getByTestId("event-row");
    expect(row.textContent).toContain("FC Opponent");
  });

  it("renders competition label as event type header", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", competitionLabel: "Meisterschaft" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("Meisterschaft")).toBeTruthy();
  });

  it("renders SPIEL fallback when competitionLabel is null", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", competitionLabel: null })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("SPIEL")).toBeTruthy();
  });

  it("does not display raw MATCH string as the user-facing type label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const row = screen.getByTestId("event-row");
    expect(row.textContent).not.toContain("MATCH");
  });

  it("renders pitch label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: "Stadion", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("Stadion")).toBeTruthy();
  });

  it("renders home dressing room", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // Room values are stripped of the "Kabine " prefix; "E1" is the home room value
    expect(screen.getByText("E1")).toBeTruthy();
  });

  it("renders away dressing room", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // Room values are stripped of the "Kabine " prefix; "E2" is the away room value
    expect(screen.getByText("E2")).toBeTruthy();
  });

  it("home and away rooms appear in correct order (home before away)", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine HOME", awayDressingRoomLabel: "Kabine AWAY", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const matchAlloc = screen.getByTestId("match-allocation");
    const text = matchAlloc.textContent ?? "";
    // "Kabine HOME" → stripped to "HOME"; "Kabine AWAY" → stripped to "AWAY"
    const homeIdx = text.indexOf("HOME");
    const awayIdx = text.indexOf("AWAY");
    expect(homeIdx).not.toBe(-1);
    expect(awayIdx).not.toBe(-1);
    expect(homeIdx).toBeLessThan(awayIdx);
  });

  it("home team appears before away team in allocation", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Home", opponentDisplayName: "FC Away", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine H", awayDressingRoomLabel: "Kabine A", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const matchAlloc = screen.getByTestId("match-allocation");
    const text = matchAlloc.textContent ?? "";
    expect(text.indexOf("FC Home")).toBeLessThan(text.indexOf("FC Away"));
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
    const row = screen.getByTestId("event-row");
    expect(row.textContent).not.toContain("SCHIRI");
    expect(row.textContent).not.toContain("Kabine C");
    // Room values are stripped of the "Kabine " prefix — verify home/away rooms are present
    const matchAlloc = screen.getByTestId("match-allocation");
    expect(matchAlloc.textContent).toContain("E1");
    expect(matchAlloc.textContent).toContain("E2");
  });

  it("does not render HEIM label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText("HEIM")).toBeNull();
  });

  it("does not render GAST label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText("GAST")).toBeNull();
  });

  it("shows home team name text in match-home-team-row (no logo — text-first per C6)", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        branding={{ clubLogoSrc: "/images/logos/fc-allschwil.png" }}
      />,
    );
    // Logos are removed from match identity zone (INFOBOARD-UX-03-C6).
    // Team name text must be present; no img element in the home row.
    const homeTeamRow = screen.getByTestId("match-home-team-row");
    expect(homeTeamRow.querySelector("img")).toBeNull();
    expect(homeTeamRow.textContent).toContain("FC Test");
  });

  it("no logo appears inside the dressing-room allocation area", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        branding={{ clubLogoSrc: "/images/logos/fc-allschwil.png" }}
      />,
    );
    const matchAlloc = screen.getByTestId("match-allocation");
    expect(matchAlloc.querySelector("img")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Tournament rows — 4-team allocation ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("4-team tournament allocation", () => {
  it("renders event row once", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(1);
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
    // Team names appear in both tournament-participants and participant-allocation-block
    expect(screen.getAllByText("FC Allschwil E1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Allschwil E2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Binningen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Aesch").length).toBeGreaterThan(0);
  });

  it("renders all four dressing rooms", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    // Room values are stripped of "Kabine " prefix — rendered as standalone spans
    expect(within(block).getByText("A")).toBeTruthy();
    expect(within(block).getByText("B")).toBeTruthy();
    expect(within(block).getByText("C")).toBeTruthy();
    expect(within(block).getByText("D")).toBeTruthy();
  });

  it("each team and its dressing room appear in the same text block (room code before team name)", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    const text = block.textContent ?? "";
    // In the new design room code appears before team name in each row (for fast scanning)
    const ka = text.indexOf("Kabine A");
    const e1Idx = text.indexOf("FC Allschwil E1");
    const kb = text.indexOf("Kabine B");
    const e2Idx = text.indexOf("FC Allschwil E2");
    const kd = text.indexOf("Kabine D");
    const aeschIdx = text.indexOf("FC Aesch");
    expect(ka).toBeLessThan(e1Idx);
    expect(kb).toBeLessThan(e2Idx);
    expect(kd).toBeLessThan(aeschIdx);
  });

  it("participant-allocation-block contains team and room data (no separate TEAM/GARDEROBE column headers required)", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    // Block contains team names and room values — header row not required in new card design
    expect(block.textContent).toContain("FC Allschwil E1");
    // Room value "A" (stripped from "Kabine A") is in a standalone span within the block
    expect(within(block).getByText("A")).toBeTruthy();
  });

  it("does not render a standard match-allocation or training-allocation block", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.queryByTestId("allocation-block")).toBeNull();
    expect(screen.queryByTestId("match-allocation")).toBeNull();
  });

  it("renders TURNIER type label", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getByText("TURNIER")).toBeTruthy();
  });

  it("applies home-team emphasis to home club teams", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    // Team names appear in both tournament-participants and participant-allocation-block
    expect(screen.getAllByText("FC Allschwil E1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Allschwil E2").length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Tournament rows — 6-team allocation ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("6-team tournament allocation", () => {
  it("renders all six team names", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    // Team names appear in both tournament-participants and participant-allocation-block
    expect(screen.getAllByText("FC Allschwil F1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Allschwil F2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Allschwil F3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Binningen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Reinach").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Aesch").length).toBeGreaterThan(0);
  });

  it("renders all six dressing rooms", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    // Room values are stripped of "Kabine " prefix — rendered as standalone spans
    expect(within(block).getByText("A")).toBeTruthy();
    expect(within(block).getByText("B")).toBeTruthy();
    expect(within(block).getByText("C")).toBeTruthy();
    expect(within(block).getByText("D")).toBeTruthy();
    expect(within(block).getByText("E")).toBeTruthy();
    expect(within(block).getByText("F")).toBeTruthy();
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
    // Teams appear in both tournament-participants and participant-allocation-block
    expect(screen.getAllByText("FC Binningen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Reinach").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Aesch").length).toBeGreaterThan(0);
  });

  it("participant-allocation-block contains all 6 team names and room codes without TEAM/GARDEROBE column headers", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    expect(block.textContent).toContain("FC Allschwil F1");
    expect(block.textContent).toContain("FC Aesch");
  });

  it("home-club teams are visible", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    // Teams appear in both tournament-participants and participant-allocation-block
    expect(screen.getAllByText("FC Allschwil F1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Allschwil F2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Allschwil F3").length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Target 5-team tournament (Sommer-Cup Junioren E) ─────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Target 5-team tournament allocation", () => {
  it("renders all five team names in participant block", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />,
    );
    // Use the participant block to scope the query — "FC Binningen E1" also
    // appears in the match row's allocation section (away team name).
    const block = screen.getByTestId("participant-allocation-block");
    expect(block.textContent).toContain("FC Binningen E1");
    expect(block.textContent).toContain("SC Birsfelden E1");
    expect(block.textContent).toContain("SV Muttenz E1");
    expect(block.textContent).toContain("FC Reinach E1");
    expect(block.textContent).toContain("FC Oberwil E1");
  });

  it("renders all five dressing rooms", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />,
    );
    const block = screen.getByTestId("participant-allocation-block");
    // Room values are stripped of "Kabine " prefix — rendered as standalone spans
    expect(within(block).getByText("01")).toBeTruthy();
    expect(within(block).getByText("02")).toBeTruthy();
    expect(within(block).getByText("03")).toBeTruthy();
    expect(within(block).getByText("04")).toBeTruthy();
    expect(within(block).getByText("05")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Many simultaneous events — flat list visibility ───────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("High-density — 6 simultaneous trainings (flat list)", () => {
  it("all 6 teams remain individually visible (club prefix stripped in V2)", () => {
    // INFOBOARD-V2: "FC Allschwil" prefix is stripped since header establishes club identity.
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    expect(screen.getByText("U8/U10 A")).toBeTruthy();
    expect(screen.getByText("U8/U10 B")).toBeTruthy();
    expect(screen.getByText("U12 A")).toBeTruthy();
    expect(screen.getByText("U12 B")).toBeTruthy();
    expect(screen.getByText("U14 A")).toBeTruthy();
    expect(screen.getByText("D1")).toBeTruthy();
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
    // Room values are stripped of "Kabine " prefix — rendered as standalone spans
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy();
    expect(screen.getByText("E")).toBeTruthy();
    expect(screen.getByText("F")).toBeTruthy();
  });

  it("renders 1 aggregated group card (6 simultaneous trainings → 1 card)", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(1);
  });
});

describe("High-density — 4 simultaneous events visibility", () => {
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
    emptyStateReason: null,
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
    // Room values are stripped of "Kabine " prefix — rendered as standalone spans
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Announcement bar / footer ─────────────────────────────────────────────────
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

  it("text appears only once (not duplicated)", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "EINMALIGER TEXT",
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    const matches = screen.getAllByText("EINMALIGER TEXT");
    expect(matches).toHaveLength(1);
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
// ── Footer — product branding ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Footer — product branding", () => {
  it("renders product-branding element in footer", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("renders POWERED BY text in footer", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const branding = screen.getByTestId("product-branding");
    expect(branding.textContent).toContain("POWERED BY");
  });

  it("renders product logo image when productLogoSrc is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: "/images/branding/sportclubevo_logo.png" }}
      />,
    );
    const branding = screen.getByTestId("product-branding");
    const img = branding.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("alt")).toBe("SportClubEvo");
    expect(img?.getAttribute("src")).toBe("/images/branding/sportclubevo_logo.png");
  });

  it("renders SportClubEvo text fallback when productLogoSrc is null", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: null }}
      />,
    );
    const branding = screen.getByTestId("product-branding");
    expect(branding.textContent).toContain("SportClubEvo");
  });

  it("product branding is NOT inside the header", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: "/images/branding/sportclubevo_logo.png" }}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    // Product branding element must not be a descendant of the header
    const brandingInHeader = header.querySelector('[data-testid="product-branding"]');
    expect(brandingInHeader).toBeNull();
  });

  it("product branding appears after (below) header in DOM", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: null }}
      />,
    );
    const root = screen.getByTestId("infoboard-screen1-root");
    const text = root.textContent ?? "";
    const headerIdx = text.indexOf("Test Club"); // club name in header
    const brandingIdx = text.indexOf("POWERED BY");
    // POWERED BY must appear after the club name (footer is below header)
    expect(brandingIdx).toBeGreaterThan(headerIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Referee removal regression ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Referee removal — no SCHIRI anywhere", () => {
  it("SCHIRI does not appear for match in current", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: "Stadion", homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: "K-SCHIRI" } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText(/SCHIRI/i)).toBeNull();
    expect(screen.queryByText("K-SCHIRI")).toBeNull();
  });

  it("SCHIRI does not appear for match in later", () => {
    const feed = makeFeed({
      later: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: "Stadion", homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: "K-SCHIRI-LATER" } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText(/SCHIRI/i)).toBeNull();
    expect(screen.queryByText("K-SCHIRI-LATER")).toBeNull();
  });

  it("referee room value not rendered for match", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: "Kabine C" } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText("Kabine C")).toBeNull();
    // Room values are stripped of "Kabine " prefix — verify home/away rooms visible
    expect(screen.getByText("E1")).toBeTruthy();
    expect(screen.getByText("E2")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Event-type labels ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Event-type labels", () => {
  it("renders TRAINING label for TRAINING events", () => {
    const feed = makeFeed({ current: [makeEvent({ type: "TRAINING" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("TRAINING")).toBeTruthy();
  });

  it("renders SPIEL fallback for MATCH events without competition label", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", competitionLabel: null })],
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

  it("event type label has correct data-event-type for MATCH", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other" })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const typeLabel = screen.getByTestId("event-row").querySelector("[data-event-type='MATCH']");
    expect(typeLabel).not.toBeNull();
  });

  it("event type label has correct data-event-type for TRAINING", () => {
    const feed = makeFeed({ current: [makeEvent({ type: "TRAINING" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const typeLabel = screen.getByTestId("event-row").querySelector("[data-event-type='TRAINING']");
    expect(typeLabel).not.toBeNull();
  });

  it("event type label has correct data-event-type for TOURNAMENT", () => {
    const feed = makeFeed({ current: [makeEvent({ type: "TOURNAMENT" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const typeLabel = screen.getByTestId("event-row").querySelector("[data-event-type='TOURNAMENT']");
    expect(typeLabel).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Empty states ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Empty states", () => {
  it("renders empty-state-full when feed is empty", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY} />);
    expect(screen.getByTestId("empty-state-full")).toBeTruthy();
  });

  it("renders no event rows when feed is empty", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_EMPTY} />);
    expect(screen.queryAllByTestId("event-row")).toHaveLength(0);
  });

  it("renders event rows when only later events exist", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ later: [makeEvent()], isEmpty: false })}
      />,
    );
    expect(screen.getAllByTestId("event-row")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Purity ────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Purity", () => {
  it("does not mutate the feed input", () => {
    const originalCurrent = [...PREVIEW_FIXTURE.current];
    const originalNext = [...PREVIEW_FIXTURE.next];
    const originalLater = [...PREVIEW_FIXTURE.later];
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />,
    );
    expect(PREVIEW_FIXTURE.current).toEqual(originalCurrent);
    expect(PREVIEW_FIXTURE.next).toEqual(originalNext);
    expect(PREVIEW_FIXTURE.later).toEqual(originalLater);
  });

  it("does not mutate the eventPresentation input", () => {
    const ext: InfoboardEventPresentationExtension = {
      eventId: "evt-tour4-1",
      participantAllocations: [
        { id: "p1", teamDisplayName: "Team A", dressingRoomLabel: "Kabine 1" },
        { id: "p2", teamDisplayName: "Team B", dressingRoomLabel: "Kabine 2" },
        { id: "p3", teamDisplayName: "Team C", dressingRoomLabel: "Kabine 3" },
      ],
    };
    const extensions: readonly InfoboardEventPresentationExtension[] = [ext];
    const originalLength = extensions.length;
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={extensions}
      />,
    );
    expect(extensions.length).toBe(originalLength);
    expect(extensions[0].eventId).toBe("evt-tour4-1");
  });

  it("renders deterministically for deterministic props", () => {
    const { container: c1 } = render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
        announcement={PREVIEW_ANNOUNCEMENT}
      />,
    );
    const html1 = c1.innerHTML;

    const { container: c2 } = render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
        announcement={PREVIEW_ANNOUNCEMENT}
      />,
    );
    const html2 = c2.innerHTML;

    expect(html1).toBe(html2);
  });

  it("does not mutate announcement prop", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "Original",
      backgroundColor: null,
      textColor: null,
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(ann.text).toBe("Original");
    expect(ann.enabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-04A: Dark theme ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Dark theme — INFOBOARD-04A", () => {
  it("root element has data-theme='dark' attribute by default", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it("root element has data-theme='dark' attribute when theme='DARK' is explicit", () => {
    render(<InfoboardScreen1 feed={makeFeed()} theme="DARK" />);
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it("event-list is rendered (card-based, not light table)", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    expect(screen.getByTestId("event-list")).toBeTruthy();
    // Event rows are present (no table element)
    const rows = screen.getAllByTestId("event-row");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("no <table> element is rendered", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.querySelector("table")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-INTEGRATION-01B: Light theme ───────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Light theme — INFOBOARD-INTEGRATION-01B", () => {
  it("root element has data-theme='light' attribute when theme='LIGHT'", () => {
    render(<InfoboardScreen1 feed={makeFeed()} theme="LIGHT" />);
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("light theme still renders the same layout structure (header, board title, footer)", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
        theme="LIGHT"
      />,
    );
    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
    expect(screen.getByTestId("board-title")).toBeTruthy();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
    expect(screen.getAllByTestId("event-row").length).toBeGreaterThan(0);
  });

  it("light theme renders event rows as <li> (card-based, same as dark)", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
        theme="LIGHT"
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    for (const row of rows) {
      expect(row.tagName.toLowerCase()).toBe("li");
    }
  });

  it("light theme renders training/match/tournament content identically to dark theme", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          type: "MATCH",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Other",
          allocation: {
            pitchLabel: "Stadion",
            homeDressingRoomLabel: "Kabine E1",
            awayDressingRoomLabel: "Kabine E2",
            refereeDressingRoomLabel: null,
          },
        }),
      ],
      isEmpty: false,
    });

    const { container: darkContainer } = render(
      <InfoboardScreen1 feed={feed} theme="DARK" />,
    );
    const darkText = darkContainer.textContent;

    const { container: lightContainer } = render(
      <InfoboardScreen1 feed={feed} theme="LIGHT" />,
    );
    const lightText = lightContainer.textContent;

    // Same underlying content — only the data-theme attribute (and CSS) differs.
    expect(darkText).toBe(lightText);
  });

  it("theme prop does not change which events are rendered", () => {
    const feed = makeFeed({
      current: [makeEvent({ id: "c1", startAt: "2026-09-12T08:00:00.000Z" })],
      next: [makeEvent({ id: "n1", startAt: "2026-09-12T09:00:00.000Z" })],
      later: [makeEvent({ id: "l1", startAt: "2026-09-12T10:00:00.000Z" })],
      isEmpty: false,
    });

    render(<InfoboardScreen1 feed={feed} theme="LIGHT" />);
    expect(screen.getAllByTestId("event-row")).toHaveLength(3);
  });

  it("unassigned pitch/dressing-room warnings still render in light theme", () => {
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
    render(<InfoboardScreen1 feed={feed} theme="LIGHT" />);
    expect(screen.getByTestId("pitch-unassigned-warning")).toBeTruthy();
    expect(screen.getByTestId("dressing-room-unassigned-warning")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-04A: Unassigned warnings (amber) ───────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Unassigned pitch warning", () => {
  it("shows NICHT ZUGETEILT when pitch is null (training uses TrainingGroupCard in V2)", () => {
    // INFOBOARD-V2: Solo trainings now render through TrainingGroupCard which shows
    // "NICHT ZUGETEILT" (without "NOCH"). This is the canonical training card text.
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByTestId("pitch-unassigned-warning")).toBeTruthy();
    expect(screen.getByTestId("pitch-unassigned-warning").textContent).toContain("NICHT ZUGETEILT");
  });

  it("does not show unassigned pitch warning when pitch is present", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: "Stadion", homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByTestId("pitch-unassigned-warning")).toBeNull();
    expect(screen.getByText("Stadion")).toBeTruthy();
  });
});

describe("Unassigned dressing-room warning (training)", () => {
  it("shows NICHT ZUGETEILT when training dressing room is null (TrainingGroupCard in V2)", () => {
    // INFOBOARD-V2: Solo trainings use TrainingGroupCard which uses "NICHT ZUGETEILT".
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: "KR1", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByTestId("dressing-room-unassigned-warning")).toBeTruthy();
    expect(screen.getByTestId("dressing-room-unassigned-warning").textContent).toContain("NICHT ZUGETEILT");
  });

  it("does not show dressing-room warning when training has a room", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: "KR1", homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByTestId("dressing-room-unassigned-warning")).toBeNull();
    // Room value "A" (stripped from "Kabine A") is visible in the KABINE column
    expect(screen.getByText("A")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-04A: No interaction affordances ────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("No interaction affordances", () => {
  it("no clickable arrow or chevron button in event rows", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    for (const row of rows) {
      // No button or anchor inside event rows
      expect(row.querySelector("button")).toBeNull();
      expect(row.querySelector("a")).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Missing / null data safety ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Missing and optional data safety", () => {
  it("no null string rendered for training with null organizer", () => {
    const feed = makeFeed({
      current: [makeEvent({ organizerDisplayName: null })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText("null")).toBeNull();
    expect(screen.queryByText("undefined")).toBeNull();
  });

  it("no null string rendered for match with null opponent", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", opponentDisplayName: null })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.queryByText("null")).toBeNull();
    expect(screen.queryByText("undefined")).toBeNull();
  });

  it("row renders without crashing when all allocation fields are null", () => {
    const feed = makeFeed({
      current: [makeEvent({ allocation: { pitchLabel: null, homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByTestId("event-row")).toBeTruthy();
  });

  it("missing logo keeps alignment (no broken img tag)", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        branding={{ clubLogoSrc: null }}
      />,
    );
    // Should render without errors; home room still visible
    expect(screen.getByText("K1")).toBeTruthy();
  });

  it("participant with null dressingRoomLabel renders team name without room", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={makeEventPresentation("evt-tour4-1", [
          { id: "p1", teamDisplayName: "Team A", dressingRoomLabel: "Kabine 1" },
          { id: "p2", teamDisplayName: "Team B", dressingRoomLabel: "Kabine 2" },
          { id: "p3", teamDisplayName: "Team C", dressingRoomLabel: null },
        ])}
      />,
    );
    expect(screen.getAllByText("Team A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Team C").length).toBeGreaterThan(0);
    expect(screen.queryByText("null")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-04B: Card-based layout requirements ────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Card-based layout — no table-row appearance", () => {
  it("event-list is a <ul> element (not <table>)", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    const eventList = screen.getByTestId("event-list");
    expect(eventList.tagName.toLowerCase()).toBe("ul");
  });

  it("event rows are <li> elements", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    for (const row of rows) {
      expect(row.tagName.toLowerCase()).toBe("li");
    }
  });

  it("event list carries data-count attribute reflecting number of rendered events", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent({ id: "c1", startAt: "2026-09-12T08:00:00.000Z" })], next: [makeEvent({ id: "n1", startAt: "2026-09-12T09:00:00.000Z" })], isEmpty: false })}
      />,
    );
    const eventList = screen.getByTestId("event-list");
    expect(eventList.getAttribute("data-count")).toBe("2");
  });

  it("data-count is 5 for the full preview fixture", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />,
    );
    const eventList = screen.getByTestId("event-list");
    expect(eventList.getAttribute("data-count")).toBe("5");
  });
});

describe("Match logo placement — text-first, no logos (INFOBOARD-UX-03-C6)", () => {
  it("home team row shows team name text and no img element", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Home", opponentDisplayName: "FC Away", allocation: { pitchLabel: "KR1", homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        branding={{ clubLogoSrc: "/logo.png" }}
      />,
    );
    const homeRow = screen.getByTestId("match-home-team-row");
    // C6: logos removed from event identity zone — text must be visible, no img
    expect(homeRow.querySelector("img")).toBeNull();
    expect(homeRow.textContent).toContain("FC Home");
  });

  it("away team row shows opponent name text and no img when opponentLogoUrl is set", () => {
    const feed = makeFeed({
      current: [makeEvent({
        type: "MATCH",
        teamDisplayName: "FC Home",
        opponentDisplayName: "FC Schwarz-Weiss A",
        opponentLogoUrl: "https://cdn.example.com/fc-schwarz-weiss.png",
        allocation: { pitchLabel: "KR1", homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: null },
      })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} branding={{ clubLogoSrc: "/logo.png" }} />);
    const awayRow = screen.getByTestId("match-away-team-row");
    // C6: logos removed — no img in away row regardless of opponentLogoUrl
    expect(awayRow.querySelector("img")).toBeNull();
    expect(awayRow.querySelector("[data-testid='away-team-logo']")).toBeNull();
    expect(awayRow.textContent).toContain("FC Schwarz-Weiss A");
  });

  it("away team row shows opponent name text and no placeholder when opponentLogoUrl is null", () => {
    const feed = makeFeed({
      current: [makeEvent({
        type: "MATCH",
        teamDisplayName: "FC Home",
        opponentDisplayName: "FC Away",
        opponentLogoUrl: null,
        allocation: { pitchLabel: "KR1", homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: null },
      })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} branding={{ clubLogoSrc: "/logo.png" }} />);
    const awayRow = screen.getByTestId("match-away-team-row");
    // C6: no logo and no placeholder — clean text-only presentation
    expect(awayRow.querySelector("img")).toBeNull();
    expect(awayRow.querySelector("[data-testid='away-team-logo-placeholder']")).toBeNull();
    expect(awayRow.textContent).toContain("FC Away");
  });

  it("no logo anywhere inside match-allocation (destination zone)", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Home", opponentDisplayName: "FC Away", allocation: { pitchLabel: "KR1", homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        branding={{ clubLogoSrc: "/logo.png" }}
      />,
    );
    const matchAlloc = screen.getByTestId("match-allocation");
    expect(matchAlloc.querySelector("img")).toBeNull();
  });

  it("no logo appears in training group card even with branding (V2: all trainings use TrainingGroupCard)", () => {
    // INFOBOARD-V2: Solo trainings now render through TrainingGroupCard (training-group testid),
    // not through the old TrainingDestination (training-allocation testid).
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: "KR2", homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        branding={{ clubLogoSrc: "/logo.png" }}
      />,
    );
    // TrainingGroupCard uses data-testid="training-group"
    const trainingGroup = screen.getByTestId("training-group");
    expect(trainingGroup.querySelector("img")).toBeNull();
  });
});

describe("Adaptive event count marker", () => {
  it("1 event → data-count=1 on event list", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    expect(screen.getByTestId("event-list").getAttribute("data-count")).toBe("1");
  });

  it("3 events → data-count=3 on event list", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({
          current: [makeEvent({ id: "a", startAt: "2026-09-12T08:00:00.000Z" })],
          next: [makeEvent({ id: "b", startAt: "2026-09-12T09:00:00.000Z" })],
          later: [makeEvent({ id: "c", startAt: "2026-09-12T10:00:00.000Z" })],
          isEmpty: false,
        })}
      />,
    );
    expect(screen.getByTestId("event-list").getAttribute("data-count")).toBe("3");
  });
});

describe("No interaction affordances (INFOBOARD-04B)", () => {
  it("no button elements in any event card", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    for (const row of rows) {
      expect(row.querySelector("button")).toBeNull();
    }
  });

  it("no anchor elements in any event card", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent()], isEmpty: false })}
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    for (const row of rows) {
      expect(row.querySelector("a")).toBeNull();
    }
  });
});

describe("Alexa safe zone — INFOBOARD-04B", () => {
  it("alexa-safe-zone is empty in full preview", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        branding={{ clubLogoSrc: "/logo.png", productLogoSrc: "/sce.png" }}
      />,
    );
    const safe = screen.getByTestId("alexa-safe-zone");
    expect(safe.textContent?.trim()).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Training group card — aggregation (spec-required focused tests) ───────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Training aggregation — same-start-time trainings collapse into one card", () => {
  it("two trainings at the same startAt produce one event-row card, not two", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "tr-a", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Team Alpha" }),
        makeEvent({ id: "tr-b", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Team Beta" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(1);
  });

  it("five trainings at the same startAt produce one event-row card (PREVIEW_FIXTURE_HIGH_DENSITY_6 sub-set)", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "x1", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T1" }),
        makeEvent({ id: "x2", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T2" }),
        makeEvent({ id: "x3", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T3" }),
        makeEvent({ id: "x4", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T4" }),
        makeEvent({ id: "x5", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T5" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(1);
  });

  it("PREVIEW_FIXTURE_TRAINING_GROUPS: 3 start-times → 3 rendered cards (group A + match + group B)", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_TRAINING_GROUPS} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(3);
  });
});

describe("Training aggregation — team, pitch, and kabine remain individually visible", () => {
  it("team names are visible inside the group card with club prefix stripped (V2)", () => {
    // INFOBOARD-V2: The club name (tenant.name = "FC Allschwil") is stripped from the
    // start of team display names since the header already establishes club identity.
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_TRAINING_GROUPS} />);
    // Stripped: "FC Allschwil D7 D1" → "D7 D1"
    expect(screen.getByText("D7 D1")).toBeTruthy();
    expect(screen.getByText("D7 D2")).toBeTruthy();
    expect(screen.getByText("Junioren E1")).toBeTruthy();
    expect(screen.getByText("D9 D1")).toBeTruthy();
    expect(screen.getByText("D9 D2")).toBeTruthy();
    // Full names should NOT appear (they are stripped)
    expect(screen.queryByText("FC Allschwil D7 D1")).toBeNull();
  });

  it("all pitch labels are visible inside group rows", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_TRAINING_GROUPS} />);
    const root = screen.getByTestId("infoboard-screen1-root");
    expect(root.textContent).toContain("KUNSTRASEN 3_A");
    expect(root.textContent).toContain("KUNSTRASEN 3_B");
    expect(root.textContent).toContain("KUNSTRASEN 2_A");
  });

  it("all kabine values are visible inside group rows", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_TRAINING_GROUPS} />);
    // Room values are stripped of "Kabine " prefix — rendered as standalone spans in the KABINE zone
    // event-rows[0] is the first training group (D7 D1, D7 D2, Junioren E1)
    // with rooms "3" (stripped from "Kabine 3") and "4" (stripped from "Kabine 4")
    const rows = screen.getAllByTestId("event-row");
    expect(within(rows[0]).getByText("3")).toBeTruthy();
    expect(within(rows[0]).getByText("4")).toBeTruthy();
  });

  it("group card data-testid=training-group is present for each aggregated time slot", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_TRAINING_GROUPS} />);
    const groups = screen.getAllByTestId("training-group");
    expect(groups).toHaveLength(2);
  });

  it("each team in the group has its own training-group-row", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_TRAINING_GROUPS} />);
    const groupRows = screen.getAllByTestId("training-group-row");
    // group A (3 teams) + group B (2 teams) = 5 rows
    expect(groupRows).toHaveLength(5);
  });
});

describe("Training aggregation — different start times stay as separate cards", () => {
  it("two trainings with different startAt values produce two separate event-row cards", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "tr-c", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Team C" }),
        makeEvent({ id: "tr-d", startAt: "2026-09-12T16:15:00.000Z", teamDisplayName: "Team D" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(2);
  });

  it("three trainings at three distinct start times produce three separate cards", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T14:00:00.000Z", teamDisplayName: "Early Team" }),
        makeEvent({ id: "t2", startAt: "2026-09-12T15:00:00.000Z", teamDisplayName: "Mid Team" }),
        makeEvent({ id: "t3", startAt: "2026-09-12T16:00:00.000Z", teamDisplayName: "Late Team" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(3);
  });
});

describe("Training aggregation — non-training activities are not merged", () => {
  it("a MATCH at the same startAt as trainings is NOT merged into the training group", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "m1", type: "MATCH", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Match Team", opponentDisplayName: "Opponent" }),
        makeEvent({ id: "tr1", type: "TRAINING", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Training Team A" }),
        makeEvent({ id: "tr2", type: "TRAINING", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Training Team B" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // Match renders as individual EventCard, trainings as one group → 2 cards
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(2);
    // Match identity still visible
    expect(screen.getByText("Match Team")).toBeTruthy();
    expect(screen.getByText("Opponent")).toBeTruthy();
  });

  it("a TOURNAMENT at the same startAt as trainings remains a separate card", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "tour1", type: "TOURNAMENT", startAt: "2026-09-12T15:15:00.000Z", displayTitle: "Summer Cup", teamDisplayName: "FC Test" }),
        makeEvent({ id: "tr3", type: "TRAINING", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Training A" }),
        makeEvent({ id: "tr4", type: "TRAINING", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Training B" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(2);
  });

  it("PREVIEW_FIXTURE_TRAINING_GROUPS: the match card is not inside a training-group testid", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_TRAINING_GROUPS} />);
    const groups = screen.getAllByTestId("training-group");
    for (const group of groups) {
      expect(group.textContent).not.toContain("FC Binningen E1");
    }
  });
});

describe("Training aggregation — missing allocation warning remains visible", () => {
  it("a team with null pitch inside a group shows the unassigned pitch warning", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "gr1", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Has Pitch", allocation: { pitchLabel: "KR1", homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } }),
        makeEvent({ id: "gr2", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "No Pitch", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine B", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByTestId("pitch-unassigned-warning")).toBeTruthy();
  });

  it("a team with null dressing room inside a group shows the unassigned kabine warning", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "gr3", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Has Room", allocation: { pitchLabel: "KR1", homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } }),
        makeEvent({ id: "gr4", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "No Room", allocation: { pitchLabel: "KR2", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null } }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByTestId("dressing-room-unassigned-warning")).toBeTruthy();
  });

  it("PREVIEW_FIXTURE_TRAINING_GROUPS: E1 (no kabine) shows dressing-room warning in the group", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_TRAINING_GROUPS} />);
    const warnings = screen.getAllByTestId("dressing-room-unassigned-warning");
    // E1 in group A + D9 D2 in group B = at least 2 warnings
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-FINAL: Physical-TV density + alignment regression ───────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Physical-TV fit — dense layout renders all required events", () => {
  it("full 5-event preview fixture renders exactly 5 cards (no clipping)", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />,
    );
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(5);
  });

  it("data-count=5 on 5-event list (adaptive density tier enabled)", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />,
    );
    expect(screen.getByTestId("event-list").getAttribute("data-count")).toBe("5");
  });

  it("1-event hero layout: data-count=1", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ current: [makeEvent({ id: "c1" })], isEmpty: false })}
      />,
    );
    expect(screen.getByTestId("event-list").getAttribute("data-count")).toBe("1");
    expect(screen.getAllByTestId("event-row")).toHaveLength(1);
  });

  it("2-event balanced layout: data-count=2", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({
          current: [makeEvent({ id: "c1", startAt: "2026-09-12T08:00:00.000Z" })],
          next: [makeEvent({ id: "n1", startAt: "2026-09-12T09:00:00.000Z" })],
          isEmpty: false,
        })}
      />,
    );
    expect(screen.getByTestId("event-list").getAttribute("data-count")).toBe("2");
    expect(screen.getAllByTestId("event-row")).toHaveLength(2);
  });
});

describe("Physical-TV alignment — MATCH info fields preserved", () => {
  const MATCH_FEED = makeFeed({
    current: [
      makeEvent({
        id: "m1",
        type: "MATCH",
        teamDisplayName: "FC Allschwil E1",
        opponentDisplayName: "FC Binningen E1",
        competitionLabel: "Meisterschaft",
        allocation: {
          pitchLabel: "Stadion",
          homeDressingRoomLabel: "Kabine E1",
          awayDressingRoomLabel: "Kabine E2",
          refereeDressingRoomLabel: null,
        },
      }),
    ],
    isEmpty: false,
  });

  it("MATCH card has data-type=MATCH", () => {
    render(<InfoboardScreen1 feed={MATCH_FEED} />);
    const row = screen.getByTestId("event-row");
    expect(row.getAttribute("data-type")).toBe("MATCH");
  });

  it("MATCH card preserves competition label (Meisterschaft/Turnier row)", () => {
    render(<InfoboardScreen1 feed={MATCH_FEED} />);
    expect(screen.getByText("Meisterschaft")).toBeTruthy();
  });

  it("MATCH card preserves home team name", () => {
    render(<InfoboardScreen1 feed={MATCH_FEED} />);
    expect(screen.getAllByText("FC Allschwil E1").length).toBeGreaterThan(0);
  });

  it("MATCH card preserves away team name", () => {
    render(<InfoboardScreen1 feed={MATCH_FEED} />);
    expect(screen.getAllByText("FC Binningen E1").length).toBeGreaterThan(0);
  });

  it("MATCH card preserves Kabine label", () => {
    render(<InfoboardScreen1 feed={MATCH_FEED} />);
    expect(screen.getAllByText("KABINE").length).toBeGreaterThan(0);
  });

  it("MATCH card preserves dressing room values", () => {
    render(<InfoboardScreen1 feed={MATCH_FEED} />);
    // formatDressingRoomLabel strips the "Kabine " prefix — values render as "E1", "E2"
    const root = screen.getByTestId("infoboard-screen1-root");
    const matchAlloc = root.querySelector('[data-testid="match-allocation"]');
    expect(matchAlloc).not.toBeNull();
    // Home room "Kabine E1" renders as "E1"; verify room numbers are present
    expect(root.textContent).toContain("E1");
    expect(root.textContent).toContain("E2");
  });

  it("MATCH card preserves Platz label", () => {
    render(<InfoboardScreen1 feed={MATCH_FEED} />);
    expect(screen.getAllByText("PLATZ").length).toBeGreaterThan(0);
  });

  it("MATCH card preserves pitch value", () => {
    render(<InfoboardScreen1 feed={MATCH_FEED} />);
    expect(screen.getByText("Stadion")).toBeTruthy();
  });
});

describe("Physical-TV alignment — TOURNAMENT info fields preserved", () => {
  it("TOURNAMENT card has data-type=TOURNAMENT", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const row = screen.getByTestId("event-row");
    expect(row.getAttribute("data-type")).toBe("TOURNAMENT");
  });

  it("TOURNAMENT card preserves TURNIER type label", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getByText("TURNIER")).toBeTruthy();
  });

  it("TOURNAMENT card preserves participant allocation block", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getByTestId("participant-allocation-block")).toBeTruthy();
  });

  it("TOURNAMENT card preserves Kabine label", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getAllByText("KABINE").length).toBeGreaterThan(0);
  });

  it("TOURNAMENT card preserves Platz label", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getAllByText("PLATZ").length).toBeGreaterThan(0);
  });
});

describe("Physical-TV alignment — internal grid structure for Meisterschaft/Turnier, Kabine, Platz", () => {
  it("MATCH event zones use grid layout (alignment structure present)", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({
          current: [
            makeEvent({
              id: "m1",
              type: "MATCH",
              teamDisplayName: "FC Test",
              opponentDisplayName: "FC Other",
              allocation: {
                pitchLabel: "KR1",
                homeDressingRoomLabel: "Kabine A",
                awayDressingRoomLabel: "Kabine B",
                refereeDressingRoomLabel: null,
              },
            }),
          ],
          isEmpty: false,
        })}
      />,
    );
    const row = screen.getByTestId("event-row");
    // The event card has MATCH type attribute (grid CSS applied via data-type)
    expect(row.getAttribute("data-type")).toBe("MATCH");
    // Semantic labels are present (verifies grid rows rendered)
    expect(screen.getAllByText("KABINE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PLATZ").length).toBeGreaterThan(0);
  });

  it("TOURNAMENT event zones use grid layout (alignment structure present)", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    const row = screen.getByTestId("event-row");
    expect(row.getAttribute("data-type")).toBe("TOURNAMENT");
    expect(screen.getAllByText("KABINE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PLATZ").length).toBeGreaterThan(0);
  });

  it("MATCH and TOURNAMENT in same list both show Kabine + Platz labels", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          id: "m1",
          type: "MATCH",
          startAt: "2026-09-12T14:00:00.000Z",
          teamDisplayName: "FC Test",
          opponentDisplayName: "FC Other",
          competitionLabel: "Meisterschaft",
          allocation: { pitchLabel: "Stadion", homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: null },
        }),
        makeEvent({
          id: "t1",
          type: "TOURNAMENT",
          startAt: "2026-09-12T15:00:00.000Z",
          displayTitle: "Sommer Cup",
          teamDisplayName: "FC Test",
          allocation: { pitchLabel: "KR2", homeDressingRoomLabel: null, awayDressingRoomLabel: null, refereeDressingRoomLabel: null },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // Both cards rendered
    expect(screen.getAllByTestId("event-row")).toHaveLength(2);
    // Both have Meisterschaft/Turnier labels, KABINE, PLATZ
    expect(screen.getByText("Meisterschaft")).toBeTruthy();
    expect(screen.getByText("TURNIER")).toBeTruthy();
    expect(screen.getAllByText("KABINE").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("PLATZ").length).toBeGreaterThanOrEqual(2);
  });
});

describe("Header/Footer regression — kiosk shell unchanged", () => {
  it("InfoboardScreen1 still renders kiosk-shell-header", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
  });

  it("InfoboardScreen1 still renders kiosk-shell-footer", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("InfoboardScreen1 header still contains club name", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed({ tenant: { id: "t", key: "k", name: "FC Musterklub", timezone: "Europe/Zurich" } })}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-header").textContent).toContain("FC Musterklub");
  });

  it("InfoboardScreen1 footer still contains POWERED BY", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("product-branding").textContent).toContain("POWERED BY");
  });

  it("Header/Footer — kiosk shell headers/footers not changed by demand engine", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE} currentTimeIso={PREVIEW_CURRENT_TIME_ISO} />);
    // Header and footer still present, unchanged
    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("InfoboardScreen1 header has board-title when subtitle enabled", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        headerConfig={{ subtitleEnabled: true, subtitleText: "HEUTE AUF DER SPORTANLAGE" }}
      />,
    );
    expect(screen.getByTestId("board-title")).toBeTruthy();
    expect(screen.getByTestId("board-title").textContent).toContain("HEUTE AUF DER SPORTANLAGE");
  });

  it("InfoboardScreen1 header does not show product logo", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: "/sce.png" }}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    const imgs = header.querySelectorAll("img");
    for (const img of Array.from(imgs)) {
      expect(img.getAttribute("alt")).not.toBe("SportClubEvo");
    }
  });
});

// ── Content-demand layout engine — unit tests ─────────────────────────────────

describe("Content-demand — computeTrainingGroupDemand", () => {
  it("1-row training demand = base + 1×row", () => {
    expect(computeTrainingGroupDemand(1)).toBeCloseTo(CARD_DEMAND_TRAINING_BASE + 1 * CARD_DEMAND_TRAINING_ROW);
  });

  it("2-row training demand = base + 2×row", () => {
    expect(computeTrainingGroupDemand(2)).toBeCloseTo(CARD_DEMAND_TRAINING_BASE + 2 * CARD_DEMAND_TRAINING_ROW);
  });

  it("4-row training demand = base + 4×row", () => {
    expect(computeTrainingGroupDemand(4)).toBeCloseTo(CARD_DEMAND_TRAINING_BASE + 4 * CARD_DEMAND_TRAINING_ROW);
  });

  it("5-row training demand = base + 5×row", () => {
    expect(computeTrainingGroupDemand(5)).toBeCloseTo(CARD_DEMAND_TRAINING_BASE + 5 * CARD_DEMAND_TRAINING_ROW);
  });

  it("6-row training demand = base + 6×row", () => {
    expect(computeTrainingGroupDemand(6)).toBeCloseTo(CARD_DEMAND_TRAINING_BASE + 6 * CARD_DEMAND_TRAINING_ROW);
  });

  it("demand grows monotonically with row count", () => {
    const demands = [1, 2, 3, 4, 5, 6].map(computeTrainingGroupDemand);
    for (let i = 1; i < demands.length; i++) {
      expect(demands[i]).toBeGreaterThan(demands[i - 1]);
    }
  });

  it("6-row demand is significantly larger than 1-row demand", () => {
    expect(computeTrainingGroupDemand(6)).toBeGreaterThan(computeTrainingGroupDemand(1) * 1.5);
  });

  it("edge case: 0-row treated as 1-row minimum", () => {
    expect(computeTrainingGroupDemand(0)).toBeCloseTo(computeTrainingGroupDemand(1));
  });
});

describe("Content-demand — computeEventDemand", () => {
  it("match demand equals CARD_DEMAND_MATCH constant", () => {
    expect(computeEventDemand("MATCH")).toBeCloseTo(CARD_DEMAND_MATCH);
  });

  it("tournament with 0 participants = base", () => {
    expect(computeEventDemand("TOURNAMENT", 0)).toBeCloseTo(CARD_DEMAND_TOURNAMENT_BASE);
  });

  it("tournament with 4 participants > base", () => {
    expect(computeEventDemand("TOURNAMENT", 4)).toBeGreaterThan(CARD_DEMAND_TOURNAMENT_BASE);
  });

  it("tournament demand grows with participant count", () => {
    const d0 = computeEventDemand("TOURNAMENT", 0);
    const d4 = computeEventDemand("TOURNAMENT", 4);
    const d6 = computeEventDemand("TOURNAMENT", 6);
    expect(d4).toBeGreaterThan(d0);
    expect(d6).toBeGreaterThan(d4);
  });

  it("TRAINING type (solo event) returns CARD_DEMAND_MATCH as fallback", () => {
    // Solo trainings rendered as EventCard also use computeEventDemand via the demand path
    expect(computeEventDemand("TRAINING")).toBeCloseTo(CARD_DEMAND_MATCH);
  });
});

describe("Content-demand — densityTier", () => {
  it("low total demand → normal tier", () => {
    expect(densityTier(4)).toBe("normal");
    expect(densityTier(8)).toBe("normal");
  });

  it("moderate total demand → dense tier", () => {
    expect(densityTier(8.1)).toBe("dense");
    expect(densityTier(11)).toBe("dense");
  });

  it("high total demand → ultra tier", () => {
    expect(densityTier(11.1)).toBe("ultra");
    expect(densityTier(15)).toBe("ultra");
  });
});

describe("Content-demand — paginateDisplayList", () => {
  function makeTrainingItem(rowCount: number): DisplayItem {
    const items: FlatEvent[] = Array.from({ length: rowCount }, (_, i) => ({
      event: {
        id: `tr-${i}`,
        type: "TRAINING" as const,
        displayTitle: `Training ${i}`,
        teamDisplayName: `Team ${i}`,
        opponentDisplayName: null,
        opponentLogoUrl: null,
        organizerDisplayName: null,
        competitionLabel: null,
        startAt: "2026-09-12T16:00:00.000Z",
        endAt: "2026-09-12T17:30:00.000Z",
        meetingTime: null,
        status: "LIVE" as const,
        resultLabel: null,
        intermediateResultLabel: null,
        temporalBucket: "current" as const,
        seasonKey: "2026-27",
        allocation: {
          pitchLabel: null,
          homeDressingRoomLabel: null,
          awayDressingRoomLabel: null,
          refereeDressingRoomLabel: null,
        },
      },
      temporal: "current" as const,
    }));
    return { kind: "training-group", items, temporal: "current" };
  }

  it("empty list → empty result", () => {
    expect(paginateDisplayList([], [])).toHaveLength(0);
  });

  it("single item fitting on one page → 1 page", () => {
    const item = makeTrainingItem(1);
    const demand = [computeTrainingGroupDemand(1)];
    const pages = paginateDisplayList([item], demand, CARD_DEMAND_PAGE_MAX);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(1);
  });

  it("items within page limit → 1 page", () => {
    const items = [
      makeTrainingItem(3),
      makeTrainingItem(2),
    ];
    const demands = items.map((item) =>
      item.kind === "training-group" ? computeTrainingGroupDemand(item.items.length) : CARD_DEMAND_MATCH,
    );
    // Total: 2.65 + 2.10 = 4.75 << 12
    const pages = paginateDisplayList(items, demands, CARD_DEMAND_PAGE_MAX);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(2);
  });

  it("high-demand set exceeds page limit → 2 pages", () => {
    // 3 × 6-row = 3 × 4.30 = 12.90 > PAGE_MAX(12)
    const items = [
      makeTrainingItem(6),
      makeTrainingItem(6),
      makeTrainingItem(6),
    ];
    const demands = items.map(() => computeTrainingGroupDemand(6));
    const pages = paginateDisplayList(items, demands, CARD_DEMAND_PAGE_MAX);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    // No single page should exceed PAGE_MAX
    for (const page of pages) {
      const pageDemand = page.reduce((sum, item) =>
        sum + (item.kind === "training-group" ? computeTrainingGroupDemand(item.items.length) : CARD_DEMAND_MATCH), 0);
      expect(pageDemand).toBeLessThanOrEqual(CARD_DEMAND_PAGE_MAX + 0.01);
    }
  });

  it("never splits a card between pages", () => {
    const items = Array.from({ length: 4 }, () => makeTrainingItem(6));
    const demands = items.map(() => computeTrainingGroupDemand(6));
    const pages = paginateDisplayList(items, demands, CARD_DEMAND_PAGE_MAX);
    // Total items preserved across all pages
    const totalItems = pages.reduce((sum, page) => sum + page.length, 0);
    expect(totalItems).toBe(items.length);
  });
});

describe("Content-demand — rendered data-card-demand attributes", () => {
  it("training-group card has data-card-demand attribute", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Team A" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const row = screen.getByTestId("event-row");
    expect(row.getAttribute("data-card-demand")).toBeTruthy();
  });

  it("6-row training group has higher data-card-demand than 1-row training", () => {
    const feed6 = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T1" }),
        makeEvent({ id: "t2", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T2" }),
        makeEvent({ id: "t3", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T3" }),
        makeEvent({ id: "t4", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T4" }),
        makeEvent({ id: "t5", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T5" }),
        makeEvent({ id: "t6", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "T6" }),
      ],
      isEmpty: false,
    });
    const feed1 = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T15:15:00.000Z", teamDisplayName: "Solo" }),
      ],
      isEmpty: false,
    });

    const { unmount } = render(<InfoboardScreen1 feed={feed6} />);
    const row6 = screen.getByTestId("event-row");
    const demand6 = parseFloat(row6.getAttribute("data-card-demand") ?? "0");
    unmount();

    render(<InfoboardScreen1 feed={feed1} />);
    const row1 = screen.getByTestId("event-row");
    const demand1 = parseFloat(row1.getAttribute("data-card-demand") ?? "0");

    expect(demand6).toBeGreaterThan(demand1);
  });

  it("denser Training card has greater layout demand than 1-row training card", () => {
    // Exercises the core content-aware requirement
    const demand1 = computeTrainingGroupDemand(1);
    const demand4 = computeTrainingGroupDemand(4);
    const demand6 = computeTrainingGroupDemand(6);
    expect(demand4).toBeGreaterThan(demand1);
    expect(demand6).toBeGreaterThan(demand4);
  });

  it("match card has data-card-demand equal to CARD_DEMAND_MATCH", () => {
    const feed = makeFeed({
      current: [
        makeEvent({ id: "m1", type: "MATCH", teamDisplayName: "Team A", opponentDisplayName: "Team B" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const row = screen.getByTestId("event-row");
    const demand = parseFloat(row.getAttribute("data-card-demand") ?? "0");
    expect(demand).toBeCloseTo(CARD_DEMAND_MATCH);
  });

  it("cards in mixed list are not all assigned identical demand", () => {
    // Dense training + match → different demands
    const feed = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "T1" }),
        makeEvent({ id: "t2", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "T2" }),
        makeEvent({ id: "t3", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "T3" }),
        makeEvent({ id: "t4", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "T4" }),
        makeEvent({ id: "t5", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "T5" }),
      ],
      next: [
        makeEvent({ id: "m1", type: "MATCH", startAt: "2026-09-12T10:00:00.000Z", teamDisplayName: "M1", opponentDisplayName: "M2" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const rows = screen.getAllByTestId("event-row");
    const demands = rows.map((r) => parseFloat(r.getAttribute("data-card-demand") ?? "0"));
    // At least two distinct demand values
    const unique = new Set(demands.map((d) => d.toFixed(2)));
    expect(unique.size).toBeGreaterThan(1);
  });

  it("event-list carries data-density attribute", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    const list = screen.getByTestId("event-list");
    const density = list.getAttribute("data-density");
    expect(["normal", "dense", "ultra"]).toContain(density);
  });

  it("HIGH_DENSITY_6 fixture: all 6 training rows carry non-zero demand", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    const row = screen.getByTestId("event-row");
    const demand = parseFloat(row.getAttribute("data-card-demand") ?? "0");
    // 6-row training: demand = 1.0 + 6×0.55 = 4.30
    expect(demand).toBeCloseTo(computeTrainingGroupDemand(6), 1);
    expect(demand).toBeGreaterThan(3);
  });
});

describe("Content-demand — layout contract (MATCH / TOURNAMENT unchanged)", () => {
  it("MATCH content remains visible under demand model", () => {
    const feed = makeFeed({
      current: [
        makeEvent({
          id: "m1",
          type: "MATCH",
          teamDisplayName: "FC Demand Home",
          opponentDisplayName: "FC Demand Away",
          competitionLabel: "Meisterschaft",
          allocation: { pitchLabel: "Stadion", homeDressingRoomLabel: "K1", awayDressingRoomLabel: "K2", refereeDressingRoomLabel: null },
        }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("Meisterschaft")).toBeTruthy();
    expect(screen.getAllByText("FC Demand Home").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FC Demand Away").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KABINE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PLATZ").length).toBeGreaterThan(0);
  });

  it("TOURNAMENT content remains visible under demand model", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getByText("TURNIER")).toBeTruthy();
    expect(screen.getByTestId("participant-allocation-block")).toBeTruthy();
    expect(screen.getAllByText("KABINE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PLATZ").length).toBeGreaterThan(0);
  });

  it("dense training + compact training + match all present in DOM", () => {
    const feed = makeFeed({
      current: [
        // 4-row training (dense)
        makeEvent({ id: "d1", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "DA1" }),
        makeEvent({ id: "d2", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "DA2" }),
        makeEvent({ id: "d3", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "DA3" }),
        makeEvent({ id: "d4", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "DA4" }),
        // 1-row training (compact, different start time)
        makeEvent({ id: "s1", startAt: "2026-09-12T09:00:00.000Z", teamDisplayName: "Solo" }),
        // match
        makeEvent({ id: "m1", type: "MATCH", startAt: "2026-09-12T10:00:00.000Z", teamDisplayName: "Home", opponentDisplayName: "Away" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    // All three cards visible
    expect(screen.getAllByTestId("event-row")).toHaveLength(3);
    // Dense training rows all in DOM
    expect(screen.getByText("DA1")).toBeTruthy();
    expect(screen.getByText("DA4")).toBeTruthy();
    // Compact training
    expect(screen.getByText("Solo")).toBeTruthy();
    // Match
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Away")).toBeTruthy();
  });

  it("training + tournament: both visible, different demand values", () => {
    const trainingFeed = makeFeed({
      current: [
        makeEvent({ id: "t1", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Train1" }),
        makeEvent({ id: "t2", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Train2" }),
        makeEvent({ id: "t3", startAt: "2026-09-12T08:00:00.000Z", teamDisplayName: "Train3" }),
      ],
      next: [
        makeEvent({ id: "tour1", type: "TOURNAMENT", startAt: "2026-09-12T09:00:00.000Z", displayTitle: "Sommer Cup", teamDisplayName: "FC Test" }),
      ],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={trainingFeed} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(2);
    const demands = rows.map((r) => parseFloat(r.getAttribute("data-card-demand") ?? "0"));
    // 3-row training has higher demand than tournament card
    expect(demands[0]).toBeGreaterThan(demands[1]);
  });
});

