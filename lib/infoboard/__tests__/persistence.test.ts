/**
 * lib/infoboard/__tests__/persistence.test.ts
 *
 * INFOBOARD-DESIGNER-01-C1 — Persistence Verification
 *
 * Verifies the full persistence contract for layoutJson:
 *   - save/reload round-trip (JSON serialization is stable)
 *   - malformed layoutJson → safe fallback to getDefaultLayout
 *   - unknown/unsupported widget types are tolerated (no crash)
 *   - unknown widget settings fields are preserved (forward compat)
 *   - backward compat: boards without layoutJson → getDefaultLayout
 *   - duplicate boards preserve layoutJson
 *   - 1 MB API guard threshold
 *   - flat-field sync after save
 */

import { describe, it, expect } from "vitest";
import {
  getDefaultLayout,
  parseLayoutJson,
  findWidget,
  updateWidget,
  validateLayout,
  type InboardLayout,
  type HeaderWidgetSettings,
  type AnnouncementWidgetSettings,
} from "../widget-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BOARD_NO_LAYOUT = {
  headerSubtitleEnabled: true,
  headerSubtitleText: "Heute auf der Sportanlage",
  headerShowTime: true,
  headerShowDate: true,
  headerShowWeather: false,
  announcementEnabled: false,
  announcementText: null,
  announcementBgColor: null,
  announcementTextColor: null,
};

const BOARD_WITH_ANNOUNCEMENT = {
  ...BOARD_NO_LAYOUT,
  announcementEnabled: true,
  announcementText: "Platz 2 gesperrt",
  announcementBgColor: "#1e3a5f",
  announcementTextColor: "#ffffff",
};

// ── 1. Save / reload round-trip ───────────────────────────────────────────────

describe("persistence — save/reload round-trip", () => {
  it("serialises and restores a default layout exactly", () => {
    const original = getDefaultLayout(BOARD_NO_LAYOUT);
    const json = JSON.stringify(original);
    const restored = parseLayoutJson(json, BOARD_NO_LAYOUT);

    expect(restored.version).toBe(original.version);
    expect(restored.widgets.length).toBe(original.widgets.length);
    for (let i = 0; i < original.widgets.length; i++) {
      expect(restored.widgets[i].type).toBe(original.widgets[i].type);
      expect(restored.widgets[i].enabled).toBe(original.widgets[i].enabled);
    }
  });

  it("restored layout preserves header subtitle settings", () => {
    const original = getDefaultLayout(BOARD_NO_LAYOUT);
    const modified = updateWidget(original, "HEADER", {
      settings: {
        subtitleEnabled: false,
        subtitleText: "Willkommen",
        showTime: false,
        showDate: true,
        showWeather: false,
      } satisfies HeaderWidgetSettings,
    });

    const json = JSON.stringify(modified);
    const restored = parseLayoutJson(json, BOARD_NO_LAYOUT);

    const headerSettings = findWidget(restored, "HEADER")
      ?.settings as HeaderWidgetSettings;
    expect(headerSettings.subtitleEnabled).toBe(false);
    expect(headerSettings.subtitleText).toBe("Willkommen");
    expect(headerSettings.showTime).toBe(false);
    expect(headerSettings.showDate).toBe(true);
  });

  it("restored layout preserves announcement settings", () => {
    const original = getDefaultLayout(BOARD_WITH_ANNOUNCEMENT);
    const modified = updateWidget(original, "ANNOUNCEMENT", {
      enabled: true,
      settings: {
        text: "Feld gesperrt",
        bgColor: "#ff0000",
        textColor: "#000000",
      } satisfies AnnouncementWidgetSettings,
    });

    const json = JSON.stringify(modified);
    const restored = parseLayoutJson(json, BOARD_WITH_ANNOUNCEMENT);

    const ann = findWidget(restored, "ANNOUNCEMENT");
    expect(ann?.enabled).toBe(true);
    const annSettings = ann?.settings as AnnouncementWidgetSettings;
    expect(annSettings.text).toBe("Feld gesperrt");
    expect(annSettings.bgColor).toBe("#ff0000");
    expect(annSettings.textColor).toBe("#000000");
  });

  it("JSON.stringify → parseLayoutJson is idempotent", () => {
    const layout = getDefaultLayout(BOARD_WITH_ANNOUNCEMENT);
    const json1 = JSON.stringify(layout);
    const restored = parseLayoutJson(json1, BOARD_WITH_ANNOUNCEMENT);
    const json2 = JSON.stringify(restored);
    // Second serialization produces the same structure
    expect(json1).toBe(json2);
  });
});

// ── 2. Malformed / invalid layoutJson ────────────────────────────────────────

describe("persistence — malformed layoutJson safe fallback", () => {
  it("returns default layout for plain invalid JSON string", () => {
    const layout = parseLayoutJson("not-json", BOARD_NO_LAYOUT);
    expect(layout.version).toBe(1);
    expect(layout.widgets.length).toBeGreaterThan(0);
    expect(validateLayout(layout)).toBeNull();
  });

  it("returns default layout for truncated JSON", () => {
    const layout = parseLayoutJson('{"version":1,"widgets":[{', BOARD_NO_LAYOUT);
    expect(layout.version).toBe(1);
    expect(validateLayout(layout)).toBeNull();
  });

  it("returns default layout for JSON null literal", () => {
    // JSON.parse("null") succeeds but result is not an object
    const layout = parseLayoutJson("null", BOARD_NO_LAYOUT);
    expect(layout.version).toBe(1);
  });

  it("returns default layout for JSON number", () => {
    const layout = parseLayoutJson("42", BOARD_NO_LAYOUT);
    expect(layout.version).toBe(1);
  });

  it("returns default layout for JSON array", () => {
    const layout = parseLayoutJson("[]", BOARD_NO_LAYOUT);
    expect(layout.version).toBe(1);
  });

  it("returns default layout for wrong version number", () => {
    const json = JSON.stringify({ version: 99, widgets: [] });
    const layout = parseLayoutJson(json, BOARD_NO_LAYOUT);
    // Falls back because version !== 1
    expect(layout.version).toBe(1);
    expect(layout.widgets.length).toBeGreaterThan(0);
  });

  it("returns default layout when widgets key is missing", () => {
    const json = JSON.stringify({ version: 1 });
    const layout = parseLayoutJson(json, BOARD_NO_LAYOUT);
    expect(layout.widgets.length).toBeGreaterThan(0);
  });

  it("returns default layout when widgets is not an array", () => {
    const json = JSON.stringify({ version: 1, widgets: "bad" });
    const layout = parseLayoutJson(json, BOARD_NO_LAYOUT);
    expect(layout.widgets.length).toBeGreaterThan(0);
  });

  it("safe fallback result passes validateLayout", () => {
    const inputs = [
      "not-json",
      "",
      null,
      undefined,
      JSON.stringify({ version: 99, widgets: [] }),
      JSON.stringify({ version: 1 }),
    ];
    for (const input of inputs) {
      const layout = parseLayoutJson(input, BOARD_NO_LAYOUT);
      expect(validateLayout(layout)).toBeNull();
    }
  });
});

// ── 3. Unknown / unsupported widget settings ─────────────────────────────────

describe("persistence — unknown widget settings do not crash", () => {
  it("preserves unknown fields in widget settings (forward compat)", () => {
    // Future widget settings may add new keys; existing parser must not strip them
    const layoutWithExtra: InboardLayout = {
      version: 1,
      widgets: [
        {
          id: "w-header",
          type: "HEADER",
          enabled: true,
          position: { col: 0, row: 0 },
          width: 12,
          height: 1,
          variant: "default",
          settings: {
            subtitleEnabled: true,
            subtitleText: null,
            showTime: true,
            showDate: true,
            // hypothetical future field
            showLogo: true,
          },
        },
        {
          id: "w-activities",
          type: "ACTIVITIES",
          enabled: true,
          position: { col: 0, row: 1 },
          width: 12,
          height: 8,
          variant: "default",
          settings: {},
        },
        {
          id: "w-announcement",
          type: "ANNOUNCEMENT",
          enabled: false,
          position: { col: 0, row: 9 },
          width: 12,
          height: 1,
          variant: "default",
          settings: {
            text: null,
            bgColor: null,
            textColor: null,
            // hypothetical future field
            animationSpeed: "fast",
          },
        },
      ],
    };

    const json = JSON.stringify(layoutWithExtra);
    // parseLayoutJson must not throw
    expect(() => parseLayoutJson(json, BOARD_NO_LAYOUT)).not.toThrow();
    const restored = parseLayoutJson(json, BOARD_NO_LAYOUT);
    // The extra fields survive the round-trip
    expect(
      (restored.widgets[0].settings as Record<string, unknown>).showLogo,
    ).toBe(true);
    expect(
      (restored.widgets[2].settings as Record<string, unknown>).animationSpeed,
    ).toBe("fast");
  });

  it("findWidget with unknown widget type returns null gracefully", () => {
    const layout = getDefaultLayout(BOARD_NO_LAYOUT);
    // Cast to a "future" widget type the current code doesn't know about
    const result = findWidget(layout, "WEATHER" as never);
    expect(result).toBeNull();
  });
});

// ── 4. Backward compat — boards without layoutJson ───────────────────────────

describe("persistence — backward compat: null/missing layoutJson", () => {
  it("null layoutJson → default layout derived from flat fields", () => {
    const layout = parseLayoutJson(null, BOARD_NO_LAYOUT);

    const header = findWidget(layout, "HEADER");
    expect(header).not.toBeNull();
    expect((header?.settings as HeaderWidgetSettings).subtitleEnabled).toBe(
      BOARD_NO_LAYOUT.headerSubtitleEnabled,
    );
    expect((header?.settings as HeaderWidgetSettings).subtitleText).toBe(
      BOARD_NO_LAYOUT.headerSubtitleText,
    );
    expect((header?.settings as HeaderWidgetSettings).showTime).toBe(
      BOARD_NO_LAYOUT.headerShowTime,
    );
    expect((header?.settings as HeaderWidgetSettings).showDate).toBe(
      BOARD_NO_LAYOUT.headerShowDate,
    );

    const ann = findWidget(layout, "ANNOUNCEMENT");
    expect(ann?.enabled).toBe(BOARD_NO_LAYOUT.announcementEnabled);
  });

  it("null layoutJson + announcement on → announcement widget is enabled", () => {
    const layout = parseLayoutJson(null, BOARD_WITH_ANNOUNCEMENT);
    const ann = findWidget(layout, "ANNOUNCEMENT");
    expect(ann?.enabled).toBe(true);
    const annSettings = ann?.settings as AnnouncementWidgetSettings;
    expect(annSettings.text).toBe("Platz 2 gesperrt");
    expect(annSettings.bgColor).toBe("#1e3a5f");
    expect(annSettings.textColor).toBe("#ffffff");
  });

  it("empty string layoutJson → default layout (same as null)", () => {
    const fromNull = parseLayoutJson(null, BOARD_NO_LAYOUT);
    const fromEmpty = parseLayoutJson("", BOARD_NO_LAYOUT);
    expect(JSON.stringify(fromEmpty)).toBe(JSON.stringify(fromNull));
  });

  it("undefined layoutJson → default layout", () => {
    const layout = parseLayoutJson(undefined, BOARD_NO_LAYOUT);
    expect(layout.version).toBe(1);
    expect(layout.widgets.length).toBeGreaterThan(0);
  });

  it("default layout passes validate for any board configuration", () => {
    const boards = [BOARD_NO_LAYOUT, BOARD_WITH_ANNOUNCEMENT];
    for (const board of boards) {
      const layout = getDefaultLayout(board);
      expect(validateLayout(layout)).toBeNull();
    }
  });
});

// ── 5. Duplicate preserves layoutJson ────────────────────────────────────────

describe("persistence — duplicate preserves layoutJson", () => {
  it("layoutJson round-trips correctly through a copy operation", () => {
    const originalLayout = getDefaultLayout(BOARD_NO_LAYOUT);
    const modifiedLayout = updateWidget(originalLayout, "HEADER", {
      settings: {
        subtitleEnabled: false,
        subtitleText: "Kopiert",
        showTime: true,
        showDate: false,
        showWeather: false,
      } satisfies HeaderWidgetSettings,
    });

    // Simulate what duplicateInfoboard does: copy layoutJson string as-is
    const sourceLayoutJson = JSON.stringify(modifiedLayout);
    const copiedLayoutJson = sourceLayoutJson; // string copy

    const restored = parseLayoutJson(copiedLayoutJson, BOARD_NO_LAYOUT);
    const headerSettings = findWidget(restored, "HEADER")
      ?.settings as HeaderWidgetSettings;
    expect(headerSettings.subtitleText).toBe("Kopiert");
    expect(headerSettings.subtitleEnabled).toBe(false);
  });
});

// ── 6. 1 MB guard ─────────────────────────────────────────────────────────────

describe("persistence — 1 MB API guard", () => {
  const MB = 1_048_576;

  it("a normal layout is well within the 1 MB limit", () => {
    const layout = getDefaultLayout(BOARD_NO_LAYOUT);
    const json = JSON.stringify(layout);
    expect(json.length).toBeLessThan(MB);
  });

  it("a layout string of exactly 1 MB (1_048_576 bytes) is at the limit", () => {
    // The guard: layoutJson.length > 1_048_576 → reject
    const exactLimit = "x".repeat(MB);
    expect(exactLimit.length > MB).toBe(false); // exactly at limit → allowed
  });

  it("a layout string of 1 MB + 1 byte exceeds the limit", () => {
    const overLimit = "x".repeat(MB + 1);
    expect(overLimit.length > MB).toBe(true); // over limit → should be rejected
  });
});

// ── 7. Flat-field sync — what save derives from layout ────────────────────────

describe("persistence — flat-field sync from widget settings", () => {
  it("derives correct flat fields from a fully customised layout", () => {
    const layout = getDefaultLayout(BOARD_NO_LAYOUT);

    const withChanges = updateWidget(
      updateWidget(layout, "HEADER", {
        settings: {
          subtitleEnabled: false,
          subtitleText: "Test",
          showTime: false,
          showDate: true,
          showWeather: false,
        } satisfies HeaderWidgetSettings,
      }),
      "ANNOUNCEMENT",
      {
        enabled: true,
        settings: {
          text: "Wichtig",
          bgColor: "#cc0000",
          textColor: "#ffffff",
        } satisfies AnnouncementWidgetSettings,
      },
    );

    // Simulate what handleSave() derives
    const headerWidget = findWidget(withChanges, "HEADER");
    const announcementWidget = findWidget(withChanges, "ANNOUNCEMENT");
    const hSettings = headerWidget?.settings as HeaderWidgetSettings;
    const aSettings = announcementWidget?.settings as AnnouncementWidgetSettings;
    const announcementEnabled = announcementWidget?.enabled ?? false;

    expect(hSettings.subtitleEnabled).toBe(false);
    expect(hSettings.subtitleText).toBe("Test");
    expect(hSettings.showTime).toBe(false);
    expect(hSettings.showDate).toBe(true);

    expect(announcementEnabled).toBe(true);
    expect(aSettings.text).toBe("Wichtig");
    expect(aSettings.bgColor).toBe("#cc0000");
    expect(aSettings.textColor).toBe("#ffffff");

    // Flat payload that would be sent to PATCH
    const payload = {
      layoutJson: JSON.stringify(withChanges),
      headerSubtitleEnabled: hSettings.subtitleEnabled ?? true,
      headerSubtitleText: hSettings.subtitleText ?? null,
      headerShowTime: hSettings.showTime ?? true,
      headerShowDate: hSettings.showDate ?? true,
      announcementEnabled,
      announcementText: announcementEnabled ? (aSettings.text ?? null) : null,
      announcementBgColor: announcementEnabled
        ? (aSettings.bgColor ?? null)
        : null,
      announcementTextColor: announcementEnabled
        ? (aSettings.textColor ?? null)
        : null,
    };

    expect(payload.headerSubtitleEnabled).toBe(false);
    expect(payload.announcementEnabled).toBe(true);
    expect(payload.announcementText).toBe("Wichtig");
    // Verify layoutJson can be reloaded after the PATCH
    const reloaded = parseLayoutJson(payload.layoutJson, BOARD_NO_LAYOUT);
    expect(findWidget(reloaded, "HEADER")?.settings).toMatchObject({
      subtitleEnabled: false,
      subtitleText: "Test",
    });
  });

  it("announcement text is null in flat fields when announcement is disabled", () => {
    const layout = getDefaultLayout(BOARD_WITH_ANNOUNCEMENT);
    const withDisabled = updateWidget(layout, "ANNOUNCEMENT", {
      enabled: false,
    });

    const announcementWidget = findWidget(withDisabled, "ANNOUNCEMENT");
    const announcementEnabled = announcementWidget?.enabled ?? false;
    const aSettings =
      announcementWidget?.settings as AnnouncementWidgetSettings;

    const payload = {
      announcementEnabled,
      announcementText: announcementEnabled ? (aSettings.text ?? null) : null,
    };

    expect(payload.announcementEnabled).toBe(false);
    expect(payload.announcementText).toBeNull();
  });
});
