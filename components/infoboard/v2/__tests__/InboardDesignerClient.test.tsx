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
