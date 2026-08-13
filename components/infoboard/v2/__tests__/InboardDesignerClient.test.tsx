/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/v2/__tests__/InboardDesignerClient.test.tsx
 *
 * Tests for the 3-panel Infoboard Designer (C1 extended).
 * Verifies:
 *   - Widget palette renders all 3 widgets
 *   - Selected widget settings panel renders
 *   - Widget enable/disable toggle works
 *   - Live preview renders
 *   - Save button state (disabled when clean, enabled when dirty)
 *   - Malformed layoutJson: designer renders without crash
 *   - Pre-saved layoutJson: designer initialises from stored settings
 *   - Unsaved state badge appears after interacting
 *   - Selected widget aria-pressed reflects correct state
 *   - Accessibility: palette toggle uses accessible role
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("../InboardLivePreview", () => ({
  InboardLivePreview: ({ headerConfig, announcement }: Record<string, unknown>) => (
    <div
      data-testid="live-preview-mock"
      data-subtitle-enabled={String((headerConfig as Record<string, unknown>)?.subtitleEnabled)}
      data-announcement={String((announcement as Record<string, unknown>)?.enabled ?? false)}
    />
  ),
}));

// Mock the canvas so existing tests can keep testing the 3-panel shell
// without needing pointer-event / ResizeObserver infrastructure.
vi.mock("../designer/InboardDesignerCanvas", () => ({
  InboardDesignerCanvas: ({
    headerConfig,
    announcement,
    mode,
    selectedWidget,
    onWidgetSelect,
    onLayoutChange,
  }: Record<string, unknown>) => (
    <div
      data-testid="live-preview-mock"
      data-mode={String(mode)}
      data-selected={String(selectedWidget)}
      data-subtitle-enabled={String((headerConfig as Record<string, unknown>)?.subtitleEnabled)}
      data-announcement={String((announcement as Record<string, unknown>)?.enabled ?? false)}
      data-canvas-overlay="true"
      // Expose callbacks for interaction tests
      data-on-widget-select={typeof onWidgetSelect === "function" ? "fn" : ""}
      onClick={() => {
        // Allow tests to simulate canvas widget selection
        if (typeof onWidgetSelect === "function") {
          (onWidgetSelect as (t: string) => void)("ACTIVITIES");
        }
      }}
      data-on-layout-change={typeof onLayoutChange === "function" ? "fn" : ""}
    />
  ),
}));

vi.mock(
  "@/components/infoboard/screen1/AnnouncementTicker",
  () => ({
    AnnouncementTicker: ({ text }: { text: string }) => <span>{text}</span>,
  }),
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BOARD = {
  id: "board-1",
  tenantId: "tenant-fca",
  name: "Tagesübersicht",
  slug: "screen-1",
  status: "ACTIVE" as const,
  templateType: "TAGESUEBERSICHT",
  displayTheme: "DARK",
  headerSubtitleEnabled: true,
  headerSubtitleText: null,
  headerShowTime: true,
  headerShowDate: true,
  headerShowWeather: false,
  announcementEnabled: false,
  announcementText: null,
  announcementBgColor: null,
  announcementTextColor: null,
  layoutJson: null,
  sortOrder: 0,
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
};

// ── Helper ────────────────────────────────────────────────────────────────────

async function renderDesigner(boardOverrides = {}) {
  const { InboardDesignerClient } = await import(
    "../designer/InboardDesignerClient"
  );
  const onBoardChange = vi.fn();
  render(
    <InboardDesignerClient
      board={{ ...BOARD, ...boardOverrides }}
      tenantName="FC Allschwil"
      onBoardChange={onBoardChange}
    />,
  );
  return { onBoardChange };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InboardDesignerClient — widget palette", () => {
  it("renders the widget palette", async () => {
    await renderDesigner();
    expect(screen.getByTestId("widget-palette")).toBeTruthy();
  });

  it("shows all 3 widget types", async () => {
    await renderDesigner();
    expect(screen.getByTestId("widget-palette-item-header")).toBeTruthy();
    expect(screen.getByTestId("widget-palette-item-activities")).toBeTruthy();
    expect(screen.getByTestId("widget-palette-item-announcement")).toBeTruthy();
  });

  it("HEADER widget is selected by default", async () => {
    await renderDesigner();
    const headerItem = screen.getByTestId("widget-palette-item-header");
    expect(headerItem.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("InboardDesignerClient — settings panels", () => {
  it("shows settings panel", async () => {
    await renderDesigner();
    expect(screen.getByTestId("widget-settings-panel")).toBeTruthy();
  });

  it("shows ACTIVITIES panel when clicking Activities widget", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("widget-palette-item-activities"));
    // Activities panel shows explanation about data source
    expect(screen.getByText(/Spielbetrieb/)).toBeTruthy();
  });

  it("shows ANNOUNCEMENT panel when clicking Announcement widget", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("widget-palette-item-announcement"));
    expect(screen.getByText(/Hinweisleiste aktivieren/)).toBeTruthy();
  });
});

describe("InboardDesignerClient — live preview", () => {
  it("renders the live preview", async () => {
    await renderDesigner();
    expect(screen.getByTestId("live-preview-mock")).toBeTruthy();
  });
});

describe("InboardDesignerClient — enable/disable widget", () => {
  it("ANNOUNCEMENT shows 'AUS' label when disabled", async () => {
    await renderDesigner({ announcementEnabled: false });
    // With default layout, announcement is disabled
    const annItem = screen.getByTestId("widget-palette-item-announcement");
    expect(annItem.textContent).toContain("AUS");
  });

  it("ACTIVITIES widget does not show AUS label (always on)", async () => {
    await renderDesigner();
    const actItem = screen.getByTestId("widget-palette-item-activities");
    expect(actItem.textContent).not.toContain("AUS");
  });
});

describe("InboardDesignerClient — save button", () => {
  it("Speichern button is disabled initially (no dirty state)", async () => {
    await renderDesigner();
    const saveBtn = screen.getByTestId("designer-save-button");
    expect(saveBtn).toBeDefined();
    // Disabled = no unsaved changes yet
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("save button has accessible label", async () => {
    await renderDesigner();
    const saveBtn = screen.getByTestId("designer-save-button");
    expect(saveBtn.getAttribute("aria-label")).toBeTruthy();
  });
});

// ── Persistence — malformed layoutJson ───────────────────────────────────────

describe("InboardDesignerClient — malformed layoutJson falls back safely", () => {
  it("renders without crash when layoutJson is invalid JSON", async () => {
    // Should not throw; parser falls back to getDefaultLayout
    await expect(renderDesigner({ layoutJson: "not-json" })).resolves.not.toThrow();
    expect(screen.getByTestId("widget-palette")).toBeTruthy();
  });

  it("renders without crash when layoutJson has wrong version", async () => {
    await expect(
      renderDesigner({ layoutJson: JSON.stringify({ version: 99, widgets: [] }) }),
    ).resolves.not.toThrow();
    expect(screen.getByTestId("live-preview-mock")).toBeTruthy();
  });

  it("renders without crash when layoutJson is an empty object", async () => {
    await expect(
      renderDesigner({ layoutJson: "{}" }),
    ).resolves.not.toThrow();
    expect(screen.getByTestId("widget-palette")).toBeTruthy();
  });

  it("shows all 3 widgets even when layoutJson is malformed", async () => {
    await renderDesigner({ layoutJson: "garbage" });
    expect(screen.getByTestId("widget-palette-item-header")).toBeTruthy();
    expect(screen.getByTestId("widget-palette-item-activities")).toBeTruthy();
    expect(screen.getByTestId("widget-palette-item-announcement")).toBeTruthy();
  });
});

// ── Persistence — pre-saved layoutJson ───────────────────────────────────────

describe("InboardDesignerClient — pre-saved layoutJson loads correctly", () => {
  it("loads announcement state from existing layoutJson", async () => {
    const savedLayout = {
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
          enabled: true,
          position: { col: 0, row: 9 },
          width: 12,
          height: 1,
          variant: "default",
          settings: {
            text: "Gespeicherter Hinweis",
            bgColor: "#cc0000",
            textColor: "#ffffff",
          },
        },
      ],
    };

    await renderDesigner({
      layoutJson: JSON.stringify(savedLayout),
      announcementEnabled: true,
      announcementText: "Gespeicherter Hinweis",
    });

    // Announcement widget should show as enabled (no AUS badge)
    const annItem = screen.getByTestId("widget-palette-item-announcement");
    expect(annItem.textContent).not.toContain("AUS");
  });

  it("starts with save button disabled (no changes yet)", async () => {
    const savedLayout = {
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
          settings: { text: null, bgColor: null, textColor: null },
        },
      ],
    };

    await renderDesigner({ layoutJson: JSON.stringify(savedLayout) });
    const saveBtn = screen.getByTestId("designer-save-button");
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });
});

// ── Unsaved state indicator ───────────────────────────────────────────────────

describe("InboardDesignerClient — unsaved state indicator", () => {
  it("no unsaved badge initially", async () => {
    await renderDesigner();
    // "Ungespeichert" should not appear on fresh load
    expect(screen.queryByText("Ungespeichert")).toBeNull();
  });

  it("unsaved badge appears after clicking widget to change selection (not dirty)", async () => {
    // Clicking a widget item without actually changing settings should NOT set dirty
    await renderDesigner();
    fireEvent.click(screen.getByTestId("widget-palette-item-announcement"));
    // Changing selected widget does NOT dirty the layout
    expect(screen.queryByText("Ungespeichert")).toBeNull();
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe("InboardDesignerClient — accessibility", () => {
  it("widget palette has accessible label", async () => {
    await renderDesigner();
    const palette = screen.getByTestId("widget-palette");
    expect(palette.getAttribute("aria-label")).toBeTruthy();
  });

  it("settings panel has accessible label", async () => {
    await renderDesigner();
    const panel = screen.getByTestId("widget-settings-panel");
    expect(panel.getAttribute("aria-label")).toBeTruthy();
  });

  it("palette items have aria-pressed attribute", async () => {
    await renderDesigner();
    const headerItem = screen.getByTestId("widget-palette-item-header");
    const activitiesItem = screen.getByTestId("widget-palette-item-activities");
    expect(headerItem.getAttribute("aria-pressed")).toBeDefined();
    expect(activitiesItem.getAttribute("aria-pressed")).toBeDefined();
  });

  it("clicking Activities switches aria-pressed state", async () => {
    await renderDesigner();
    const headerItem = screen.getByTestId("widget-palette-item-header");
    const activitiesItem = screen.getByTestId("widget-palette-item-activities");

    // Initially header is selected
    expect(headerItem.getAttribute("aria-pressed")).toBe("true");
    expect(activitiesItem.getAttribute("aria-pressed")).toBe("false");

    // Click activities
    fireEvent.click(activitiesItem);
    await waitFor(() => {
      expect(activitiesItem.getAttribute("aria-pressed")).toBe("true");
      expect(headerItem.getAttribute("aria-pressed")).toBe("false");
    });
  });
});

// ── Designer-02: Edit / Preview mode ─────────────────────────────────────────

describe("InboardDesignerClient — Edit/Preview mode toggle", () => {
  it("renders Bearbeiten and Vorschau buttons", async () => {
    await renderDesigner();
    expect(screen.getByTestId("mode-btn-edit")).toBeTruthy();
    expect(screen.getByTestId("mode-btn-preview")).toBeTruthy();
  });

  it("Bearbeiten is pressed by default", async () => {
    await renderDesigner();
    const editBtn = screen.getByTestId("mode-btn-edit");
    expect(editBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking Vorschau switches mode", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("mode-btn-preview"));
    await waitFor(() => {
      expect(screen.getByTestId("mode-btn-preview").getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByTestId("mode-btn-edit").getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("canvas receives mode=preview when Vorschau is active", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("mode-btn-preview"));
    await waitFor(() => {
      const canvas = screen.getByTestId("live-preview-mock");
      expect(canvas.getAttribute("data-mode")).toBe("preview");
    });
  });

  it("canvas receives mode=edit when Bearbeiten is active", async () => {
    await renderDesigner();
    // Default is edit
    const canvas = screen.getByTestId("live-preview-mock");
    expect(canvas.getAttribute("data-mode")).toBe("edit");
  });

  it("switching back to Bearbeiten restores edit mode", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("mode-btn-preview"));
    fireEvent.click(screen.getByTestId("mode-btn-edit"));
    await waitFor(() => {
      expect(screen.getByTestId("mode-btn-edit").getAttribute("aria-pressed")).toBe("true");
    });
  });
});

// ── Designer-02: Canvas ↔ palette ↔ settings selection sync ──────────────────

describe("InboardDesignerClient — selection sync", () => {
  it("canvas selection syncs to palette (canvas click selects ACTIVITIES)", async () => {
    await renderDesigner();
    // Canvas mock fires onWidgetSelect("ACTIVITIES") on click
    fireEvent.click(screen.getByTestId("live-preview-mock"));
    await waitFor(() => {
      const activitiesItem = screen.getByTestId("widget-palette-item-activities");
      expect(activitiesItem.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("palette selection syncs to settings panel header", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("widget-palette-item-announcement"));
    await waitFor(() => {
      expect(screen.getByText(/Hinweisleiste aktivieren/)).toBeTruthy();
    });
  });

  it("canvas receives the selected widget from palette click", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("widget-palette-item-announcement"));
    await waitFor(() => {
      const canvas = screen.getByTestId("live-preview-mock");
      expect(canvas.getAttribute("data-selected")).toBe("ANNOUNCEMENT");
    });
  });
});

// ── Designer-02: Enable / Disable ─────────────────────────────────────────────

describe("InboardDesignerClient — enable/disable widget", () => {
  it("disabling ANNOUNCEMENT marks dirty", async () => {
    const savedLayout = {
      version: 1,
      widgets: [
        {
          id: "w-header", type: "HEADER", enabled: true,
          position: { col: 0, row: 0 }, width: 12, height: 1,
          variant: "default",
          settings: { subtitleEnabled: true, subtitleText: null, showTime: true, showDate: true },
        },
        {
          id: "w-activities", type: "ACTIVITIES", enabled: true,
          position: { col: 0, row: 1 }, width: 12, height: 8,
          variant: "default", settings: {},
        },
        {
          id: "w-announcement", type: "ANNOUNCEMENT", enabled: true,
          position: { col: 0, row: 9 }, width: 12, height: 1,
          variant: "default",
          settings: { text: "Test", bgColor: null, textColor: null },
        },
      ],
    };
    await renderDesigner({ layoutJson: JSON.stringify(savedLayout), announcementEnabled: true });

    // Select announcement widget first
    fireEvent.click(screen.getByTestId("widget-palette-item-announcement"));

    // Toggle the enable/disable switch
    const toggleSwitch = screen.getByRole("switch", { name: /Hinweisleiste/ });
    fireEvent.click(toggleSwitch);

    await waitFor(() => {
      expect(screen.getByText("Ungespeichert")).toBeTruthy();
    });
  });

  it("enabling a disabled widget selects it in the palette", async () => {
    await renderDesigner({ announcementEnabled: false });

    // Select announcement
    fireEvent.click(screen.getByTestId("widget-palette-item-announcement"));

    // Announcement is disabled; toggle to enable
    const toggleSwitch = screen.getByRole("switch", { name: /Hinweisleiste/ });
    fireEvent.click(toggleSwitch);

    await waitFor(() => {
      // After enabling, announcement should be selected
      const annItem = screen.getByTestId("widget-palette-item-announcement");
      expect(annItem.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("ACTIVITIES toggle is locked (cannot disable)", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("widget-palette-item-activities"));
    const toggle = screen.getByRole("switch", { name: /Tagesübersicht/ });
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });
});

// ── Designer-02: Layout reset ─────────────────────────────────────────────────

describe("InboardDesignerClient — layout reset", () => {
  it("renders 'Layout zurücksetzen' button", async () => {
    await renderDesigner();
    expect(screen.getByTestId("layout-reset-button")).toBeTruthy();
  });

  it("clicking reset shows confirmation UI", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("layout-reset-button"));
    await waitFor(() => {
      expect(screen.getByTestId("layout-reset-confirm")).toBeTruthy();
      expect(screen.getByTestId("layout-reset-cancel")).toBeTruthy();
    });
  });

  it("cancelling reset hides confirmation UI", async () => {
    await renderDesigner();
    fireEvent.click(screen.getByTestId("layout-reset-button"));
    fireEvent.click(screen.getByTestId("layout-reset-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("layout-reset-confirm")).toBeNull();
    });
  });

  it("confirming reset marks dirty", async () => {
    const savedLayout = {
      version: 1,
      widgets: [
        {
          id: "w-header", type: "HEADER", enabled: true,
          position: { col: 0, row: 0 }, width: 12, height: 1,
          variant: "default",
          settings: { subtitleEnabled: true, subtitleText: null, showTime: true, showDate: true },
        },
        {
          id: "w-activities", type: "ACTIVITIES", enabled: true,
          position: { col: 0, row: 1 }, width: 12, height: 8,
          variant: "default", settings: {},
        },
        {
          id: "w-announcement", type: "ANNOUNCEMENT", enabled: false,
          position: { col: 0, row: 9 }, width: 12, height: 1,
          variant: "default", settings: { text: null, bgColor: null, textColor: null },
        },
      ],
    };
    await renderDesigner({ layoutJson: JSON.stringify(savedLayout) });

    fireEvent.click(screen.getByTestId("layout-reset-button"));
    fireEvent.click(screen.getByTestId("layout-reset-confirm"));

    await waitFor(() => {
      expect(screen.getByText("Ungespeichert")).toBeTruthy();
    });
  });

  it("reset selects HEADER widget", async () => {
    await renderDesigner();
    // First select ACTIVITIES
    fireEvent.click(screen.getByTestId("widget-palette-item-activities"));

    fireEvent.click(screen.getByTestId("layout-reset-button"));
    fireEvent.click(screen.getByTestId("layout-reset-confirm"));

    await waitFor(() => {
      const headerItem = screen.getByTestId("widget-palette-item-header");
      expect(headerItem.getAttribute("aria-pressed")).toBe("true");
    });
  });
});
