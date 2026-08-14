/**
 * lib/publishing/infoboard/facility-group.ts
 *
 * INFOBOARD-UX-03 — full-pitch / subdivision deduplication logic.
 *
 * A physical facility can have both a FULL_PITCH resource (the whole pitch)
 * and HALF_PITCH resources (subdivisions such as Feld A, Feld B). Without
 * deduplication, Screen 2 would show redundant or misleading cards:
 *
 *   • Hauptplatz — FREI
 *   • Feld A     — FREI
 *   • Feld B     — FREI
 *
 * The canonical display rules collapse this into a single, accurate
 * representation:
 *
 *   Rule A — All free:
 *     Whole pitch free + all subdivisions free → show ONLY the FULL_PITCH.
 *
 *   Rule B — Whole-pitch event:
 *     The FULL_PITCH itself has a current or next event → show ONLY the
 *     FULL_PITCH. Do NOT also render the HALF_PITCHes.
 *
 *   Rule C — Subdivisions occupied:
 *     No whole-pitch event, but specific HALF_PITCHes have events → show
 *     the HALF_PITCHes (suppress the FULL_PITCH to avoid a misleading FREI
 *     card alongside occupied sub-fields).
 *
 *   Rule D — Mixed partial state:
 *     Same as Rule C in display terms — the subdivision list always
 *     includes free HALF_PITCHes alongside occupied ones, so a visitor
 *     sees the complete picture for the facility.
 *
 *   Rule E — Hierarchy-driven:
 *     The grouping is driven exclusively by `facilityId` (from the DB) and
 *     `resourceType` ("FULL_PITCH" | "HALF_PITCH"). No pitch codes or names
 *     are hardcoded; the solution works for any tenant configuration.
 *
 * Design constraints:
 *   - Pure function — no Prisma, no DB, no React, no Next.js.
 *   - Inputs are never mutated. Result arrays are always new arrays.
 *   - Preserves original sort order within each group.
 */

import type { PitchOccupancy } from "@/lib/publishing/event-types";

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * A collapsed, display-ready group for one physical facility.
 *
 *   "whole"       — show a single FULL_PITCH card (Rules A, B, or no
 *                   subdivisions configured).
 *   "subdivisions" — show individual HALF_PITCH cards (Rules C, D), and
 *                    suppress the FULL_PITCH card.
 */
export type FacilityDisplayGroup =
  | {
      readonly mode: "whole";
      readonly pitch: PitchOccupancy;
    }
  | {
      readonly mode: "subdivisions";
      readonly facilityId: string;
      readonly facilityName: string;
      readonly items: readonly PitchOccupancy[];
    };

// ── Helper ────────────────────────────────────────────────────────────────────

function hasEvent(p: PitchOccupancy): boolean {
  return p.currentEvent !== null || p.nextEvent !== null;
}

// ── groupFacilityPitches ──────────────────────────────────────────────────────

/**
 * Applies the INFOBOARD-UX-03 full-pitch/subdivision display rules to a flat
 * list of PitchOccupancy entries, returning a collapsed list of
 * FacilityDisplayGroup entries suitable for direct rendering.
 *
 * Pitches that belong to no facility group (empty facilityId) are treated as
 * standalone "whole" entries.
 */
export function groupFacilityPitches(
  pitches: readonly PitchOccupancy[],
): FacilityDisplayGroup[] {
  // Group by facilityId, preserving order of first appearance.
  const facilityOrder: string[] = [];
  const byFacility = new Map<string, PitchOccupancy[]>();

  for (const p of pitches) {
    const fid = p.facilityId || `__standalone__${p.code}`;
    if (!byFacility.has(fid)) {
      facilityOrder.push(fid);
      byFacility.set(fid, []);
    }
    byFacility.get(fid)!.push(p);
  }

  const groups: FacilityDisplayGroup[] = [];

  for (const fid of facilityOrder) {
    const resources = byFacility.get(fid)!;

    const fullPitch = resources.find((r) => r.resourceType === "FULL_PITCH") ?? null;
    const halfPitches = resources.filter((r) => r.resourceType === "HALF_PITCH");

    // ── No hierarchy (no FULL_PITCH or no HALF_PITCHes) ──────────────────
    if (!fullPitch || halfPitches.length === 0) {
      for (const r of resources) {
        groups.push({ mode: "whole", pitch: r });
      }
      continue;
    }

    // ── FULL_PITCH + HALF_PITCH hierarchy ─────────────────────────────────
    if (hasEvent(fullPitch)) {
      // Rule B: event on the whole pitch — suppress subdivisions.
      groups.push({ mode: "whole", pitch: fullPitch });
      continue;
    }

    const anyHalfHasEvent = halfPitches.some(hasEvent);

    if (!anyHalfHasEvent) {
      // Rule A: everything free — show only the FULL_PITCH.
      groups.push({ mode: "whole", pitch: fullPitch });
    } else {
      // Rules C / D: show subdivisions (occupied and free alike).
      groups.push({
        mode: "subdivisions",
        facilityId: fid,
        facilityName: fullPitch.facilityName,
        items: halfPitches,
      });
    }
  }

  return groups;
}
