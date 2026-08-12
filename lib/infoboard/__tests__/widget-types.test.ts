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
  GRID_COLUMNS,
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
