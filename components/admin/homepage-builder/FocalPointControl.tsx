"use client";

/**
 * components/admin/homepage-builder/FocalPointControl.tsx
 *
 * Admin-only background image focal-point drag control (Slice K / K.1).
 *
 * Renders an absolutely-positioned overlay over a block that has a background
 * image. The user can drag to reposition the focal point and use the zoom
 * slider to scale the background image.
 *
 * PERSISTENCE (Slice K)
 *   Focal point and zoom are persisted to `config._layout.background.position`
 *   and `config._layout.background.zoom` respectively. Both survive save/reload.
 *   Values are committed via onPositionCommit / onZoomCommit, which propagate
 *   through CanvasBlockPreview → onFieldChange → inspectorDraft → Speichern.
 *
 * KEYBOARD FALLBACK
 *   Arrow keys nudge the focal point by 5% when the overlay is focused.
 *   Shift+Arrow nudges by 1% for fine-grained control.
 *
 * SAFE-AREA OVERLAY
 *   Subtle dashed guides show approximate mobile crop boundary and text/content
 *   safe area. Admin canvas only, never affects public output.
 *
 * ZOOM CONTROL (Slice K.1)
 *   Zoom slider (100%–200%) controls CSS background-size.
 *   100% = cover (default). Reset returns to center + 100%.
 *
 * MOBILE READINESS
 *   Architecture is ready for per-breakpoint focal point / zoom via
 *   background.responsive.{desktop,tablet,mobile}.{position,zoom} in a future
 *   slice. No breakpoint-specific UI is shown yet.
 *
 * INTERFACE
 *   position          — CSS background-position string (e.g. "50% 50%")
 *   zoom              — 100–200 integer
 *   onPositionChange  — called live during drag (local preview only)
 *   onPositionCommit  — called on drag end / keyboard / reset (persists to config)
 *   onZoomChange      — called live during slider drag (local preview only)
 *   onZoomCommit      — called on slider release / keyboard / reset (persists to config)
 *   onReset           — reset focal point to center AND zoom to 100
 */

import { useRef, useCallback, useState } from "react";
import { Crosshair, RotateCcw, ZoomIn } from "lucide-react";

// ---------------------------------------------------------------------------
// Debug flag — set true only during local development to see coordinate badge
// ---------------------------------------------------------------------------

const DEBUG_SHOW_COORDINATE_BADGE = false;

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
  /** CSS background-position, e.g. "50% 50%". */
  position: string;
  /** Zoom level 100–200. 100 = cover (default). */
  zoom: number;
  /** Called live during drag for instant preview. */
  onPositionChange: (pos: string) => void;
  /** Called on drag end, keyboard nudge — use to persist position to config. */
  onPositionCommit: (pos: string) => void;
  /** Called live during zoom slider interaction for instant preview. */
  onZoomChange: (zoom: number) => void;
  /** Called on slider release — use to persist zoom to config. */
  onZoomCommit: (zoom: number) => void;
  /** Reset focal point to center AND zoom to 100. */
  onReset: () => void;
};

// ---------------------------------------------------------------------------
// FocalPointControl
// ---------------------------------------------------------------------------

export function FocalPointControl({
  position,
  zoom,
  onPositionChange,
  onPositionCommit,
  onZoomChange,
  onZoomCommit,
  onReset,
}: FocalPointControlProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Visual states for cursor + dot animation
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

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
    if (e.button !== 0 && e.button !== undefined) return;
    // Don't start drag when interacting with the bottom toolbar controls
    if ((e.target as HTMLElement).closest("[data-focal-toolbar]")) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    setIsDragging(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    onPositionChange(computePosition(e.clientX, e.clientY));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    e.preventDefault();
    onPositionChange(computePosition(e.clientX, e.clientY));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    onPositionCommit(position);
  }

  // ── Keyboard fallback ──────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 1 : 5;
    let [x, y] = parsePosition(position);
    if (e.key === "ArrowLeft")       { e.preventDefault(); x = clamp(x - step, 0, 100); }
    else if (e.key === "ArrowRight") { e.preventDefault(); x = clamp(x + step, 0, 100); }
    else if (e.key === "ArrowUp")    { e.preventDefault(); y = clamp(y - step, 0, 100); }
    else if (e.key === "ArrowDown")  { e.preventDefault(); y = clamp(y + step, 0, 100); }
    else return;
    const newPos = formatPosition(x, y);
    onPositionChange(newPos);
    onPositionCommit(newPos);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      ref={overlayRef}
      className={[
        "absolute inset-0 z-10 select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      ].join(" ")}
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={() => !draggingRef.current && setIsHovering(true)}
      onPointerLeave={() => { if (!draggingRef.current) setIsHovering(false); }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-label="Bildposition — Ziehen oder Pfeiltasten"
      aria-valuenow={Math.round(px)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`Horizontal ${Math.round(px)}%, Vertikal ${Math.round(py)}%`}
    >
      {/* Subtle guide grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px)," +
            "linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)",
          backgroundSize: "25% 25%",
        }}
        aria-hidden="true"
      />

      {/* ── Safe-area overlay ─────────────────────────────────────────── */}
      {/*
       * These guides help editors avoid placing important subjects behind text
       * or outside the mobile viewport crop. They are subtle, non-interactive,
       * and exist only in the admin canvas (never in public rendering).
       *
       * Mobile crop: portrait phone shows roughly the center 56% of a landscape
       * image. Left/right 22% would be clipped on a typical 9:16 screen.
       * Text safe area: a generous inner rectangle where headlines typically appear.
       *
       * Future: when breakpoint-specific focal point lands, these guides can be
       * made breakpoint-aware (showing the crop for the active viewport toggle).
       */}

      {/* Mobile crop boundary — left + right side bars */}
      <div
        className="absolute top-0 bottom-8 pointer-events-none"
        style={{ left: 0, width: "22%", borderRight: "1px dashed rgba(255,255,255,0.22)" }}
        aria-hidden="true"
      />
      <div
        className="absolute top-0 bottom-8 pointer-events-none"
        style={{ right: 0, width: "22%", borderLeft: "1px dashed rgba(255,255,255,0.22)" }}
        aria-hidden="true"
      >
        <span
          className="absolute top-1 right-1 text-[9px] text-white/45 font-medium tracking-wide leading-none"
        >
          Mobile-Crop
        </span>
      </div>

      {/* Text / content safe area — inner rectangle */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "10%",
          bottom: "calc(30% + 2rem)", // leave space for bottom toolbar
          left: "15%",
          right: "15%",
          border: "1px dashed rgba(255,255,255,0.14)",
          borderRadius: "2px",
        }}
        aria-hidden="true"
      >
        <span
          className="absolute bottom-1 left-1 text-[9px] text-white/35 font-medium tracking-wide leading-none"
        >
          Textbereich
        </span>
      </div>

      {/* ── Focal point dot ───────────────────────────────────────────── */}
      <div
        className={[
          "absolute -translate-x-1/2 -translate-y-1/2",
          "flex items-center justify-center rounded-full",
          "border-2 border-white shadow-md pointer-events-none",
          "transition-all duration-150 ease-out",
          isDragging
            ? "h-12 w-12 bg-white/25 shadow-xl shadow-black/50"
            : isHovering
              ? "h-10 w-10 bg-black/40"
              : "h-9 w-9 bg-black/30",
        ].join(" ")}
        style={{ left: `${px}%`, top: `${py}%` }}
        aria-hidden="true"
      >
        <Crosshair
          className={[
            "text-white transition-all duration-150",
            isDragging ? "h-5 w-5" : isHovering ? "h-4 w-4 opacity-90" : "h-4 w-4",
          ].join(" ")}
        />
        {/* Pulse ring while actively dragging */}
        {isDragging && (
          <span className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping" />
        )}
      </div>

      {/* ── Drag coordinate tooltip (visible only while dragging or in debug mode) */}
      {(isDragging || DEBUG_SHOW_COORDINATE_BADGE) && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: `${px}%`,
            top: `${py}%`,
            transform: "translate(-50%, calc(-100% - 20px))",
          }}
          aria-hidden="true"
        >
          <div className="rounded-md bg-black/75 px-2 py-0.5 text-[10px] text-white font-mono whitespace-nowrap shadow-lg">
            {Math.round(px)}% · {Math.round(py)}%
          </div>
        </div>
      )}

      {/* ── Instruction hint (visible when not dragging) ────────────── */}
      {!isDragging && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none"
          aria-hidden="true"
        >
          <div className="rounded-md bg-black/45 px-2.5 py-1 text-[10px] text-white/85 font-medium whitespace-nowrap backdrop-blur-[2px]">
            Bild ziehen, um den Fokuspunkt zu ändern
          </div>
        </div>
      )}

      {/* ── Bottom toolbar: zoom slider + reset button ───────────────── */}
      <div
        data-focal-toolbar
        className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-3 py-2 bg-black/50 backdrop-blur-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Zoom slider */}
        <label
          className="flex items-center gap-2 flex-1 min-w-0"
          title={`Zoom: ${zoom}%`}
        >
          <ZoomIn className="h-3.5 w-3.5 text-white/70 shrink-0" aria-hidden="true" />
          <span className="text-[10px] text-white/70 font-medium shrink-0">Zoom</span>
          <input
            type="range"
            min={100}
            max={200}
            step={1}
            value={zoom}
            onChange={(e) => {
              e.stopPropagation();
              onZoomChange(Number(e.target.value));
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onZoomCommit(Number((e.currentTarget as HTMLInputElement).value));
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => {
              e.stopPropagation();
              onZoomCommit(zoom);
            }}
            className="flex-1 h-1 min-w-0 cursor-pointer"
            style={{ accentColor: "rgba(255,255,255,0.9)" }}
            aria-label={`Hintergrundbilder-Zoom: ${zoom}%`}
          />
          <span className="text-[10px] text-white/70 font-mono shrink-0 w-8 text-right">
            {zoom}%
          </span>
        </label>

        {/* Reset button */}
        <button
          type="button"
          data-focal-reset
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 active:bg-white/30 px-2 py-1 text-[10px] text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white shrink-0"
          title="Fokuspunkt und Zoom zurücksetzen (Mitte / 100%)"
          aria-label="Bildposition auf Mitte zurücksetzen und Zoom auf 100% setzen"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Zurücksetzen
        </button>
      </div>
    </div>
  );
}
