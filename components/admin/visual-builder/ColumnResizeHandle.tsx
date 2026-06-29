"use client";

/**
 * components/admin/visual-builder/ColumnResizeHandle.tsx
 *
 * Draggable divider handle between two columns in the visual canvas.
 *
 * Snaps to supported SectionColumns presets:
 *   25/75 · 33/66 · 50/50 · 66/33 · 75/25
 *
 * Interaction modes:
 *   - Mouse drag: position-based snap within the container
 *   - Click:      cycles forward through presets
 *   - Keyboard:   Arrow Left / Arrow Right cycle through presets
 *                 with focus ring for accessibility
 *
 * The handle renders a subtle vertical line at the column boundary, with
 * a pill-shaped grip that is only visible on hover or focus — keeping the
 * preview clean when the editor is not in use.
 */

import { useRef, useCallback } from "react";
import { GripVertical } from "lucide-react";
import type { SectionColumns } from "@/lib/cms/layout-types";

// ---------------------------------------------------------------------------
// Preset ordering & geometry
// ---------------------------------------------------------------------------

const COLUMN_PRESETS: SectionColumns[] = [
  "25/75",
  "33/66",
  "50/50",
  "66/33",
  "75/25",
];

/** Left-column percentage for each preset. Used for snapping + positioning. */
const LEFT_PERCENT: Partial<Record<SectionColumns, number>> = {
  "25/75": 25,
  "33/66": 33.33,
  "50/50": 50,
  "66/33": 66.66,
  "75/25": 75,
};

function findClosestPreset(percent: number): SectionColumns {
  let best: SectionColumns = "50/50";
  let bestDiff = Infinity;
  for (const preset of COLUMN_PRESETS) {
    const diff = Math.abs((LEFT_PERCENT[preset] ?? 50) - percent);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = preset;
    }
  }
  return best;
}

function cyclePreset(current: SectionColumns, direction: 1 | -1): SectionColumns {
  const idx = COLUMN_PRESETS.indexOf(current);
  if (idx === -1) return "50/50";
  const next = idx + direction;
  return COLUMN_PRESETS[Math.max(0, Math.min(COLUMN_PRESETS.length - 1, next))];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** Current column preset. */
  columns: SectionColumns;
  /** Called whenever the value changes during drag or keyboard nav. */
  onChange: (columns: SectionColumns) => void;
  /** Ref to the container element used for position math during drag. */
  containerRef: React.RefObject<HTMLDivElement | null>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ColumnResizeHandle({
  columns,
  onChange,
  containerRef,
}: Props) {
  const isDragging = useRef(false);
  const lastCommitted = useRef<SectionColumns>(columns);

  const leftPercent = LEFT_PERCENT[columns] ?? 50;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      lastCommitted.current = columns;

      function onMove(ev: MouseEvent) {
        if (!isDragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const rawPercent = ((ev.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(20, Math.min(80, rawPercent));
        const snapped = findClosestPreset(clamped);
        if (snapped !== lastCommitted.current) {
          lastCommitted.current = snapped;
          onChange(snapped);
        }
      }

      function onUp() {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [columns, onChange, containerRef],
  );

  return (
    <div
      // Position the handle at the column boundary percentage
      className="absolute top-0 bottom-0 z-20 flex cursor-col-resize items-center justify-center"
      style={{
        left: `${leftPercent}%`,
        transform: "translateX(-50%)",
        width: "24px",
      }}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Spaltenbreite: ${columns} — zum Anpassen ziehen oder Pfeiltasten nutzen`}
      aria-valuenow={leftPercent}
      aria-valuemin={25}
      aria-valuemax={75}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(cyclePreset(columns, -1));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(cyclePreset(columns, 1));
        }
      }}
    >
      {/* Visual track line */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-px bg-blue-300 opacity-0 transition-opacity group-hover/canvas:opacity-100" />

      {/* Drag pill — visible on hover/focus */}
      <div
        className="
          flex h-12 w-5 flex-col items-center justify-center gap-0.5
          rounded-full border border-blue-200 bg-white shadow-md
          opacity-0 transition-opacity
          group-hover/canvas:opacity-100
          focus-within:opacity-100
        "
      >
        <GripVertical className="h-3 w-3 text-blue-400" />
        <span className="text-[8px] font-semibold text-blue-400 leading-none">
          {columns}
        </span>
      </div>
    </div>
  );
}
