/**
 * lib/infoboard/__tests__/widget-types.test.ts
 *
 * Tests for the Infoboard Designer widget contract.
 * Verifies:
 *   - Default layout derivation from flat fields
 *   - Layout JSON parse/fallback
 *   - Widget find/update helpers
 *   - Layout validation
 */

import { describe, it, expect } from "vitest";
import {
  getDefaultLayout,
  parseLayoutJson,
  findWidget,
  updateWidget,
  validateLayout,
  widgetsOverlap,
  hasOverlapWithOthers,
  getLayoutTotalRows,
  WIDGET_CONSTRAINTS,
  DEFAULT_WIDGET_POSITIONS,
  GRID_COLUMNS,
  GRID_ROWS_DEFAULT,
  WIDGET_MIN_WIDTH,
  WIDGET_MAX_WIDTH,
  WIDGET_MIN_HEIGHT,
} from "../widget-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BOARD_DEFAULTS = {
  headerSubtitleEnabled: true,
  headerSubtitleText: "Heute auf der Sportanlage",
  headerShowTime: true,
  headerShowDate: true,
  announcementEnabled: false,
  announcementText: null,
  announcementBgColor: null,
  announcementTextColor: null,
};

const BOARD_WITH_ANNOUNCEMENT = {
  ...BOARD_DEFAULTS,
  announcementEnabled: true,
  announcementText: "Platz 2 gesperrt",
  announcementBgColor: "#1e3a5f",
  announcementTextColor: "#ffffff",
};

// ── Default layout ────────────────────────────────────────────────────────────

describe("getDefaultLayout", () => {
  it("returns a version-1 layout", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    expect(layout.version).toBe(1);
  });

  it("includes HEADER, ACTIVITIES, and ANNOUNCEMENT widgets", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const types = layout.widgets.map((w) => w.type);
    expect(types).toContain("HEADER");
    expect(types).toContain("ACTIVITIES");
    expect(types).toContain("ANNOUNCEMENT");
  });

  it("HEADER widget is always enabled", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const header = layout.widgets.find((w) => w.type === "HEADER");
    expect(header?.enabled).toBe(true);
  });

  it("ACTIVITIES widget is always enabled", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const activities = layout.widgets.find((w) => w.type === "ACTIVITIES");
    expect(activities?.enabled).toBe(true);
  });

  it("ANNOUNCEMENT widget enabled state matches board.announcementEnabled", () => {
    const layoutOff = getDefaultLayout(BOARD_DEFAULTS);
    const annOff = layoutOff.widgets.find((w) => w.type === "ANNOUNCEMENT");
    expect(annOff?.enabled).toBe(false);

    const layoutOn = getDefaultLayout(BOARD_WITH_ANNOUNCEMENT);
    const annOn = layoutOn.widgets.find((w) => w.type === "ANNOUNCEMENT");
    expect(annOn?.enabled).toBe(true);
  });

  it("HEADER settings reflect board flat fields", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const header = layout.widgets.find((w) => w.type === "HEADER");
    expect(header?.settings).toMatchObject({
      subtitleEnabled: true,
      subtitleText: "Heute auf der Sportanlage",
      showTime: true,
      showDate: true,
    });
  });

  it("ANNOUNCEMENT settings reflect board flat fields", () => {
    const layout = getDefaultLayout(BOARD_WITH_ANNOUNCEMENT);
    const ann = layout.widgets.find((w) => w.type === "ANNOUNCEMENT");
    expect(ann?.settings).toMatchObject({
      text: "Platz 2 gesperrt",
      bgColor: "#1e3a5f",
      textColor: "#ffffff",
    });
  });

  it("all widgets fit within the 12-column grid", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    for (const w of layout.widgets) {
      expect(w.position.col + w.width).toBeLessThanOrEqual(GRID_COLUMNS);
    }
  });

  it("all widgets have valid minimum width and height", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    for (const w of layout.widgets) {
      expect(w.width).toBeGreaterThanOrEqual(WIDGET_MIN_WIDTH);
      expect(w.width).toBeLessThanOrEqual(WIDGET_MAX_WIDTH);
      expect(w.height).toBeGreaterThanOrEqual(WIDGET_MIN_HEIGHT);
    }
  });
});

// ── parseLayoutJson ───────────────────────────────────────────────────────────

describe("parseLayoutJson", () => {
  it("returns default layout when json is null", () => {
    const layout = parseLayoutJson(null, BOARD_DEFAULTS);
    expect(layout.version).toBe(1);
    expect(layout.widgets.length).toBeGreaterThan(0);
  });

  it("returns default layout when json is undefined", () => {
    const layout = parseLayoutJson(undefined, BOARD_DEFAULTS);
    expect(layout.version).toBe(1);
  });

  it("returns default layout when json is empty string", () => {
    const layout = parseLayoutJson("", BOARD_DEFAULTS);
    expect(layout.version).toBe(1);
  });

  it("parses a valid v1 layout JSON", () => {
    const original = getDefaultLayout(BOARD_DEFAULTS);
    const json = JSON.stringify(original);
    const parsed = parseLayoutJson(json, BOARD_DEFAULTS);
    expect(parsed.version).toBe(1);
    expect(parsed.widgets.length).toBe(original.widgets.length);
  });

  it("returns default layout when version is wrong", () => {
    const json = JSON.stringify({ version: 2, widgets: [] });
    const layout = parseLayoutJson(json, BOARD_DEFAULTS);
    // Falls back to default
    expect(layout.version).toBe(1);
    expect(layout.widgets.length).toBeGreaterThan(0);
  });

  it("returns default layout when JSON is invalid", () => {
    const layout = parseLayoutJson("not-json", BOARD_DEFAULTS);
    expect(layout.version).toBe(1);
  });

  it("returns default layout when widgets is missing", () => {
    const json = JSON.stringify({ version: 1 });
    const layout = parseLayoutJson(json, BOARD_DEFAULTS);
    // Falls back to default because widgets array is missing
    expect(layout.version).toBe(1);
    expect(layout.widgets.length).toBeGreaterThan(0);
  });
});

// ── findWidget ────────────────────────────────────────────────────────────────

describe("findWidget", () => {
  it("finds an existing widget by type", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const header = findWidget(layout, "HEADER");
    expect(header).not.toBeNull();
    expect(header?.type).toBe("HEADER");
  });

  it("returns null for a type not in the layout", () => {
    const layout = { version: 1 as const, widgets: [] };
    expect(findWidget(layout, "HEADER")).toBeNull();
  });
});

// ── updateWidget ──────────────────────────────────────────────────────────────

describe("updateWidget", () => {
  it("updates the enabled state of a widget", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const updated = updateWidget(layout, "ANNOUNCEMENT", { enabled: true });
    const ann = findWidget(updated, "ANNOUNCEMENT");
    expect(ann?.enabled).toBe(true);
  });

  it("updates settings of a widget", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const newSettings = { subtitleEnabled: false, subtitleText: null, showTime: false, showDate: false };
    const updated = updateWidget(layout, "HEADER", { settings: newSettings });
    const header = findWidget(updated, "HEADER");
    expect(header?.settings).toMatchObject({ subtitleEnabled: false });
  });

  it("does not mutate the original layout", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const originalEnabled = findWidget(layout, "ANNOUNCEMENT")?.enabled;
    updateWidget(layout, "ANNOUNCEMENT", { enabled: !originalEnabled });
    expect(findWidget(layout, "ANNOUNCEMENT")?.enabled).toBe(originalEnabled);
  });

  it("returns layout unchanged when type not found", () => {
    const layout = { version: 1 as const, widgets: [] };
    const updated = updateWidget(layout, "HEADER", { enabled: false });
    expect(updated.widgets.length).toBe(0);
  });
});

// ── validateLayout ────────────────────────────────────────────────────────────

describe("validateLayout", () => {
  it("returns null for a valid default layout", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    expect(validateLayout(layout)).toBeNull();
  });

  it("returns error for wrong version", () => {
    const layout = { version: 2 as never, widgets: [] };
    expect(validateLayout(layout)).not.toBeNull();
  });

  it("returns error for negative position", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const bad = updateWidget(layout, "HEADER", { position: { col: -1, row: 0 } });
    expect(validateLayout(bad)).not.toBeNull();
  });

  it("returns error for widget exceeding grid width", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    // col=6 + width=8 = 14 > GRID_COLUMNS(12)
    const bad = updateWidget(layout, "ACTIVITIES", { position: { col: 6, row: 1 }, width: 8 });
    expect(validateLayout(bad)).not.toBeNull();
  });

  it("returns error for width below minimum", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const bad = updateWidget(layout, "HEADER", { width: 0 });
    expect(validateLayout(bad)).not.toBeNull();
  });

  it("returns error for height below minimum", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const bad = updateWidget(layout, "ACTIVITIES", { height: 0 });
    expect(validateLayout(bad)).not.toBeNull();
  });

  it("accepts valid custom positions within the grid", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const mod = updateWidget(layout, "HEADER", { position: { col: 0, row: 0 }, width: 12 });
    expect(validateLayout(mod)).toBeNull();
  });
});

// ── Designer-02: widgetsOverlap ───────────────────────────────────────────────

describe("widgetsOverlap", () => {
  const base = {
    id: "a",
    type: "HEADER" as const,
    enabled: true,
    variant: "default",
    settings: {},
  };

  it("returns true for identical placements", () => {
    const a = { ...base, position: { col: 0, row: 0 }, width: 12, height: 1 };
    const b = { ...base, id: "b", position: { col: 0, row: 0 }, width: 12, height: 1 };
    expect(widgetsOverlap(a, b)).toBe(true);
  });

  it("returns true for partial horizontal overlap", () => {
    const a = { ...base, position: { col: 0, row: 0 }, width: 6, height: 2 };
    const b = { ...base, id: "b", position: { col: 4, row: 0 }, width: 6, height: 2 };
    expect(widgetsOverlap(a, b)).toBe(true);
  });

  it("returns false when widgets are in different rows with no vertical overlap", () => {
    const a = { ...base, position: { col: 0, row: 0 }, width: 12, height: 1 };
    const b = { ...base, id: "b", position: { col: 0, row: 1 }, width: 12, height: 8 };
    expect(widgetsOverlap(a, b)).toBe(false);
  });

  it("returns false when widgets are adjacent horizontally", () => {
    const a = { ...base, position: { col: 0, row: 0 }, width: 6, height: 2 };
    const b = { ...base, id: "b", position: { col: 6, row: 0 }, width: 6, height: 2 };
    expect(widgetsOverlap(a, b)).toBe(false);
  });

  it("returns false when widgets are adjacent vertically", () => {
    const a = { ...base, position: { col: 0, row: 0 }, width: 12, height: 3 };
    const b = { ...base, id: "b", position: { col: 0, row: 3 }, width: 12, height: 3 };
    expect(widgetsOverlap(a, b)).toBe(false);
  });

  it("default layout widgets do not overlap each other", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const [a, b, c] = layout.widgets;
    expect(widgetsOverlap(a, b)).toBe(false);
    expect(widgetsOverlap(b, c)).toBe(false);
    expect(widgetsOverlap(a, c)).toBe(false);
  });
});

// ── Designer-02: hasOverlapWithOthers ────────────────────────────────────────

describe("hasOverlapWithOthers", () => {
  it("detects overlap when moved into another widget's space", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const activities = findWidget(layout, "ACTIVITIES")!;
    // Move ACTIVITIES to row 0 → overlaps HEADER
    expect(
      hasOverlapWithOthers(activities, { col: 0, row: 0 }, 12, 8, layout.widgets),
    ).toBe(true);
  });

  it("returns false for a valid non-overlapping position", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const activities = findWidget(layout, "ACTIVITIES")!;
    // Stays at row 1 — no overlap
    expect(
      hasOverlapWithOthers(activities, { col: 0, row: 1 }, 12, 8, layout.widgets),
    ).toBe(false);
  });

  it("does not count the widget against itself", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const header = findWidget(layout, "HEADER")!;
    // Check header against itself at its own position — should be false
    expect(
      hasOverlapWithOthers(header, { col: 0, row: 0 }, 12, 1, layout.widgets),
    ).toBe(false);
  });

  it("ignores disabled widgets when checking overlap", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    // ANNOUNCEMENT is disabled in BOARD_DEFAULTS
    const header = findWidget(layout, "HEADER")!;
    const ann = findWidget(layout, "ANNOUNCEMENT")!;
    // Move header to row 9 — would "overlap" announcement but announcement is disabled
    expect(
      hasOverlapWithOthers(header, { col: 0, row: 9 }, 12, 1, layout.widgets),
    ).toBe(false);
    // Double-check: if announcement were enabled, overlap should be detected
    const layoutWithAnn = updateWidget(layout, "ANNOUNCEMENT", { enabled: true });
    const annEnabled = findWidget(layoutWithAnn, "ANNOUNCEMENT")!;
    expect(
      hasOverlapWithOthers(header, { col: 0, row: 9 }, 12, 1, layoutWithAnn.widgets),
    ).toBe(true);
    void ann;
    void annEnabled;
  });
});

// ── Designer-02: getLayoutTotalRows ──────────────────────────────────────────

describe("getLayoutTotalRows", () => {
  it("returns GRID_ROWS_DEFAULT for the default layout", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    expect(getLayoutTotalRows(layout)).toBe(GRID_ROWS_DEFAULT);
  });

  it("never returns less than GRID_ROWS_DEFAULT", () => {
    // Layout with all widgets squeezed into rows 0-2
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    const small = {
      ...layout,
      widgets: layout.widgets.map((w) => ({
        ...w,
        position: { col: w.position.col, row: 0 },
        height: 1,
      })),
    };
    expect(getLayoutTotalRows(small)).toBeGreaterThanOrEqual(GRID_ROWS_DEFAULT);
  });

  it("returns max of GRID_ROWS_DEFAULT and actual extent", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    // Push activities to row 15, height 3 → max extent = 18
    const big = updateWidget(layout, "ACTIVITIES", {
      position: { col: 0, row: 15 },
      height: 3,
      enabled: true,
    });
    expect(getLayoutTotalRows(big)).toBe(18);
  });
});

// ── Designer-02: WIDGET_CONSTRAINTS ──────────────────────────────────────────

describe("WIDGET_CONSTRAINTS", () => {
  it("HEADER is full-width and fixed-col", () => {
    expect(WIDGET_CONSTRAINTS.HEADER.fixedWidth).toBe(true);
    expect(WIDGET_CONSTRAINTS.HEADER.fixedCol).toBe(true);
    expect(WIDGET_CONSTRAINTS.HEADER.maxWidth).toBe(GRID_COLUMNS);
  });

  it("HEADER cannot be resized", () => {
    expect(WIDGET_CONSTRAINTS.HEADER.canResize).toBe(false);
  });

  it("ACTIVITIES can be resized", () => {
    expect(WIDGET_CONSTRAINTS.ACTIVITIES.canResize).toBe(true);
    expect(WIDGET_CONSTRAINTS.ACTIVITIES.minWidth).toBeGreaterThanOrEqual(WIDGET_MIN_WIDTH);
    expect(WIDGET_CONSTRAINTS.ACTIVITIES.maxWidth).toBeLessThanOrEqual(WIDGET_MAX_WIDTH);
    expect(WIDGET_CONSTRAINTS.ACTIVITIES.minHeight).toBeGreaterThanOrEqual(WIDGET_MIN_HEIGHT);
  });

  it("ANNOUNCEMENT can be resized with sensible width minimum", () => {
    expect(WIDGET_CONSTRAINTS.ANNOUNCEMENT.canResize).toBe(true);
    expect(WIDGET_CONSTRAINTS.ANNOUNCEMENT.minWidth).toBeGreaterThanOrEqual(4);
  });
});

// ── Designer-02: DEFAULT_WIDGET_POSITIONS ─────────────────────────────────────

describe("DEFAULT_WIDGET_POSITIONS", () => {
  it("default positions match getDefaultLayout positions", () => {
    const layout = getDefaultLayout(BOARD_DEFAULTS);
    for (const w of layout.widgets) {
      const dp = DEFAULT_WIDGET_POSITIONS[w.type];
      expect(dp.col).toBe(w.position.col);
      expect(dp.row).toBe(w.position.row);
      expect(dp.width).toBe(w.width);
      expect(dp.height).toBe(w.height);
    }
  });

  it("all default positions fit within GRID_COLUMNS", () => {
    for (const [, pos] of Object.entries(DEFAULT_WIDGET_POSITIONS)) {
      expect(pos.col + pos.width).toBeLessThanOrEqual(GRID_COLUMNS);
    }
  });
});
