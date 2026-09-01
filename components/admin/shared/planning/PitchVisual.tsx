"use client";

/**
 * components/admin/shared/planning/PitchVisual.tsx
 *
 * PLANNING-RESOURCE-UX-01 — reusable CSS/SVG football-pitch representation.
 *
 * Supports:
 *   - FULL_PITCH: whole field rendered (both halves implied)
 *   - HALF_PITCH: one half highlighted; side derived from the resource name
 *     ("Hälfte A" / "A" → left side; "Hälfte B" / "B" → right side)
 *
 * States rendered visually and consistently:
 *   free      → green background
 *   occupied  → rose/red background
 *   selected  → primary-brand border + tinted background
 *   neutral   → gray (before date/time selected)
 *
 * No static image assets — entirely CSS/SVG so availability, occupancy and
 * selection states can be rendered dynamically per resource.
 */

import type { FacilityResourceType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PitchVisualState = "free" | "occupied" | "selected" | "neutral";

export type PitchVisualProps = {
  resourceType: FacilityResourceType;
  /** Raw resource name — used to detect which half (A or B) for HALF_PITCH. */
  resourceName: string;
  state: PitchVisualState;
  /** Which half side is "mine" when the sibling half is occupied. Allows showing split-state per-half. */
  siblingState?: PitchVisualState;
  /** Compact/small rendering (used in "Deine Auswahl" summary). Default false. */
  compact?: boolean;
  /** Inline list glyph — smallest pitch/hall indicator for compact rows. */
  micro?: boolean;
  /**
   * PLANNING-RESOURCE-UX-01-C2 — facility-level type (e.g. "INDOOR_HALL").
   * When "INDOOR_HALL", renders a neutral hall visual regardless of resource
   * type — prevents football-pitch markings from appearing on indoor halls.
   */
  facilityType?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detects which half of the pitch this HALF_PITCH resource occupies.
 * Checks the resource name (case-insensitive) for common German patterns.
 */
export function detectHalfSide(name: string): "A" | "B" {
  const upper = name.toUpperCase();
  // "Hälfte B", "HALF B", ends with " B", code ends with "_B"
  if (/(?:HÄLFTE|HALF)\s*B|[\s_]B$|B$/.test(upper)) return "B";
  // Default to A (also covers "Hälfte A")
  return "A";
}

const STATE_FILL: Record<PitchVisualState, string> = {
  free: "#dcfce7",      // green-100
  occupied: "#ffe4e6",  // rose-100
  selected: "#dbeafe",  // blue-100
  neutral: "#f3f4f6",   // gray-100
};

const STATE_STROKE: Record<PitchVisualState, string> = {
  free: "#16a34a",      // green-600
  occupied: "#e11d48",  // rose-600
  selected: "#2563eb",  // blue-600
  neutral: "#9ca3af",   // gray-400
};

const STATE_MARKING: Record<PitchVisualState, string> = {
  free: "#86efac",      // green-300
  occupied: "#fda4af",  // rose-300
  selected: "#93c5fd",  // blue-300
  neutral: "#d1d5db",   // gray-300
};

// ── SVG Pitch ─────────────────────────────────────────────────────────────────

/**
 * Full-pitch SVG with center circle, halfway line, and penalty arcs.
 * The pitch is always rendered landscape (width > height).
 */
function FullPitchSvg({ state, w, h }: { state: PitchVisualState; w: number; h: number }) {
  const fill = STATE_FILL[state];
  const stroke = STATE_STROKE[state];
  const marking = STATE_MARKING[state];

  const cx = w / 2;
  const cy = h / 2;
  const circleR = Math.min(w, h) * 0.18;
  const penaltyW = w * 0.12;
  const penaltyH = h * 0.45;
  const goalW = w * 0.04;
  const goalH = h * 0.2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block" aria-hidden>
      {/* Outer pitch */}
      <rect x={1} y={1} width={w - 2} height={h - 2} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} />
      {/* Center line */}
      <line x1={cx} y1={2} x2={cx} y2={h - 2} stroke={marking} strokeWidth={1} />
      {/* Center circle */}
      <circle cx={cx} cy={cy} r={circleR} fill="none" stroke={marking} strokeWidth={1} />
      {/* Center spot */}
      <circle cx={cx} cy={cy} r={1.5} fill={marking} />
      {/* Left penalty area */}
      <rect x={2} y={(h - penaltyH) / 2} width={penaltyW} height={penaltyH} fill="none" stroke={marking} strokeWidth={1} />
      {/* Left goal area */}
      <rect x={2} y={(h - goalH) / 2} width={goalW} height={goalH} fill="none" stroke={marking} strokeWidth={1} />
      {/* Right penalty area */}
      <rect x={w - penaltyW - 2} y={(h - penaltyH) / 2} width={penaltyW} height={penaltyH} fill="none" stroke={marking} strokeWidth={1} />
      {/* Right goal area */}
      <rect x={w - goalW - 2} y={(h - goalH) / 2} width={goalW} height={goalH} fill="none" stroke={marking} strokeWidth={1} />
    </svg>
  );
}

/**
 * Half-pitch SVG — shows both halves but highlights the active one.
 * The "other" half defaults to neutral unless siblingState is passed.
 */
function HalfPitchSvg({
  side,
  state,
  siblingState = "neutral",
  w,
  h,
}: {
  side: "A" | "B";
  state: PitchVisualState;
  siblingState?: PitchVisualState;
  w: number;
  h: number;
}) {
  const cx = w / 2;
  const cy = h / 2;
  const circleR = Math.min(w, h) * 0.18;
  const penaltyW = w * 0.12;
  const penaltyH = h * 0.45;
  const goalW = w * 0.04;
  const goalH = h * 0.2;

  const aFill = side === "A" ? STATE_FILL[state] : STATE_FILL[siblingState];
  const aStroke = side === "A" ? STATE_STROKE[state] : STATE_STROKE[siblingState];
  const aMarking = side === "A" ? STATE_MARKING[state] : STATE_MARKING[siblingState];

  const bFill = side === "B" ? STATE_FILL[state] : STATE_FILL[siblingState];
  const bStroke = side === "B" ? STATE_STROKE[state] : STATE_STROKE[siblingState];
  const bMarking = side === "B" ? STATE_MARKING[state] : STATE_MARKING[siblingState];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block" aria-hidden>
      {/* Left half (A) */}
      <rect x={1} y={1} width={cx - 1} height={h - 2} fill={aFill} stroke={aStroke} strokeWidth={1.5} />
      {/* Right half (B) */}
      <rect x={cx} y={1} width={cx - 1} height={h - 2} fill={bFill} stroke={bStroke} strokeWidth={1.5} />
      {/* Outer border */}
      <rect x={1} y={1} width={w - 2} height={h - 2} fill="none" stroke={side === "A" ? aStroke : bStroke} strokeWidth={1.5} rx={2} />
      {/* Center divider */}
      <line x1={cx} y1={2} x2={cx} y2={h - 2} stroke="#9ca3af" strokeWidth={1.5} />
      {/* Half labels */}
      <text x={cx / 2} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(w, h) * 0.28} fontWeight="600" fill={aStroke} opacity={0.7}>
        A
      </text>
      <text x={cx + cx / 2} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(w, h) * 0.28} fontWeight="600" fill={bStroke} opacity={0.7}>
        B
      </text>
      {/* Center circle (straddles both halves) */}
      <circle cx={cx} cy={cy} r={circleR} fill="none" stroke="#9ca3af" strokeWidth={0.8} />
      {/* Center spot */}
      <circle cx={cx} cy={cy} r={1.5} fill="#9ca3af" />
      {/* Left penalty area */}
      <rect x={2} y={(h - penaltyH) / 2} width={penaltyW} height={penaltyH} fill="none" stroke={aMarking} strokeWidth={0.8} />
      {/* Left goal area */}
      <rect x={2} y={(h - goalH) / 2} width={goalW} height={goalH} fill="none" stroke={aMarking} strokeWidth={0.8} />
      {/* Right penalty area */}
      <rect x={w - penaltyW - 2} y={(h - penaltyH) / 2} width={penaltyW} height={penaltyH} fill="none" stroke={bMarking} strokeWidth={0.8} />
      {/* Right goal area */}
      <rect x={w - goalW - 2} y={(h - goalH) / 2} width={goalW} height={goalH} fill="none" stroke={bMarking} strokeWidth={0.8} />
    </svg>
  );
}

// ── Public Component ──────────────────────────────────────────────────────────

export function PitchVisual({ resourceType, resourceName, state, siblingState, compact = false, micro = false, facilityType }: PitchVisualProps) {
  const w = micro ? 18 : compact ? 72 : 120;
  const h = micro ? 11 : compact ? 44 : 74;

  // MVP hall fallback: indoor-hall facilities must not display football-pitch markings,
  // even when their resource type is FULL_PITCH or HALF_PITCH.
  const isIndoorHall = facilityType === "INDOOR_HALL";

  if (!isIndoorHall && resourceType === "FULL_PITCH") {
    return <FullPitchSvg state={state} w={w} h={h} />;
  }

  if (!isIndoorHall && resourceType === "HALF_PITCH") {
    const side = detectHalfSide(resourceName);
    return <HalfPitchSvg side={side} state={state} siblingState={siblingState} w={w} h={h} />;
  }

  // Indoor hall or OTHER — neutral facility/hall visual (no football markings).
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block" aria-hidden>
      <rect x={1} y={1} width={w - 2} height={h - 2} fill={STATE_FILL[state]} stroke={STATE_STROKE[state]} strokeWidth={1.5} rx={4} />
      {/* Simple court lines — basketball/volleyball-style neutral markings */}
      <line x1={w / 2} y1={4} x2={w / 2} y2={h - 4} stroke={STATE_MARKING[state]} strokeWidth={0.8} />
      <rect x={w * 0.22} y={4} width={w * 0.56} height={h - 8} fill="none" stroke={STATE_MARKING[state]} strokeWidth={0.8} rx={2} />
      <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={compact ? 9 : 11} fill={STATE_STROKE[state]} fontWeight="600">
        Halle
      </text>
    </svg>
  );
}
