"use client";

/**
 * components/infoboard/v2/designer/InboardDesignerCanvas.tsx
 *
 * Canvas overlay for the Infoboard Designer.
 *
 * Renders the InfoboardScreen1 preview (via InboardLivePreview) and — in
 * "edit" mode only — overlays interactive widget handles that let the user:
 *
 *   • Click  → select a widget (syncs with palette + settings panel)
 *   • Drag   → move widget to a new grid position (snap-to-grid, bounds,
 *              no-overlap enforcement; invalid drop is rejected)
 *   • Resize → drag the bottom-right handle to resize width/height within
 *              per-widget constraints
 *
 * Scaling note:
 *   InboardLivePreview scales InfoboardScreen1 (1920 px wide) to fit its
 *   container using CSS transform.  The overlay is placed at the container
 *   level (aspect-ratio: 16/9, width: 100%), so all pointer coordinates are
 *   already in container-relative pixels — no inverse-scale math needed.
 *
 * In "preview" mode the overlay is invisible and pointer-events are disabled,
 *   rendering an exact kiosk replica with zero editor chrome.
 */

import { useRef, useState, useCallback } from "react";
import { GripVertical, Maximize2 } from "lucide-react";

import { InboardLivePreview } from "../InboardLivePreview";
import {
  GRID_COLUMNS,
  WIDGET_LABELS,
  WIDGET_CONSTRAINTS,
  getLayoutTotalRows,
  hasOverlapWithOthers,
  findWidget,
  updateWidget,
  type WidgetType,
  type WidgetPosition,
  type WidgetInstance,
  type InboardLayout,
} from "@/lib/infoboard/widget-types";
import type { InfoboardDisplayTheme } from "@/lib/publishing/infoboard/display-theme";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DesignerMode = "edit" | "preview";

type DragInteraction = {
  kind: "drag";
  widgetType: WidgetType;
  widgetId: string;
  originalPosition: WidgetPosition;
  originalWidth: number;
  originalHeight: number;
  startPointerCol: number;
  startPointerRow: number;
  proposedPosition: WidgetPosition;
  isValid: boolean;
};

type ResizeInteraction = {
  kind: "resize";
  widgetType: WidgetType;
  widgetId: string;
  originalPosition: WidgetPosition;
  originalWidth: number;
  originalHeight: number;
  startPointerCol: number;
  startPointerRow: number;
  proposedWidth: number;
  proposedHeight: number;
  isValid: boolean;
};

type InteractionState = DragInteraction | ResizeInteraction;

export type InboardDesignerCanvasProps = {
  layout: InboardLayout;
  mode: DesignerMode;
  selectedWidget: WidgetType;
  theme?: InfoboardDisplayTheme | null;
  headerConfig?: {
    subtitleEnabled?: boolean;
    subtitleText?: string | null;
    showTime?: boolean;
    showDate?: boolean;
  };
  announcement?: {
    enabled: boolean;
    text: string | null;
    bgColor: string | null;
    textColor: string | null;
  } | null;
  /** Called when user clicks/selects a widget on the canvas */
  onWidgetSelect: (type: WidgetType) => void;
  /** Called when a valid move/resize is committed */
  onLayoutChange: (updated: InboardLayout) => void;
  className?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type Bounds = { left: number; top: number; width: number; height: number };

function getWidgetBounds(widget: WidgetInstance, totalRows: number): Bounds {
  return {
    left: (widget.position.col / GRID_COLUMNS) * 100,
    top: (widget.position.row / totalRows) * 100,
    width: (widget.width / GRID_COLUMNS) * 100,
    height: (widget.height / totalRows) * 100,
  };
}

function getGhostBounds(ix: InteractionState, totalRows: number): Bounds {
  if (ix.kind === "drag") {
    return {
      left: (ix.proposedPosition.col / GRID_COLUMNS) * 100,
      top: (ix.proposedPosition.row / totalRows) * 100,
      width: (ix.originalWidth / GRID_COLUMNS) * 100,
      height: (ix.originalHeight / totalRows) * 100,
    };
  }
  return {
    left: (ix.originalPosition.col / GRID_COLUMNS) * 100,
    top: (ix.originalPosition.row / totalRows) * 100,
    width: (ix.proposedWidth / GRID_COLUMNS) * 100,
    height: (ix.proposedHeight / totalRows) * 100,
  };
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InboardDesignerCanvas({
  layout,
  mode,
  selectedWidget,
  theme,
  headerConfig,
  announcement,
  onWidgetSelect,
  onLayoutChange,
  className = "",
}: InboardDesignerCanvasProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [hoverWidget, setHoverWidget] = useState<WidgetType | null>(null);
  const [hoverAction, setHoverAction] = useState<"drag" | "resize" | null>(null);

  const totalRows = getLayoutTotalRows(layout);
  const enabledWidgets = layout.widgets.filter((w) => w.enabled);

  // ── Hit-test (pure percentage coords 0..1) ────────────────────────────────

  const hitTest = useCallback(
    (
      relX: number,
      relY: number,
    ): { widget: WidgetInstance; action: "drag" | "resize" } | null => {
      for (const w of enabledWidgets) {
        const wLeft = w.position.col / GRID_COLUMNS;
        const wRight = (w.position.col + w.width) / GRID_COLUMNS;
        const wTop = w.position.row / totalRows;
        const wBottom = (w.position.row + w.height) / totalRows;

        if (relX >= wLeft && relX <= wRight && relY >= wTop && relY <= wBottom) {
          const c = WIDGET_CONSTRAINTS[w.type];
          if (c.canResize) {
            const resZoneX = wRight - (w.width / GRID_COLUMNS) * 0.2;
            const resZoneY = wBottom - (w.height / totalRows) * 0.25;
            if (relX >= resZoneX && relY >= resZoneY) {
              return { widget: w, action: "resize" };
            }
          }
          return { widget: w, action: "drag" };
        }
      }
      return null;
    },
    [enabledWidgets, totalRows],
  );

  // ── Pointer helpers ───────────────────────────────────────────────────────

  function getPointerRel(e: React.PointerEvent): { relX: number; relY: number } {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      relX: clamp(0, 1, (e.clientX - rect.left) / rect.width),
      relY: clamp(0, 1, (e.clientY - rect.top) / rect.height),
    };
  }

  function relToGrid(relX: number, relY: number): { col: number; row: number } {
    return {
      col: Math.floor(relX * GRID_COLUMNS),
      row: Math.floor(relY * totalRows),
    };
  }

  // ── Pointer events ────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (mode !== "edit") return;

      const { relX, relY } = getPointerRel(e);
      const hit = hitTest(relX, relY);

      if (!hit) return;

      onWidgetSelect(hit.widget.type);

      const grid = relToGrid(relX, relY);

      if (hit.action === "drag") {
        setInteraction({
          kind: "drag",
          widgetType: hit.widget.type,
          widgetId: hit.widget.id,
          originalPosition: { ...hit.widget.position },
          originalWidth: hit.widget.width,
          originalHeight: hit.widget.height,
          startPointerCol: grid.col,
          startPointerRow: grid.row,
          proposedPosition: { ...hit.widget.position },
          isValid: true,
        });
      } else {
        setInteraction({
          kind: "resize",
          widgetType: hit.widget.type,
          widgetId: hit.widget.id,
          originalPosition: { ...hit.widget.position },
          originalWidth: hit.widget.width,
          originalHeight: hit.widget.height,
          startPointerCol: grid.col,
          startPointerRow: grid.row,
          proposedWidth: hit.widget.width,
          proposedHeight: hit.widget.height,
          isValid: true,
        });
      }

      overlayRef.current?.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    },
    [mode, hitTest, onWidgetSelect],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (mode !== "edit") return;

      const { relX, relY } = getPointerRel(e);

      if (!interaction) {
        const hit = hitTest(relX, relY);
        setHoverWidget(hit?.widget.type ?? null);
        setHoverAction(hit?.action ?? null);
        return;
      }

      const grid = relToGrid(relX, relY);

      if (interaction.kind === "drag") {
        const widget = findWidget(layout, interaction.widgetType);
        if (!widget) return;
        const c = WIDGET_CONSTRAINTS[interaction.widgetType];

        const deltaCol = grid.col - interaction.startPointerCol;
        const deltaRow = grid.row - interaction.startPointerRow;

        let newCol = interaction.originalPosition.col + deltaCol;
        const newRow = Math.max(0, interaction.originalPosition.row + deltaRow);

        if (c.fixedCol) newCol = 0;
        else newCol = clamp(0, GRID_COLUMNS - widget.width, newCol);

        const proposedPosition: WidgetPosition = { col: newCol, row: newRow };
        const isValid = !hasOverlapWithOthers(
          widget,
          proposedPosition,
          widget.width,
          widget.height,
          layout.widgets,
        );

        setInteraction((prev) =>
          prev ? { ...prev, proposedPosition, isValid } : null,
        );
      } else if (interaction.kind === "resize") {
        const widget = findWidget(layout, interaction.widgetType);
        if (!widget) return;
        const c = WIDGET_CONSTRAINTS[interaction.widgetType];

        const deltaW = grid.col - interaction.startPointerCol;
        const deltaH = grid.row - interaction.startPointerRow;

        const rawW = interaction.originalWidth + deltaW;
        const rawH = interaction.originalHeight + deltaH;

        const newWidth = clamp(
          c.minWidth,
          Math.min(c.maxWidth, GRID_COLUMNS - widget.position.col),
          rawW,
        );
        const newHeight = clamp(c.minHeight, c.maxHeight, rawH);

        const isValid = !hasOverlapWithOthers(
          widget,
          widget.position,
          newWidth,
          newHeight,
          layout.widgets,
        );

        setInteraction((prev) =>
          prev
            ? { ...prev, proposedWidth: newWidth, proposedHeight: newHeight, isValid }
            : null,
        );
      }
    },
    [mode, interaction, layout, hitTest],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      overlayRef.current?.releasePointerCapture?.(e.pointerId);

      if (!interaction) return;

      if (interaction.kind === "drag" && interaction.isValid) {
        const moved =
          interaction.proposedPosition.col !== interaction.originalPosition.col ||
          interaction.proposedPosition.row !== interaction.originalPosition.row;
        if (moved) {
          onLayoutChange(
            updateWidget(layout, interaction.widgetType, {
              position: interaction.proposedPosition,
            }),
          );
        }
      } else if (interaction.kind === "resize" && interaction.isValid) {
        const changed =
          interaction.proposedWidth !== interaction.originalWidth ||
          interaction.proposedHeight !== interaction.originalHeight;
        if (changed) {
          onLayoutChange(
            updateWidget(layout, interaction.widgetType, {
              width: interaction.proposedWidth,
              height: interaction.proposedHeight,
            }),
          );
        }
      }

      setInteraction(null);
    },
    [interaction, layout, onLayoutChange],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      overlayRef.current?.releasePointerCapture?.(e.pointerId);
      setInteraction(null);
    },
    [],
  );

  // ── Cursor ────────────────────────────────────────────────────────────────

  let cursor = "default";
  if (mode === "edit") {
    if (interaction) {
      cursor = interaction.kind === "resize" ? "nwse-resize" : "grabbing";
    } else if (hoverAction === "resize") {
      cursor = "nwse-resize";
    } else if (hoverAction === "drag") {
      cursor = "grab";
    }
  }

  // ── Ghost (drag / resize preview) ────────────────────────────────────────

  const ghostBounds = interaction ? getGhostBounds(interaction, totalRows) : null;
  const isGhostMoved =
    interaction?.kind === "drag"
      ? interaction.proposedPosition.col !== interaction.originalPosition.col ||
        interaction.proposedPosition.row !== interaction.originalPosition.row
      : interaction?.kind === "resize"
        ? interaction.proposedWidth !== interaction.originalWidth ||
          interaction.proposedHeight !== interaction.originalHeight
        : false;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[var(--radius-lg)] ${className}`}
      style={{ aspectRatio: "16 / 9" }}
      data-testid="designer-canvas"
      data-mode={mode}
    >
      {/* Base preview layer */}
      <InboardLivePreview
        theme={theme}
        headerConfig={headerConfig}
        announcement={announcement}
        className="absolute inset-0 w-full h-full rounded-none"
      />

      {/* Edit-mode overlay */}
      {mode === "edit" && (
        <div
          ref={overlayRef}
          style={{
            position: "absolute",
            inset: 0,
            cursor,
            // touch-action none prevents scroll during canvas drag
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          aria-label="Infoboard Canvas — Bearbeiten-Modus"
          data-testid="designer-canvas-overlay"
        >
          {/* Widget handles */}
          {enabledWidgets.map((widget) => {
            const bounds = getWidgetBounds(widget, totalRows);
            const isSelected = selectedWidget === widget.type;
            const isBeingMoved =
              interaction !== null && interaction.widgetType === widget.type;
            const c = WIDGET_CONSTRAINTS[widget.type];

            return (
              <div
                key={widget.id}
                data-testid={`canvas-widget-${widget.type.toLowerCase()}`}
                style={{
                  position: "absolute",
                  left: `${bounds.left}%`,
                  top: `${bounds.top}%`,
                  width: `${bounds.width}%`,
                  height: `${bounds.height}%`,
                  pointerEvents: "none",
                  boxSizing: "border-box",
                  border: isSelected
                    ? "2px solid var(--sce-primary)"
                    : "1.5px dashed rgba(255,255,255,0.25)",
                  borderRadius: 4,
                  opacity: isBeingMoved ? 0.5 : 1,
                  transition: isBeingMoved
                    ? "none"
                    : "border-color 0.15s, opacity 0.15s",
                }}
              >
                {/* Selection label badge */}
                {isSelected && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "var(--sce-primary)",
                      color: "#fff",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 3,
                      lineHeight: 1.4,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    <GripVertical
                      style={{ width: 10, height: 10 }}
                      aria-hidden="true"
                    />
                    {WIDGET_LABELS[widget.type]}
                  </span>
                )}

                {/* Resize handle (bottom-right corner) */}
                {c.canResize && (
                  <div
                    data-testid={`canvas-resize-${widget.type.toLowerCase()}`}
                    style={{
                      position: "absolute",
                      bottom: 4,
                      right: 4,
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isSelected
                        ? "var(--sce-primary)"
                        : "rgba(255,255,255,0.18)",
                      borderRadius: 3,
                      pointerEvents: "none",
                      opacity: isSelected ? 1 : 0.6,
                    }}
                  >
                    <Maximize2
                      style={{ width: 10, height: 10, color: "#fff" }}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Drag / resize ghost */}
          {ghostBounds && isGhostMoved && (
            <div
              data-testid="canvas-ghost"
              style={{
                position: "absolute",
                left: `${ghostBounds.left}%`,
                top: `${ghostBounds.top}%`,
                width: `${ghostBounds.width}%`,
                height: `${ghostBounds.height}%`,
                pointerEvents: "none",
                border: `2px solid ${interaction?.isValid ? "var(--sce-primary)" : "#ef4444"}`,
                background: interaction?.isValid
                  ? "rgba(59,130,246,0.12)"
                  : "rgba(239,68,68,0.12)",
                borderRadius: 4,
                boxSizing: "border-box",
                transition: "none",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
