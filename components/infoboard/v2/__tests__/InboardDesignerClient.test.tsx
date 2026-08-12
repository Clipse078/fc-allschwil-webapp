/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/v2/__tests__/InboardDesignerClient.test.tsx
 *
 * Tests for the 3-panel Infoboard Designer.
 * Verifies:
 *   - Widget palette renders all 3 widgets
 *   - Selected widget settings panel renders
 *   - Widget enable/disable toggle works
 *   - Live preview renders
 *   - Save button state
 */

import { render, screen, fireEvent } from "@testing-library/react";
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
});
