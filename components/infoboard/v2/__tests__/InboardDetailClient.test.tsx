/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/v2/__tests__/InboardDetailClient.test.tsx
 *
 * Tests for the premium Infoboard detail shell.
 * Verifies:
 *   - All 5 tabs render
 *   - Tab navigation works
 *   - Status badge shown
 *   - Board name shown
 *   - Kiosk URL shown
 *   - Designer tab renders
 *   - Gerät tab renders kiosk guidance
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

// Mock the Designer (heavy component with live preview)
vi.mock("../designer/InboardDesignerClient", () => ({
  InboardDesignerClient: () => (
    <div data-testid="designer-client-mock">Designer Loaded</div>
  ),
}));

// Mock the live preview (uses ResizeObserver + complex rendering)
vi.mock("../InboardLivePreview", () => ({
  InboardLivePreview: () => (
    <div data-testid="live-preview-mock">Live Preview</div>
  ),
}));

// Mock the mini preview
vi.mock("../InboardMiniPreview", () => ({
  InboardMiniPreview: () => <div data-testid="mini-preview-mock" />,
}));

// Mock AnnouncementTicker (client component)
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
  name: "Tagesübersicht Eingang",
  slug: "eingang",
  status: "ACTIVE" as const,
  templateType: "TAGESUEBERSICHT",
  displayTheme: "DARK",
  headerSubtitleEnabled: true,
  headerSubtitleText: "Heute auf der Sportanlage",
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

// ── Component under test ──────────────────────────────────────────────────────

async function renderDetailClient() {
  const { InboardDetailClient } = await import("../InboardDetailClient");
  render(<InboardDetailClient board={BOARD} tenantName="FC Allschwil" />);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InboardDetailClient — shell", () => {
  it("shows the board name", async () => {
    await renderDetailClient();
    expect(screen.getByText("Tagesübersicht Eingang")).toBeTruthy();
  });

  it("shows the status badge", async () => {
    await renderDetailClient();
    expect(screen.getByTestId("board-status-badge")).toBeTruthy();
    expect(screen.getAllByText("Aktiv").length).toBeGreaterThan(0);
  });

  it("shows back link to /dashboard/infoboard", async () => {
    await renderDetailClient();
    const backLink = screen.getByText("Infoboards");
    expect(backLink.closest("a")?.getAttribute("href")).toBe(
      "/dashboard/infoboard",
    );
  });

  it("shows Display öffnen button", async () => {
    await renderDetailClient();
    expect(screen.getAllByText(/Display öffnen/i).length).toBeGreaterThan(0);
  });
});

describe("InboardDetailClient — tab navigation", () => {
  it("renders all 5 tabs", async () => {
    await renderDetailClient();
    const nav = screen.getByTestId("detail-tab-nav");
    expect(nav.textContent).toContain("Übersicht");
    expect(nav.textContent).toContain("Designer");
    expect(nav.textContent).toContain("Inhalte");
    expect(nav.textContent).toContain("Anzeige");
    expect(nav.textContent).toContain("Gerät");
  });

  it("shows Übersicht tab content by default", async () => {
    await renderDetailClient();
    expect(screen.getByTestId("tab-content-uebersicht")).toBeTruthy();
  });

  it("switches to Designer tab on click", async () => {
    await renderDetailClient();
    const designerTab = screen.getByTestId("tab-designer");
    fireEvent.click(designerTab);
    expect(screen.getByTestId("tab-content-designer")).toBeTruthy();
    expect(screen.getByTestId("designer-client-mock")).toBeTruthy();
  });

  it("switches to Inhalte tab on click", async () => {
    await renderDetailClient();
    fireEvent.click(screen.getByTestId("tab-inhalte"));
    expect(screen.getByTestId("tab-content-inhalte")).toBeTruthy();
  });

  it("switches to Anzeige tab on click", async () => {
    await renderDetailClient();
    fireEvent.click(screen.getByTestId("tab-anzeige"));
    expect(screen.getByTestId("tab-content-anzeige")).toBeTruthy();
  });

  it("switches to Gerät tab on click", async () => {
    await renderDetailClient();
    fireEvent.click(screen.getByTestId("tab-geraet"));
    expect(screen.getByTestId("tab-content-geraet")).toBeTruthy();
  });

  it("shows only one tab content at a time", async () => {
    await renderDetailClient();
    fireEvent.click(screen.getByTestId("tab-designer"));
    expect(screen.queryByTestId("tab-content-uebersicht")).toBeNull();
    expect(screen.getByTestId("tab-content-designer")).toBeTruthy();
  });
});

describe("InboardDetailClient — Gerät tab", () => {
  it("shows Kiosk-Modus guidance text", async () => {
    await renderDetailClient();
    fireEvent.click(screen.getByTestId("tab-geraet"));
    expect(screen.getByText(/Kiosk-Modus einrichten/)).toBeTruthy();
  });

  it("shows the kiosk URL", async () => {
    await renderDetailClient();
    fireEvent.click(screen.getByTestId("tab-geraet"));
    // The kiosk URL slug should appear in the content
    expect(screen.getAllByText(/infoboard\/eingang/).length).toBeGreaterThan(0);
  });
});

describe("InboardDetailClient — Übersicht tab", () => {
  it("shows board slug text", async () => {
    await renderDetailClient();
    // Slug appears as code text in the overview
    const slugCodes = screen.getAllByText("eingang");
    expect(slugCodes.length).toBeGreaterThan(0);
  });

  it("shows theme", async () => {
    await renderDetailClient();
    expect(screen.getAllByText("Dunkel").length).toBeGreaterThan(0);
  });
});
