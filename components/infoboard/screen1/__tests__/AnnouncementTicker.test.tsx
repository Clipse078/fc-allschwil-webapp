/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for AnnouncementTicker.
 *
 * Focused on:
 *   1. Short announcement remains static (no data-scrolling="true")
 *   2. Overflowing announcement uses ticker (data-scrolling="true")
 *   3. Icon is fixed/separate from scrolling text
 *   4. Configured announcement colors are preserved on the parent footer
 *   5. Disabled announcement renders nothing
 *   6. Reduced-motion: animation disabled
 *
 * JSDOM has no layout engine, so scrollWidth/clientWidth are 0 by default.
 * Tests use getBoundingClientRect mocking to control overflow detection.
 */

import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AnnouncementTicker } from "@/components/infoboard/screen1/AnnouncementTicker";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";
import type { InfoboardAnnouncementPresentation } from "@/components/infoboard/screen1/screen1-presentation-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFeed(overrides: Partial<InfoboardScreen1Feed> = {}): InfoboardScreen1Feed {
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

/** Mock matchMedia to control prefers-reduced-motion */
function mockMatchMedia(prefersReducedMotion: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/**
 * Mock getBoundingClientRect by element data-testid.
 * The AnnouncementTicker uses:
 *   data-testid="announcement-ticker-viewport" → container width
 *   data-testid="announcement-ticker-text"     → text (first copy) width
 */
function mockBoundingRects({
  viewportWidth,
  textWidth,
}: {
  viewportWidth: number;
  textWidth: number;
}) {
  const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      let width = 0;
      const testId = this.dataset?.testid ?? "";
      if (testId === "announcement-ticker-viewport") {
        width = viewportWidth;
      } else if (testId === "announcement-ticker-text") {
        width = textWidth;
      }
      return {
        width,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }
  );
  return spy;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AnnouncementTicker — short message (fits)", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the text", async () => {
    mockBoundingRects({ viewportWidth: 800, textWidth: 200 });
    await act(async () => {
      render(<AnnouncementTicker text="Kurze Meldung" />);
    });
    expect(screen.getByTestId("announcement-ticker-text").textContent).toBe("Kurze Meldung");
  });

  it("does NOT activate ticker (data-scrolling=false) when text fits", async () => {
    mockBoundingRects({ viewportWidth: 800, textWidth: 200 });
    await act(async () => {
      render(<AnnouncementTicker text="Kurze Meldung" />);
    });
    const track = screen.getByTestId("announcement-ticker-track");
    expect(track.getAttribute("data-scrolling")).toBe("false");
  });

  it("does not render a clone copy when text fits", async () => {
    mockBoundingRects({ viewportWidth: 800, textWidth: 200 });
    await act(async () => {
      render(<AnnouncementTicker text="Kurze Meldung" />);
    });
    expect(screen.queryByTestId("announcement-ticker-clone")).toBeNull();
  });
});

describe("AnnouncementTicker — overflowing message", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("activates ticker (data-scrolling=true) when text overflows", async () => {
    mockBoundingRects({ viewportWidth: 300, textWidth: 900 });
    await act(async () => {
      render(
        <AnnouncementTicker text="Sehr langer Ankündigungstext der nicht in die Bar passt und gescrollt werden muss" />
      );
    });
    const track = screen.getByTestId("announcement-ticker-track");
    expect(track.getAttribute("data-scrolling")).toBe("true");
  });

  it("renders a second (aria-hidden) clone copy when overflowing", async () => {
    mockBoundingRects({ viewportWidth: 300, textWidth: 900 });
    await act(async () => {
      render(
        <AnnouncementTicker text="Sehr langer Ankündigungstext der nicht in die Bar passt" />
      );
    });
    const clone = screen.getByTestId("announcement-ticker-clone");
    expect(clone).toBeTruthy();
    expect(clone.getAttribute("aria-hidden")).toBe("true");
  });

  it("sets CSS custom properties for the animation distance and duration", async () => {
    mockBoundingRects({ viewportWidth: 300, textWidth: 900 });
    await act(async () => {
      render(<AnnouncementTicker text="Langer Text für den Ticker" />);
    });
    const track = screen.getByTestId("announcement-ticker-track");
    const style = track.getAttribute("style") ?? "";
    expect(style).toContain("--ticker-dist");
    expect(style).toContain("--ticker-duration");
  });
});

describe("AnnouncementTicker — prefers-reduced-motion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT activate ticker when reduced motion is preferred, even if text overflows", async () => {
    mockMatchMedia(true); // reduced motion ON
    mockBoundingRects({ viewportWidth: 300, textWidth: 900 });
    await act(async () => {
      render(
        <AnnouncementTicker text="Sehr langer Text der normalerweise scrollen würde" />
      );
    });
    const track = screen.getByTestId("announcement-ticker-track");
    expect(track.getAttribute("data-scrolling")).toBe("false");
  });

  it("text remains readable (first copy visible) under reduced motion", async () => {
    mockMatchMedia(true);
    mockBoundingRects({ viewportWidth: 300, textWidth: 900 });
    await act(async () => {
      render(<AnnouncementTicker text="Lesbare Meldung" />);
    });
    expect(screen.getByTestId("announcement-ticker-text").textContent).toBe("Lesbare Meldung");
  });
});

describe("Announcement bar — icon is separate/fixed from text", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders announcement icon separate from the ticker viewport", () => {
    mockMatchMedia(false);
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "Icon ist fixiert",
      backgroundColor: "#1e3a5f",
      textColor: "#ffffff",
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    const icon = screen.getByTestId("announcement-icon");
    const viewport = screen.getByTestId("announcement-ticker-viewport");
    // Icon and viewport should both exist and be siblings (not nested)
    expect(icon).toBeTruthy();
    expect(viewport).toBeTruthy();
    expect(icon.contains(viewport)).toBe(false);
    expect(viewport.contains(icon)).toBe(false);
  });
});

describe("Announcement bar — configured colors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies configured backgroundColor to the announcement bar", () => {
    mockMatchMedia(false);
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "Farb-Test",
      backgroundColor: "#ff4400",
      textColor: "#ffffff",
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    const bar = screen.getByTestId("announcement-bar");
    expect(bar.getAttribute("style")).toContain("background-color: rgb(255, 68, 0)");
  });

  it("applies configured textColor to the announcement bar", () => {
    mockMatchMedia(false);
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "Farb-Test",
      backgroundColor: "#1e3a5f",
      textColor: "#ffdd00",
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    const bar = screen.getByTestId("announcement-bar");
    expect(bar.getAttribute("style")).toContain("color: rgb(255, 221, 0)");
  });
});

describe("Announcement bar — disabled renders nothing", () => {
  it("renders no announcement bar when enabled=false", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: false,
      text: "Should not appear",
      backgroundColor: "#1e3a5f",
      textColor: "#ffffff",
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    expect(screen.queryByTestId("announcement-ticker-viewport")).toBeNull();
    expect(screen.queryByTestId("announcement-icon")).toBeNull();
  });

  it("renders no announcement bar when text is blank (even if enabled)", () => {
    const ann: InfoboardAnnouncementPresentation = {
      enabled: true,
      text: "",
      backgroundColor: "#1e3a5f",
      textColor: "#ffffff",
    };
    render(<InfoboardScreen1 feed={makeFeed()} announcement={ann} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("renders no announcement bar when announcement prop is absent", () => {
    render(<InfoboardScreen1 feed={makeFeed()} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });
});
