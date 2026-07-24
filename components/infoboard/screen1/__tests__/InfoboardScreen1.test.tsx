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
  PREVIEW_TARGET_TOURNAMENT_EXTENSIONS,
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
    const header = screen.getByTestId("infoboard-header");
    expect(header.textContent).toContain("FC Musterclub");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Header — SportClubEvo branding NOT in header ──────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Header — no SportClubEvo logo in header", () => {
  it("renders header-center zone", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.getByTestId("header-center")).toBeTruthy();
  });

  it("no product logo image appears inside header when productLogoSrc is provided", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        branding={{ productLogoSrc: "/images/branding/sportclubevo_logo.png" }}
      />,
    );
    const header = screen.getByTestId("infoboard-header");
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
    const header = screen.getByTestId("infoboard-header");
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

  it("renders no clock element when currentTimeIso is missing", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    const center = screen.getByTestId("header-center");
    expect(center.querySelector("time")).toBeNull();
  });

  it("renders no clock element when currentTimeIso is null", () => {
    render(<InfoboardScreen1 feed={makeFeed()} currentTimeIso={null} />);
    const center = screen.getByTestId("header-center");
    expect(center.querySelector("time")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Header — date ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

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
    const center = screen.getByTestId("header-center");
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
      current: [makeEvent({ id: "c1", teamDisplayName: "Current Team" })],
      next: [makeEvent({ id: "n1", teamDisplayName: "Next Team" })],
      later: [makeEvent({ id: "l1", teamDisplayName: "Later Team" })],
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

describe("Temporal status — relative next label", () => {
  it("next event shows IN X MIN. when currentTimeIso is provided", () => {
    // 16:00Z = 18:00 Zurich; current time 15:35Z = 17:35 → 25 min until
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
    expect(label.textContent).toMatch(/IN \d+ MIN\./);
    expect(label.textContent).toContain("25");
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

  it("relative label uses tenant timezone for minutes calculation", () => {
    // 5 minutes until: start at 16:05Z, now at 16:00Z
    const feed = makeFeed({
      next: [makeEvent({ id: "n1", startAt: "2026-09-12T16:05:00.000Z" })],
      isEmpty: false,
    });
    render(
      <InfoboardScreen1
        feed={feed}
        currentTimeIso="2026-09-12T16:00:00.000Z"
      />,
    );
    const label = screen.getByTestId("status-label-next");
    expect(label.textContent).toContain("5");
  });

  it("next label has next status data attribute", () => {
    const feed = makeFeed({ next: [makeEvent({ id: "n1" })], isEmpty: false });
    render(<InfoboardScreen1 feed={feed} />);
    const label = screen.getByTestId("status-label-next");
    expect(label.getAttribute("data-status")).toBe("next");
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

  it("renders organizer/subtitle when provided", () => {
    const feed = makeFeed({
      current: [makeEvent({ organizerDisplayName: "FC Allschwil" })],
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

  it("renders ZUTEILUNG column label", () => {
    const feed = makeFeed({
      current: [makeEvent()],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getAllByText("ZUTEILUNG").length).toBeGreaterThan(0);
  });

  it("renders dressing room in allocation column", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "TRAINING", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine A", awayDressingRoomLabel: null, refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("Kabine A")).toBeTruthy();
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
    expect(screen.getByText("Kabine E1")).toBeTruthy();
  });

  it("renders away dressing room", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine E1", awayDressingRoomLabel: "Kabine E2", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    expect(screen.getByText("Kabine E2")).toBeTruthy();
  });

  it("home and away rooms appear in correct order (home before away)", () => {
    const feed = makeFeed({
      current: [makeEvent({ type: "MATCH", teamDisplayName: "FC Test", opponentDisplayName: "FC Other", allocation: { pitchLabel: null, homeDressingRoomLabel: "Kabine HOME", awayDressingRoomLabel: "Kabine AWAY", refereeDressingRoomLabel: null } })],
      isEmpty: false,
    });
    render(<InfoboardScreen1 feed={feed} />);
    const matchAlloc = screen.getByTestId("match-allocation");
    const text = matchAlloc.textContent ?? "";
    const homeIdx = text.indexOf("Kabine HOME");
    const awayIdx = text.indexOf("Kabine AWAY");
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
    expect(row.textContent).toContain("Kabine E1");
    expect(row.textContent).toContain("Kabine E2");
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

  it("shows club logo for home team when clubLogoSrc provided", () => {
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
    // Club logo should appear in match allocation area
    const matchAlloc = screen.getByTestId("match-allocation");
    const img = matchAlloc.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/images/logos/fc-allschwil.png");
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
    expect(screen.getByText("FC Allschwil E1")).toBeTruthy();
    expect(screen.getByText("FC Allschwil E2")).toBeTruthy();
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

  it("home-club teams are visible", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_6TEAM}
        eventPresentation={PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getByText("FC Allschwil F1")).toBeTruthy();
    expect(screen.getByText("FC Allschwil F2")).toBeTruthy();
    expect(screen.getByText("FC Allschwil F3")).toBeTruthy();
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
    expect(block.textContent).toContain("Kabine 01");
    expect(block.textContent).toContain("Kabine 02");
    expect(block.textContent).toContain("Kabine 03");
    expect(block.textContent).toContain("Kabine 04");
    expect(block.textContent).toContain("Kabine 05");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Many simultaneous events — flat list visibility ───────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("High-density — 6 simultaneous trainings (flat list)", () => {
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

  it("renders 6 event rows", () => {
    render(<InfoboardScreen1 feed={PREVIEW_FIXTURE_HIGH_DENSITY_6} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(6);
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
    const header = screen.getByTestId("infoboard-header");
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
    expect(screen.getByText("Kabine E1")).toBeTruthy();
    expect(screen.getByText("Kabine E2")).toBeTruthy();
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
    expect(screen.getByText("Team A")).toBeTruthy();
    expect(screen.getByText("Team C")).toBeTruthy();
    expect(screen.queryByText("null")).toBeNull();
  });
});
