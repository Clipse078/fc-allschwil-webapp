"use client";

/**
 * components/admin/homepage-builder/FocalPointControl.tsx
 *
 * Admin-only background image focal-point drag control (Slice K).
 *
 * Renders an absolutely-positioned overlay over a block that has a background
 * image. The user can click or drag to reposition the focal point, which
 * updates `backgroundPosition` for the canvas preview immediately.
 *
 * PERSISTENCE NOTE (Slice K gap)
 *   The focal point is stored as preview-only local state — it is NOT saved
 *   to the database because `SectionBackground` (lib/cms/layout-types.ts) has
 *   no `focalPoint` / `backgroundPosition` field. Adding persistence requires
 *   a schema migration (Slice K+1). Until then, the focal point resets on page
 *   reload. See REQUIRED REPORT, item 5 and 12.
 *
 * KEYBOARD FALLBACK
 *   Arrow keys nudge the focal point by 5% when the control is focused.
 *   Shift+Arrow nudges by 1% for fine-grained control.
 *
 * INTERFACE
 *   - `position` — current CSS background-position string (e.g. "50% 50%")
 *   - `onPositionChange` — called with new CSS background-position string
 *   - `onReset` — reset to center ("50% 50%")
 */

import { useRef, useCallback } from "react";
import { Crosshair, RotateCcw } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Parse "X% Y%" → [x, y] as 0–100 numbers. */
function parsePosition(pos: string): [number, number] {
  const parts = pos.split(" ");
  const x = parseFloat(parts[0] ?? "50");
  const y = parseFloat(parts[1] ?? "50");
  return [isNaN(x) ? 50 : clamp(x, 0, 100), isNaN(y) ? 50 : clamp(y, 0, 100)];
}

/** Format [x, y] → "X% Y%". */
function formatPosition(x: number, y: number): string {
  return `${Math.round(x)}% ${Math.round(y)}%`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type FocalPointControlProps = {
  position: string; // CSS background-position, e.g. "50% 50%"
  onPositionChange: (pos: string) => void;
  onReset: () => void;
};

// ---------------------------------------------------------------------------
// FocalPointControl
// ---------------------------------------------------------------------------

export function FocalPointControl({
  position,
  onPositionChange,
  onReset,
}: FocalPointControlProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const [px, py] = parsePosition(position);

  // ── Drag logic ─────────────────────────────────────────────────────────

  const computePosition = useCallback(
    (clientX: number, clientY: number): string => {
      const el = overlayRef.current;
      if (!el) return position;
      const rect = el.getBoundingClientRect();
      const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
      return formatPosition(x, y);
    },
    [position],
  );

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only respond to left button / pen primary button
    if (e.button !== 0 && e.button !== undefined) return;
    // Don't start drag on Reset button clicks
    if ((e.target as HTMLElement).closest("[data-focal-reset]")) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    onPositionChange(computePosition(e.clientX, e.clientY));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    e.preventDefault();
    onPositionChange(computePosition(e.clientX, e.clientY));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  }

  // ── Keyboard fallback ──────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 1 : 5;
    let [x, y] = parsePosition(position);
    if (e.key === "ArrowLeft") { e.preventDefault(); x = clamp(x - step, 0, 100); }
    else if (e.key === "ArrowRight") { e.preventDefault(); x = clamp(x + step, 0, 100); }
    else if (e.key === "ArrowUp") { e.preventDefault(); y = clamp(y - step, 0, 100); }
    else if (e.key === "ArrowDown") { e.preventDefault(); y = clamp(y + step, 0, 100); }
    else return;
    onPositionChange(formatPosition(x, y));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-10 cursor-crosshair"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-label="Bildposition — Ziehen oder Pfeiltasten"
      aria-valuetext={`Horizontal ${Math.round(px)}%, Vertikal ${Math.round(py)}%`}
    >
      {/* Crosshair indicator */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center h-9 w-9 rounded-full border-2 border-white bg-black/30 shadow-md pointer-events-none"
        style={{ left: `${px}%`, top: `${py}%` }}
        aria-hidden="true"
      >
        <Crosshair className="h-4 w-4 text-white" />
      </div>

      {/* Subtle grid lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)",
          backgroundSize: "25% 25%",
        }}
        aria-hidden="true"
      />

      {/* Reset to center button */}
      <button
        type="button"
        data-focal-reset
        onClick={(e) => { e.stopPropagation(); onReset(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white hover:bg-black/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        title="Bildposition zurücksetzen (Mitte)"
        aria-label="Bildposition auf Mitte zurücksetzen"
      >
        <RotateCcw className="h-3 w-3" />
        Zurücksetzen
      </button>

      {/* Coordinate badge */}
      <div
        className="absolute top-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white font-mono pointer-events-none"
        aria-hidden="true"
      >
        {Math.round(px)}% · {Math.round(py)}%
      </div>

      {/* Preview-only badge */}
      <div
        className="absolute top-2 right-2 rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white font-medium pointer-events-none"
        aria-hidden="true"
      >
        Vorschau
      </div>
    </div>
  );
}
