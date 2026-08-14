/**
 * lib/publishing/infoboard/facility-group.ts
 *
 * Canonical facility hierarchy resolver for Infoboard kiosk presentation.
 *
 * ── Domain invariant ──────────────────────────────────────────────────────────
 *
 * Facility hierarchy is a domain presentation invariant.
 * Styling and Designer changes must NEVER alter which physical resources are
 * simultaneously presented. This module is the ONE canonical place where the
 * FULL_PITCH / HALF_PITCH display rules are implemented. Do NOT recreate this
 * logic in rendering components, feed builders, or designer preview paths.
 *
 * ── Grouping identity ────────────────────────────────────────────────────────
 *
 * Resources are grouped by `facilityId` — the stable DB identifier for the
 * parent facility. `facilityName` MUST NOT be used for grouping: it is display
 * text and may change independently of the physical resource hierarchy.
 *
 * ── Hierarchy rules ──────────────────────────────────────────────────────────
 *
 * For a facility group that contains BOTH a FULL_PITCH and ≥1 HALF_PITCH:
 *
 *   State A — all free:
 *     Show ONLY the FULL_PITCH card (FREI). Never show A/B.
 *
 *   State B — FULL_PITCH has a current event:
 *     Show ONLY the FULL_PITCH card with the event. A FULL_PITCH current event
 *     owns the complete facility — child halves MUST NOT appear even if their
 *     individual occupancy records look free.
 *
 *   State C — any HALF_PITCH has a current event:
 *     Show ONLY the HALF_PITCH cards. Suppress FULL_PITCH. All configured
 *     halves are shown (occupied or free), so visitors see the complete
 *     subdivision picture.
 *
 *   State D — both halves have current events:
 *     Same as State C — show HALF_PITCH cards, suppress FULL_PITCH.
 *
 * For facilities with ONLY FULL_PITCH resources (no halves configured), or
 * ONLY HALF_PITCH resources (no FULL parent), resources are returned as-is.
 *
 * ── Designer vs public ───────────────────────────────────────────────────────
 *
 * This resolver is for the PUBLIC kiosk runtime only. The designer shows ALL
 * configured zones so admins can position and size them — hierarchy suppression
 * must never apply in the designer path.
 *
 * ── Design constraints ───────────────────────────────────────────────────────
 *   - Pure function: no React, no DB, no Next.js, no environment variables.
 *   - No hardcoded facility names, pitch names, or resource codes.
 *   - Inputs are never mutated.
 *   - Fully tested independently of rendering components.
 */

import type { PitchOccupancy } from "../event-types";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The result of resolving facility hierarchy for a set of pitches.
 *
 *   visiblePitches — the resource entries that should be rendered.
 *   suppressedCodes — resource codes that exist in the config but should NOT
 *     be rendered (not even as FREI). Callers use this to skip zones in the
 *     map scene without displaying misleading free-state overlays.
 */
export type FacilityGroupResult = {
  readonly visiblePitches: readonly PitchOccupancy[];
  readonly suppressedCodes: ReadonlySet<string>;
};

// ── groupFacilityPitches ──────────────────────────────────────────────────────

/**
 * Applies the canonical FULL_PITCH / HALF_PITCH display hierarchy to a flat
 * list of PitchOccupancy entries, returning only the entries that should be
 * rendered in the public kiosk view.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 * Call this function once per render with the complete PitchOccupancy list from
 * the feed. Pass the result's `visiblePitches` to pitch-card rendering and the
 * `suppressedCodes` to the map scene so suppressed zones are completely omitted.
 *
 * Do NOT call this in the designer path. Do NOT call it multiple times for
 * different render sections (map vs rail vs cards) — call once and share.
 *
 * @param pitches - The complete flat pitch occupancy list from the feed.
 * @returns       - visiblePitches (render these) + suppressedCodes (skip these).
 */
export function groupFacilityPitches(
  pitches: readonly PitchOccupancy[],
): FacilityGroupResult {
  // Fast path: empty or single-resource feed needs no grouping.
  if (pitches.length <= 1) {
    return { visiblePitches: pitches, suppressedCodes: new Set() };
  }

  // Group by facilityId — stable DB identity, NOT facilityName.
  const byFacility = new Map<string, PitchOccupancy[]>();
  for (const pitch of pitches) {
    let group = byFacility.get(pitch.facilityId);
    if (group === undefined) {
      group = [];
      byFacility.set(pitch.facilityId, group);
    }
    group.push(pitch);
  }

  const visible: PitchOccupancy[] = [];
  const suppressed = new Set<string>();

  for (const group of byFacility.values()) {
    const fullPitches = group.filter((p) => p.resourceType === "FULL_PITCH");
    const halfPitches = group.filter((p) => p.resourceType === "HALF_PITCH");

    // No mixed FULL+HALF in this facility — return all resources unchanged.
    if (fullPitches.length === 0 || halfPitches.length === 0) {
      visible.push(...group);
      continue;
    }

    // Mixed facility: apply hierarchy rules.
    const fullHasCurrentEvent = fullPitches.some((p) => p.currentEvent !== null);
    const anyHalfHasCurrentEvent = halfPitches.some((p) => p.currentEvent !== null);

    if (anyHalfHasCurrentEvent) {
      // State C or D — half-pitch subdivision mode.
      // Show all HALF_PITCH cards (occupied or free); suppress FULL_PITCH.
      visible.push(...halfPitches);
      for (const f of fullPitches) suppressed.add(f.code);
    } else {
      // State A or B — full-pitch representation mode.
      // Show only FULL_PITCH (with current event if State B, FREI if State A).
      // A FULL_PITCH current event owns the complete facility — suppress halves.
      // Halves are also suppressed in State A (all free) — only FULL shows FREI.
      visible.push(...fullPitches);
      for (const h of halfPitches) suppressed.add(h.code);
    }
  }

  return { visiblePitches: visible, suppressedCodes: suppressed };
}
