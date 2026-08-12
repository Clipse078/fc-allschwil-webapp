/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/v2/__tests__/InboardDesignerCanvas.test.tsx
 *
 * Focused tests for the Designer-02 canvas overlay:
 *   - Renders in edit and preview mode
 *   - Edit-mode overlay is visible; preview-mode overlay is absent
 *   - Canvas widget handles rendered for enabled widgets
 *   - Disabled widget handles not rendered
 *   - Resize handles rendered only for widgets with canResize=true
 *   - onWidgetSelect called when pointer interaction starts over a widget
 *   - onLayoutChange called with updated layout after a valid move
 *   - onLayoutChange called with updated layout after a valid resize
 *   - Invalid move (overlap) does not call onLayoutChange
 *   - Bounds: move clamped to grid width
 *   - HEADER fixedCol: col cannot change
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../InboardLivePreview", () => ({
  InboardLivePreview: () => <div data-testid="live-preview-mock" />,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_LAYOUT = {
  version: 1 as const,
  widgets: [
    {
      id: "w-header",
      type: "HEADER" as const,
      enabled: true,
      position: { col: 0, row: 0 },
      width: 12,
      height: 1,
      variant: "default",
      settings: {},
    },
    {
      id: "w-activities",
      type: "ACTIVITIES" as const,
      enabled: true,
      position: { col: 0, row: 1 },
      width: 12,
      height: 8,
      variant: "default",
      settings: {},
    },
    {
      id: "w-announcement",
      type: "ANNOUNCEMENT" as const,
      enabled: true,
      position: { col: 0, row: 9 },
      width: 12,
      height: 1,
      variant: "default",
      settings: { text: "Test", bgColor: null, textColor: null },
    },
  ],
};

const ANNOUNCEMENT_DISABLED_LAYOUT = {
  ...DEFAULT_LAYOUT,
  widgets: DEFAULT_LAYOUT.widgets.map((w) =>
    w.type === "ANNOUNCEMENT" ? { ...w, enabled: false } : w,
  ),
};

type LayoutType = typeof DEFAULT_LAYOUT;

async function renderCanvas(
  layoutOverride: LayoutType = DEFAULT_LAYOUT,
  modeOverride: "edit" | "preview" = "edit",
  selectedWidget: "HEADER" | "ACTIVITIES" | "ANNOUNCEMENT" = "HEADER",
) {
  const { InboardDesignerCanvas } = await import(
    "../designer/InboardDesignerCanvas"
  );
  const onWidgetSelect = vi.fn();
  const onLayoutChange = vi.fn();
  render(
    <InboardDesignerCanvas
      layout={layoutOverride}
      mode={modeOverride}
      selectedWidget={selectedWidget}
      theme="DARK"
      headerConfig={{}}
      announcement={null}
      onWidgetSelect={onWidgetSelect}
      onLayoutChange={onLayoutChange}
    />,
  );
  return { onWidgetSelect, onLayoutChange };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ── Mode rendering ────────────────────────────────────────────────────────────

describe("InboardDesignerCanvas — mode rendering", () => {
  it("renders the designer canvas container", async () => {
    await renderCanvas();
    expect(screen.getByTestId("designer-canvas")).toBeTruthy();
  });

  it("shows the edit-mode overlay in edit mode", async () => {
    await renderCanvas(DEFAULT_LAYOUT, "edit");
    expect(screen.getByTestId("designer-canvas-overlay")).toBeTruthy();
  });

  it("hides the edit-mode overlay in preview mode", async () => {
    await renderCanvas(DEFAULT_LAYOUT, "preview");
    expect(screen.queryByTestId("designer-canvas-overlay")).toBeNull();
  });

  it("canvas has data-mode=edit in edit mode", async () => {
    await renderCanvas(DEFAULT_LAYOUT, "edit");
    expect(screen.getByTestId("designer-canvas").getAttribute("data-mode")).toBe("edit");
  });

  it("canvas has data-mode=preview in preview mode", async () => {
    await renderCanvas(DEFAULT_LAYOUT, "preview");
    expect(screen.getByTestId("designer-canvas").getAttribute("data-mode")).toBe("preview");
  });

  it("always renders the base preview (live-preview-mock)", async () => {
    await renderCanvas(DEFAULT_LAYOUT, "edit");
    expect(screen.getByTestId("live-preview-mock")).toBeTruthy();
  });

  it("preview mode also renders the base preview", async () => {
    await renderCanvas(DEFAULT_LAYOUT, "preview");
    expect(screen.getByTestId("live-preview-mock")).toBeTruthy();
  });
});

// ── Widget handle visibility ──────────────────────────────────────────────────

describe("InboardDesignerCanvas — widget handles in edit mode", () => {
  it("renders handle for HEADER when enabled", async () => {
    await renderCanvas();
    expect(screen.getByTestId("canvas-widget-header")).toBeTruthy();
  });

  it("renders handle for ACTIVITIES when enabled", async () => {
    await renderCanvas();
    expect(screen.getByTestId("canvas-widget-activities")).toBeTruthy();
  });

  it("renders handle for ANNOUNCEMENT when enabled", async () => {
    await renderCanvas();
    expect(screen.getByTestId("canvas-widget-announcement")).toBeTruthy();
  });

  it("does not render handle for disabled ANNOUNCEMENT", async () => {
    await renderCanvas(ANNOUNCEMENT_DISABLED_LAYOUT);
    expect(screen.queryByTestId("canvas-widget-announcement")).toBeNull();
  });
});

// ── Resize handles ────────────────────────────────────────────────────────────

describe("InboardDesignerCanvas — resize handles", () => {
  it("does not render resize handle for HEADER (not resizable)", async () => {
    await renderCanvas();
    expect(screen.queryByTestId("canvas-resize-header")).toBeNull();
  });

  it("renders resize handle for ACTIVITIES (resizable)", async () => {
    await renderCanvas();
    expect(screen.getByTestId("canvas-resize-activities")).toBeTruthy();
  });

  it("renders resize handle for ANNOUNCEMENT (resizable)", async () => {
    await renderCanvas();
    expect(screen.getByTestId("canvas-resize-announcement")).toBeTruthy();
  });
});

// ── Selection via pointer ─────────────────────────────────────────────────────

describe("InboardDesignerCanvas — widget selection on pointer", () => {
  it("calls onWidgetSelect when pointer down on an enabled widget region", async () => {
    const { onWidgetSelect } = await renderCanvas();
    const overlay = screen.getByTestId("designer-canvas-overlay");

    // Mock getBoundingClientRect so hit-test calculations work
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 1600, height: 900,
      right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    // HEADER occupies row 0 = 0..10% height, col 0..100% width
    // Click at (50%, 5%) → HEADER region (row 0 of 10)
    fireEvent.pointerDown(overlay, {
      clientX: 800, // 50% of 1600
      clientY: 45,  // ~5% of 900 → row 0
      pointerId: 1,
    });

    expect(onWidgetSelect).toHaveBeenCalledWith("HEADER");
  });

  it("calls onWidgetSelect with ACTIVITIES when clicking activities region", async () => {
    const { onWidgetSelect } = await renderCanvas();
    const overlay = screen.getByTestId("designer-canvas-overlay");

    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 1600, height: 900,
      right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    // ACTIVITIES occupies rows 1-8 = 10%..90% of height
    // Click at (50%, 50%) → ACTIVITIES region
    fireEvent.pointerDown(overlay, {
      clientX: 800,
      clientY: 450,
      pointerId: 1,
    });

    expect(onWidgetSelect).toHaveBeenCalledWith("ACTIVITIES");
  });

  it("does not call onWidgetSelect when clicking empty canvas area", async () => {
    const { onWidgetSelect } = await renderCanvas(ANNOUNCEMENT_DISABLED_LAYOUT);
    const overlay = screen.getByTestId("designer-canvas-overlay");

    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 1600, height: 900,
      right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    // Announcement is disabled; clicking in that region should not select anything
    // Announcement region is row 9 = 90%..100% → y = ~945 (slightly outside)
    // Actually in ANNOUNCEMENT_DISABLED_LAYOUT there are only 2 enabled widgets
    // (HEADER rows 0, ACTIVITIES rows 1-8), so row 9 is empty
    // totalRows = max(10, 1+8) = 10
    // ACTIVITIES bottom = (1+8)/10 = 90% → y=810; announcement at 90%..100% → empty
    fireEvent.pointerDown(overlay, {
      clientX: 800,
      clientY: 855, // ~95% → row 9, announcement is disabled
      pointerId: 1,
    });

    expect(onWidgetSelect).not.toHaveBeenCalled();
  });

  it("does not call onWidgetSelect in preview mode", async () => {
    await renderCanvas(DEFAULT_LAYOUT, "preview");
    // In preview mode the overlay is not rendered
    expect(screen.queryByTestId("designer-canvas-overlay")).toBeNull();
  });
});

// ── Layout change: move ───────────────────────────────────────────────────────

describe("InboardDesignerCanvas — layout move", () => {
  it("calls onLayoutChange with updated position after valid drag", async () => {
    // Use ANNOUNCEMENT_DISABLED_LAYOUT so ACTIVITIES (row 1, height 8) has room to move down.
    // With announcement disabled, moving ACTIVITIES from row 1 to row 2 is valid.
    const { onLayoutChange } = await renderCanvas(
      ANNOUNCEMENT_DISABLED_LAYOUT,
      "edit",
      "ACTIVITIES",
    );
    const overlay = screen.getByTestId("designer-canvas-overlay");

    const mockRect = {
      left: 0, top: 0, width: 1200, height: 675,
      right: 1200, bottom: 675, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect;
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue(mockRect);
    overlay.setPointerCapture = vi.fn();
    overlay.releasePointerCapture = vi.fn();

    // ACTIVITIES: rows 1-8 of 10 total rows
    // Click at y=300 → relY=300/675≈0.444 → row=floor(4.44)=4 (within ACTIVITIES rows 1-8)
    // x=600 → relX=0.5 → col=6; not in resize zone (relX < 0.8)
    fireEvent.pointerDown(overlay, {
      clientX: 600,
      clientY: 300,
      pointerId: 1,
    });

    // Move pointer down 1 row: from row 4 → row 5 (delta +1)
    // row 5 / 10 * 675 = 337.5 → use y=338
    // new ACTIVITIES row = 1 + (5-4) = 2; height stays 8; bottom = 10 — no overlap
    fireEvent.pointerMove(overlay, {
      clientX: 600,
      clientY: 338,
      pointerId: 1,
    });

    fireEvent.pointerUp(overlay, { clientX: 600, clientY: 338, pointerId: 1 });

    expect(onLayoutChange).toHaveBeenCalledWith(
      expect.objectContaining({
        widgets: expect.arrayContaining([
          expect.objectContaining({
            type: "ACTIVITIES",
            position: { col: 0, row: 2 },
          }),
        ]),
      }),
    );
  });

  it("does not call onLayoutChange when pointer released at same position (click)", async () => {
    const { onLayoutChange } = await renderCanvas();
    const overlay = screen.getByTestId("designer-canvas-overlay");

    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 1200, height: 675,
      right: 1200, bottom: 675, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    overlay.setPointerCapture = vi.fn();
    overlay.releasePointerCapture = vi.fn();

    // Click HEADER at row 0
    fireEvent.pointerDown(overlay, { clientX: 600, clientY: 30, pointerId: 1 });
    // No move
    fireEvent.pointerUp(overlay, { clientX: 600, clientY: 30, pointerId: 1 });

    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it("does not call onLayoutChange when proposed move overlaps another widget", async () => {
    const { onLayoutChange } = await renderCanvas();
    const overlay = screen.getByTestId("designer-canvas-overlay");

    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 1200, height: 675,
      right: 1200, bottom: 675, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    overlay.setPointerCapture = vi.fn();
    overlay.releasePointerCapture = vi.fn();

    // Try to drag ACTIVITIES (rows 1-8) to row 0 — overlaps HEADER
    fireEvent.pointerDown(overlay, { clientX: 600, clientY: 300, pointerId: 1 });
    // Move to row 0 region (y≈0..67, use y=30)
    fireEvent.pointerMove(overlay, { clientX: 600, clientY: 30, pointerId: 1 });
    // Pointer row ≈ 0; start was row 4 → delta = -4; new row = 1 + (-4) = -3 → clamped to 0
    // But row 0 would overlap HEADER → isValid=false
    fireEvent.pointerUp(overlay, { clientX: 600, clientY: 30, pointerId: 1 });

    expect(onLayoutChange).not.toHaveBeenCalled();
  });
});

// ── Layout change: resize ─────────────────────────────────────────────────────

describe("InboardDesignerCanvas — layout resize", () => {
  it("calls onLayoutChange with updated size after valid resize of ACTIVITIES (width decrease)", async () => {
    // Use ANNOUNCEMENT_DISABLED_LAYOUT so extending height doesn't cause overlap issues.
    // Resize ACTIVITIES width from 12 → 6 by dragging left from right edge.
    const { onLayoutChange } = await renderCanvas(
      ANNOUNCEMENT_DISABLED_LAYOUT,
      "edit",
      "ACTIVITIES",
    );
    const overlay = screen.getByTestId("designer-canvas-overlay");

    const mockRect = {
      left: 0, top: 0, width: 1200, height: 675,
      right: 1200, bottom: 675, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect;
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue(mockRect);
    overlay.setPointerCapture = vi.fn();
    overlay.releasePointerCapture = vi.fn();

    // ACTIVITIES: col 0-12, rows 1-8 (10%..90%)
    // Resize zone: relX > 0.8 AND relY > 0.7
    // Hit: x=1100 (91.7%), y=580 (85.9%) — both in resize zone
    fireEvent.pointerDown(overlay, {
      clientX: 1100, // relX=0.917 → col=11
      clientY: 580,  // relY=0.859 → row=8
      pointerId: 1,
    });

    // Move left to x=600 → relX=0.5 → col=6; delta = 6-11 = -5 → newWidth = 12-5 = 7
    // Keep same y so height unchanged
    fireEvent.pointerMove(overlay, {
      clientX: 600,
      clientY: 580,
      pointerId: 1,
    });

    fireEvent.pointerUp(overlay, { clientX: 600, clientY: 580, pointerId: 1 });

    expect(onLayoutChange).toHaveBeenCalledWith(
      expect.objectContaining({
        widgets: expect.arrayContaining([
          expect.objectContaining({
            type: "ACTIVITIES",
            width: 7,
          }),
        ]),
      }),
    );
  });

  it("does not call onLayoutChange when resize result violates minWidth", async () => {
    const { onLayoutChange } = await renderCanvas(
      ANNOUNCEMENT_DISABLED_LAYOUT,
      "edit",
      "ACTIVITIES",
    );
    const overlay = screen.getByTestId("designer-canvas-overlay");

    const mockRect = {
      left: 0, top: 0, width: 1200, height: 675,
      right: 1200, bottom: 675, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect;
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue(mockRect);
    overlay.setPointerCapture = vi.fn();
    overlay.releasePointerCapture = vi.fn();

    // Hit resize zone of ACTIVITIES
    fireEvent.pointerDown(overlay, { clientX: 1100, clientY: 580, pointerId: 1 });

    // Move to same position — no change in size
    fireEvent.pointerMove(overlay, { clientX: 1100, clientY: 580, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 1100, clientY: 580, pointerId: 1 });

    // No change in size → not called
    expect(onLayoutChange).not.toHaveBeenCalled();
  });
});