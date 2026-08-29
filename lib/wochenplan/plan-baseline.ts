/**
 * lib/wochenplan/plan-baseline.ts
 *
 * WOCHENPLAN-2.0-01H-D — encodes whether an alternative WochenplanPlan inherits
 * canonical Standardplan activities or starts from an explicit empty canvas.
 *
 * Uses the existing nullable `description` field with a reserved machine
 * marker so no schema migration is required. User-facing description text is
 * preserved after the marker when present.
 */

/** Reserved prefix stored in WochenplanPlan.description for empty-baseline plans. */
export const WOCHEPLAN_EMPTY_BASELINE_MARKER = "__sce:baseline=empty__";

export type WochenplanPlanBaselineMode = "canonical" | "empty";

export function isEmptyBaselineDescription(description: string | null | undefined): boolean {
  return (description ?? "").includes(WOCHEPLAN_EMPTY_BASELINE_MARKER);
}

export function getWochenplanPlanBaselineMode(
  description: string | null | undefined,
): WochenplanPlanBaselineMode {
  return isEmptyBaselineDescription(description) ? "empty" : "canonical";
}

/** Strips the machine marker for display; returns null when nothing remains. */
export function stripBaselineMarker(description: string | null | undefined): string | null {
  if (!description) return null;
  const stripped = description.replace(WOCHEPLAN_EMPTY_BASELINE_MARKER, "").trim();
  return stripped.length > 0 ? stripped : null;
}

export function buildEmptyBaselineDescription(userDescription?: string | null): string {
  const trimmed = userDescription?.trim();
  if (!trimmed) return WOCHEPLAN_EMPTY_BASELINE_MARKER;
  return `${WOCHEPLAN_EMPTY_BASELINE_MARKER}${trimmed}`;
}

export function preserveBaselineOnDescriptionUpdate(
  currentDescription: string | null | undefined,
  nextUserDescription: string | null | undefined,
): string | null {
  const trimmed = nextUserDescription?.trim() || null;
  if (!isEmptyBaselineDescription(currentDescription)) {
    return trimmed;
  }
  return trimmed ? buildEmptyBaselineDescription(trimmed) : WOCHEPLAN_EMPTY_BASELINE_MARKER;
}
