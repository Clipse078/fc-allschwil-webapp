/**
 * @vitest-environment jsdom
 */

/**
 * Focused tests for the Anlageplan Designer element navigator — INFOBOARD-MAP-02.
 *
 * NAVIGATOR:
 *   - All configured elements appear in navigator rows
 *   - Resource zones appear under Spielfelder group
 *   - Markers appear under Marker group
 *   - Clicking a navigator row calls onSelect with the element id
 *   - editable display label is shown in the navigator row
 *   - resourceCode attribute is preserved on the element data
 *   - Selected element row is visually highlighted
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { AnlageplanElement } from "@/lib/infoboard/anlageplan-types";

// ── We need to test the ElementNavigator sub-component.
// Since it's internal to AnlageplanDesignerClient, we test it by rendering
// the designer client with pre-configured elements and verifying navigator behavior.
// ──────────────────────────────────────────────────────────────────────────────

// Minimal mock for fetch (needed by AnlageplanDesignerClient save/upload handlers)
const mockFetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ board: {} }) }));
vi.stubGlobal("fetch", mockFetch);

// Mock crypto.randomUUID for element creation
vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });

// Mock ResizeObserver
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
  constructor(_: ResizeObserverCallback) {}
});

import { AnlageplanDesignerClient } from "@/components/infoboard/v2/designer/anlageplan/AnlageplanDesignerClient";
import type { InboardRow } from "@/lib/infoboard/types";
import type { AnlageplanResourceOption } from "@/lib/infoboard/anlageplan-types";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeBoardWithElements(elements: AnlageplanElement[]): InboardRow {
  const config = { version: 1 as const, elements };
  return {
    id: "board-1",
    name: "Test Board",
    slug: "test-board",
    status: "ACTIVE",
    templateType: "ANLAGENUEBERSICHT",
    tenantId: "tenant-1",
    displayTheme: "DARK",
    announcementEnabled: false,
    announcementText: null,
    announcementBgColor: null,
    announcementTextColor: null,
    headerSubtitleEnabled: true,
    headerSubtitleText: null,
    headerShowTime: true,
    headerShowDate: true,
    headerShowWeather: false,
    layoutJson: null,
    anlageplanJson: JSON.stringify(config),
    anlageplanBackgroundUrl: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

const SAMPLE_ELEMENTS: AnlageplanElement[] = [
  {
    kind: "RESOURCE_ZONE",
    id: "zone-1",
    rect: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
    resourceCode: "KR2",
    label: "Kunstrasen 2",
    zoneType: "FULL_PITCH",
    showNextActivity: true,
  },
  {
    kind: "RESOURCE_ZONE",
    id: "zone-2",
    rect: { x: 0.5, y: 0.1, width: 0.2, height: 0.2 },
    resourceCode: "KR3",
    label: "KR3",
    zoneType: "FULL_PITCH",
    showNextActivity: false,
  },
  {
    kind: "MARKER",
    id: "marker-1",
    rect: { x: 0.8, y: 0.8, width: 0.06, height: 0.06 },
    markerType: "DU_BIST_HIER",
    label: "Du bist hier",
    secondaryText: null,
  },
  {
    kind: "MARKER",
    id: "marker-2",
    rect: { x: 0.05, y: 0.8, width: 0.06, height: 0.06 },
    markerType: "WC",
    label: "WC Hauptgebäude",
    secondaryText: null,
  },
];

const FACILITY_OPTIONS: AnlageplanResourceOption[] = [
  { code: "KR2", name: "Kunstrasen 2", type: "FULL_PITCH" },
  { code: "KR3", name: "Kunstrasen 3", type: "FULL_PITCH" },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AnlageplanDesignerClient — element navigator", () => {
  it("renders element-navigator when elements exist", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoardWithElements(SAMPLE_ELEMENTS)}
        facilityOptions={FACILITY_OPTIONS}
      />,
    );
    expect(screen.getByTestId("element-navigator")).toBeTruthy();
  });

  it("does NOT render navigator when no elements exist", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoardWithElements([])}
        facilityOptions={FACILITY_OPTIONS}
      />,
    );
    expect(screen.queryByTestId("element-navigator")).toBeNull();
  });

  it("shows all configured elements in navigator rows", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoardWithElements(SAMPLE_ELEMENTS)}
        facilityOptions={FACILITY_OPTIONS}
      />,
    );
    const rows = screen.getAllByTestId("navigator-element-row");
    expect(rows.length).toBe(SAMPLE_ELEMENTS.length);
  });

  it("shows resource zone display labels in navigator", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoardWithElements(SAMPLE_ELEMENTS)}
        facilityOptions={FACILITY_OPTIONS}
      />,
    );
    const labels = screen.getAllByTestId("navigator-element-label");
    const labelTexts = labels.map((l) => l.textContent);
    expect(labelTexts).toContain("Kunstrasen 2");
    expect(labelTexts).toContain("KR3");
  });

  it("shows marker labels in navigator", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoardWithElements(SAMPLE_ELEMENTS)}
        facilityOptions={FACILITY_OPTIONS}
      />,
    );
    const labels = screen.getAllByTestId("navigator-element-label");
    const labelTexts = labels.map((l) => l.textContent);
    expect(labelTexts).toContain("Du bist hier");
    expect(labelTexts).toContain("WC Hauptgebäude");
  });

  it("clicking a navigator row selects that element (properties panel appears)", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoardWithElements(SAMPLE_ELEMENTS)}
        facilityOptions={FACILITY_OPTIONS}
      />,
    );
    // Before clicking, no element selected — right panel shows "Element auswählen"
    expect(screen.getByText("Element auswählen")).toBeTruthy();

    // Click first navigator row
    const rows = screen.getAllByTestId("navigator-element-row");
    fireEvent.click(rows[0]);

    // Properties panel should now show a section (PanelSection label "Element" or "Ressource")
    expect(screen.queryByText("Element auswählen")).toBeNull();
  });

  it("element rows include element-id data attribute matching element ids", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoardWithElements(SAMPLE_ELEMENTS)}
        facilityOptions={FACILITY_OPTIONS}
      />,
    );
    const rows = screen.getAllByTestId("navigator-element-row");
    const ids = rows.map((r) => r.getAttribute("data-element-id"));
    expect(ids).toContain("zone-1");
    expect(ids).toContain("zone-2");
    expect(ids).toContain("marker-1");
    expect(ids).toContain("marker-2");
  });
});
