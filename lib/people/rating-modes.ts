/**
 * PERSON-UX-06 — Configurable criterion rating modes.
 *
 * Each DevelopmentCriterion independently chooses its input/display mode.
 * All modes normalize deterministically to canonical integer 0–100.
 *
 * ── Modes ──────────────────────────────────────────────────────────────────
 *
 * SCORE_0_100   Assessor enters/selects integer 0..100.
 *               Canonical: same value.
 *
 * QUALITATIVE_5 Assessor selects one of five named levels (1..5).
 *               Default German labels (development-oriented):
 *                 1 → Entwicklungsbedarf  (canonical: 0)
 *                 2 → Basis               (canonical: 25)
 *                 3 → Solide              (canonical: 50)
 *                 4 → Stark               (canonical: 75)
 *                 5 → Herausragend        (canonical: 100)
 *               Tenant may override labels per criterion (qualitativeLabels).
 *               Changing labels does NOT reinterpret historical snapshots.
 *
 * SCORE_1_10    Assessor selects integer 1..10.
 *               Linear formula: Math.round((v - 1) / 9 * 100)
 *               Boundary check: 1 → 0, 10 → 100.
 *
 * PERCENTAGE    Assessor enters 0..100 %.
 *               Canonical: same numeric value (no transform).
 *
 * ── Historical safety ──────────────────────────────────────────────────────
 * The ratingModeSnapshot, rawValue, and rawLabelSnapshot fields in
 * DevelopmentAssessmentRating are written at creation time. Changing the
 * criterion's ratingMode later never reinterprets existing rows.
 */

// ── Mode constants ─────────────────────────────────────────────────────────

export const RATING_MODES = {
  SCORE_0_100: "SCORE_0_100",
  QUALITATIVE_5: "QUALITATIVE_5",
  SCORE_1_10: "SCORE_1_10",
  PERCENTAGE: "PERCENTAGE",
} as const;

export type RatingMode = (typeof RATING_MODES)[keyof typeof RATING_MODES];

export const ALL_RATING_MODES: RatingMode[] = [
  RATING_MODES.SCORE_0_100,
  RATING_MODES.QUALITATIVE_5,
  RATING_MODES.SCORE_1_10,
  RATING_MODES.PERCENTAGE,
];

/** Returns true iff the value is a known RatingMode. */
export function isValidRatingMode(value: unknown): value is RatingMode {
  return typeof value === "string" && ALL_RATING_MODES.includes(value as RatingMode);
}

// ── QUALITATIVE_5 defaults ────────────────────────────────────────────────

/**
 * Default German 5-level labels for QUALITATIVE_5 mode.
 * Index 0 = level 1 (lowest), index 4 = level 5 (highest).
 * Development-oriented: no insulting language.
 */
export const DEFAULT_QUALITATIVE_5_LABELS: [string, string, string, string, string] = [
  "Entwicklungsbedarf",
  "Basis",
  "Solide",
  "Stark",
  "Herausragend",
];

/**
 * Canonical normalized scores for QUALITATIVE_5 levels 1–5.
 * Level index 0 (=level 1) → 0, level index 4 (=level 5) → 100.
 */
export const QUALITATIVE_5_CANONICAL: [number, number, number, number, number] = [
  0, 25, 50, 75, 100,
];

/**
 * Resolves the active label list for a criterion.
 * Falls back to system defaults when tenant-configured labels are absent,
 * invalid, or the wrong length.
 */
export function resolveQualitative5Labels(
  customLabels: unknown,
): [string, string, string, string, string] {
  if (
    Array.isArray(customLabels) &&
    customLabels.length === 5 &&
    customLabels.every((l) => typeof l === "string" && l.trim().length > 0)
  ) {
    return customLabels as [string, string, string, string, string];
  }
  return DEFAULT_QUALITATIVE_5_LABELS;
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validates a raw input value for the given mode.
 *
 * Returns true iff the value is an integer in the valid range for the mode.
 */
export function validateRawInput(mode: RatingMode, rawValue: unknown): rawValue is number {
  if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) return false;
  switch (mode) {
    case RATING_MODES.SCORE_0_100:
      return rawValue >= 0 && rawValue <= 100;
    case RATING_MODES.QUALITATIVE_5:
      return rawValue >= 1 && rawValue <= 5;
    case RATING_MODES.SCORE_1_10:
      return rawValue >= 1 && rawValue <= 10;
    case RATING_MODES.PERCENTAGE:
      return rawValue >= 0 && rawValue <= 100;
  }
}

// ── Normalization ──────────────────────────────────────────────────────────

/**
 * Normalizes a validated raw input value to canonical 0–100.
 *
 * SCORE_1_10 formula: Math.round((rawValue - 1) / 9 * 100)
 *   Verified boundaries: 1 → 0, 10 → 100.
 *   Mid-point 5 → Math.round(4/9*100) = Math.round(44.44…) = 44.
 *   Mid-point 6 → Math.round(5/9*100) = Math.round(55.55…) = 56.
 *
 * Callers MUST call validateRawInput first. Passing an invalid rawValue
 * produces undefined behavior.
 */
export function normalizeRating(mode: RatingMode, rawValue: number): number {
  switch (mode) {
    case RATING_MODES.SCORE_0_100:
      return rawValue;
    case RATING_MODES.QUALITATIVE_5:
      // rawValue is 1-indexed level; clamp for safety
      return QUALITATIVE_5_CANONICAL[Math.max(0, Math.min(4, rawValue - 1))];
    case RATING_MODES.SCORE_1_10:
      return Math.round(((rawValue - 1) / 9) * 100);
    case RATING_MODES.PERCENTAGE:
      return rawValue;
  }
}

/**
 * Returns the display label for a raw value in a given mode.
 * Returns null for modes that have no named labels (numeric inputs).
 */
export function getRawLabel(
  mode: RatingMode,
  rawValue: number,
  customLabels?: unknown,
): string | null {
  if (mode !== RATING_MODES.QUALITATIVE_5) return null;
  const labels = resolveQualitative5Labels(customLabels);
  return labels[rawValue - 1] ?? null;
}
