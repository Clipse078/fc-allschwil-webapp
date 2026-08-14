/**
 * lib/infoboard/__tests__/anlageplan-pitch-hierarchy.test.ts
 *
 * INFOBOARD-UX-03-C3 — FULL_PITCH / HALF_PITCH mutual-exclusion suppression.
 *
 * Tests the deriveSuppressedCodes() function that implements the canonical
 * hierarchy rule:
 *
 *   For a facility with both FULL_PITCH and HALF_PITCH zones configured:
 *
 *   All halves free      → suppress HALF_PITCH zones → show FULL_PITCH FREI
 *   FULL_PITCH occupied  → suppress HALF_PITCH zones → show FULL_PITCH event
 *   Any half occupied    → suppress FULL_PITCH zone  → show HALF_PITCH zones
 *   All halves occupied  → suppress FULL_PITCH zone  → show all HALF_PITCH zones
 *
 * These are pure function tests covering the suppression logic directly.
 * Rendered tests covering the full InfoboardAnlageplan render path are in
 * components/infoboard/v2/__tests__/anlageplan-map-02.test.tsx.
 */

import { describe, it, expect } from "vitest";
import { deriveSuppressedCodes } from "@/components/infoboard/anlageplan/AnlageplanMapScene";
import type { ResourceZoneElement } from "@/lib/infoboard/anlageplan-types";
import type { PitchOccupancy } from "@/lib/publishing/event-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeZone(
  id: string,
  code: string,
  zoneType: "FULL_PITCH" | "HALF_PITCH",
): ResourceZoneElement {
  return {
    kind: "RESOURCE_ZONE",
    id,
    rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
    resourceCode: code,
    label: code,
    zoneType,
    showNextActivity: true,
  };
}

function makeOccupancy(
  code: string,
  facilityName: string,
  state: "FREE_NOW" | "OCCUPIED_NOW" | "UPCOMING",
  hasCurrent = false,
  hasNext = false,
): PitchOccupancy {
  return {
    code,
    displayLabel: code,
    facilityName,
    state,
    hasAllocationConflict: false,
    currentEvent: hasCurrent
      ? {
          eventId: `evt-${code}`,
          displayTitle: `Event on ${code}`,
          teamDisplayName: `Team ${code}`,
          opponentDisplayName: null,
          startAt: "2026-09-12T16:00:00.000Z",
          endAt: "2026-09-12T17:30:00.000Z",
          status: "IN_PROGRESS",
          type: "TRAINING",
          temporalRelation: "current",
          dressingRooms: [],
        }
      : null,
    nextEvent: hasNext
      ? {
          eventId: `next-${code}`,
          displayTitle: `Next on ${code}`,
          teamDisplayName: `NextTeam ${code}`,
          opponentDisplayName: null,
          startAt: "2026-09-12T18:00:00.000Z",
          endAt: "2026-09-12T19:30:00.000Z",
          status: "SCHEDULED",
          type: "TRAINING",
          temporalRelation: "next",
          dressingRooms: [],
        }
      : null,
  };
}

// ── Hierarchy suppression — core cases ────────────────────────────────────────

describe("deriveSuppressedCodes — core hierarchy", () => {
  it("all halves free → suppress HALF_PITCH → only FULL_PITCH visible", () => {
    const zones = [
      makeZone("full", "HP", "FULL_PITCH"),
      makeZone("half-a", "HP-A", "HALF_PITCH"),
      makeZone("half-b", "HP-B", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["HP", makeOccupancy("HP", "Hauptplatz", "FREE_NOW")],
      ["HP-A", makeOccupancy("HP-A", "Hauptplatz", "FREE_NOW")],
      ["HP-B", makeOccupancy("HP-B", "Hauptplatz", "FREE_NOW")],
    ]);

    const suppressed = deriveSuppressedCodes(zones, pitchMap);

    expect(suppressed.has("HP")).toBe(false);
    expect(suppressed.has("HP-A")).toBe(true);
    expect(suppressed.has("HP-B")).toBe(true);
  });

  it("FULL_PITCH occupied, halves free → suppress HALF_PITCH → show FULL_PITCH event", () => {
    const zones = [
      makeZone("full", "HP", "FULL_PITCH"),
      makeZone("half-a", "HP-A", "HALF_PITCH"),
      makeZone("half-b", "HP-B", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["HP", makeOccupancy("HP", "Hauptplatz", "OCCUPIED_NOW", true)],
      ["HP-A", makeOccupancy("HP-A", "Hauptplatz", "FREE_NOW")],
      ["HP-B", makeOccupancy("HP-B", "Hauptplatz", "FREE_NOW")],
    ]);

    const suppressed = deriveSuppressedCodes(zones, pitchMap);

    expect(suppressed.has("HP")).toBe(false);
    expect(suppressed.has("HP-A")).toBe(true);
    expect(suppressed.has("HP-B")).toBe(true);
  });

  it("one half occupied → suppress FULL_PITCH → show A (event) + B (free)", () => {
    const zones = [
      makeZone("full", "HP", "FULL_PITCH"),
      makeZone("half-a", "HP-A", "HALF_PITCH"),
      makeZone("half-b", "HP-B", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["HP", makeOccupancy("HP", "Hauptplatz", "FREE_NOW")],
      ["HP-A", makeOccupancy("HP-A", "Hauptplatz", "OCCUPIED_NOW", true)],
      ["HP-B", makeOccupancy("HP-B", "Hauptplatz", "FREE_NOW")],
    ]);

    const suppressed = deriveSuppressedCodes(zones, pitchMap);

    expect(suppressed.has("HP")).toBe(true);
    expect(suppressed.has("HP-A")).toBe(false);
    expect(suppressed.has("HP-B")).toBe(false);
  });

  it("both halves occupied → suppress FULL_PITCH → show A (event) + B (event)", () => {
    const zones = [
      makeZone("full", "HP", "FULL_PITCH"),
      makeZone("half-a", "HP-A", "HALF_PITCH"),
      makeZone("half-b", "HP-B", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["HP", makeOccupancy("HP", "Hauptplatz", "FREE_NOW")],
      ["HP-A", makeOccupancy("HP-A", "Hauptplatz", "OCCUPIED_NOW", true)],
      ["HP-B", makeOccupancy("HP-B", "Hauptplatz", "OCCUPIED_NOW", true)],
    ]);

    const suppressed = deriveSuppressedCodes(zones, pitchMap);

    expect(suppressed.has("HP")).toBe(true);
    expect(suppressed.has("HP-A")).toBe(false);
    expect(suppressed.has("HP-B")).toBe(false);
  });

  it("next-event on half-pitch also triggers suppression of FULL_PITCH", () => {
    const zones = [
      makeZone("full", "HP", "FULL_PITCH"),
      makeZone("half-a", "HP-A", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["HP", makeOccupancy("HP", "Hauptplatz", "FREE_NOW")],
      ["HP-A", makeOccupancy("HP-A", "Hauptplatz", "UPCOMING", false, true)],
    ]);

    const suppressed = deriveSuppressedCodes(zones, pitchMap);

    expect(suppressed.has("HP")).toBe(true);
    expect(suppressed.has("HP-A")).toBe(false);
  });

  it("FULL_PITCH + HALF_PITCH never rendered simultaneously", () => {
    const zones = [
      makeZone("full", "HP", "FULL_PITCH"),
      makeZone("half-a", "HP-A", "HALF_PITCH"),
      makeZone("half-b", "HP-B", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["HP", makeOccupancy("HP", "Hauptplatz", "OCCUPIED_NOW", true)],
      ["HP-A", makeOccupancy("HP-A", "Hauptplatz", "OCCUPIED_NOW", true)],
      ["HP-B", makeOccupancy("HP-B", "Hauptplatz", "FREE_NOW")],
    ]);

    const suppressed = deriveSuppressedCodes(zones, pitchMap);

    // Exactly one level must be suppressed per facility — never both, never neither
    const fullSuppressed = suppressed.has("HP");
    const halfASuppressed = suppressed.has("HP-A");
    const halfBSuppressed = suppressed.has("HP-B");

    // HALF_PITCH level has an occupied zone → FULL_PITCH is suppressed
    expect(fullSuppressed).toBe(true);
    // HALF_PITCH children are visible
    expect(halfASuppressed).toBe(false);
    expect(halfBSuppressed).toBe(false);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("deriveSuppressedCodes — edge cases", () => {
  it("no suppression when pitchMap is null", () => {
    const zones = [
      makeZone("full", "HP", "FULL_PITCH"),
      makeZone("half-a", "HP-A", "HALF_PITCH"),
    ];
    const suppressed = deriveSuppressedCodes(zones, null);
    expect(suppressed.size).toBe(0);
  });

  it("no suppression when pitchMap is undefined", () => {
    const zones = [makeZone("full", "HP", "FULL_PITCH"), makeZone("half-a", "HP-A", "HALF_PITCH")];
    const suppressed = deriveSuppressedCodes(zones, undefined);
    expect(suppressed.size).toBe(0);
  });

  it("no suppression for FULL_PITCH-only facility", () => {
    const zones = [makeZone("full", "KR2", "FULL_PITCH")];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["KR2", makeOccupancy("KR2", "Kunstrasen 2", "FREE_NOW")],
    ]);
    const suppressed = deriveSuppressedCodes(zones, pitchMap);
    expect(suppressed.has("KR2")).toBe(false);
  });

  it("no suppression for HALF_PITCH-only facility (no FULL_PITCH configured)", () => {
    const zones = [
      makeZone("a", "KR2-A", "HALF_PITCH"),
      makeZone("b", "KR2-B", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["KR2-A", makeOccupancy("KR2-A", "Kunstrasen 2", "FREE_NOW")],
      ["KR2-B", makeOccupancy("KR2-B", "Kunstrasen 2", "FREE_NOW")],
    ]);
    const suppressed = deriveSuppressedCodes(zones, pitchMap);
    expect(suppressed.size).toBe(0);
  });

  it("zone without resourceCode is not suppressed", () => {
    const zones: ResourceZoneElement[] = [
      { ...makeZone("full", "HP", "FULL_PITCH"), resourceCode: null },
      makeZone("half-a", "HP-A", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["HP", makeOccupancy("HP", "Hauptplatz", "FREE_NOW")],
      ["HP-A", makeOccupancy("HP-A", "Hauptplatz", "OCCUPIED_NOW", true)],
    ]);
    // Zone with null resourceCode → not in pitchMap → not grouped → not suppressed
    const suppressed = deriveSuppressedCodes(zones, pitchMap);
    expect(suppressed.has("HP-A")).toBe(false); // no full-pitch in the HP-A group
  });

  it("different facilities are suppressed independently", () => {
    // Hauptplatz: both halves free → suppress halves, show HP
    // Kunstrasen 2: half-pitch A occupied → suppress KR2 full, show KR2-A and KR2-B
    const zones = [
      makeZone("hp-full", "HP", "FULL_PITCH"),
      makeZone("hp-a", "HP-A", "HALF_PITCH"),
      makeZone("hp-b", "HP-B", "HALF_PITCH"),
      makeZone("kr2-full", "KR2", "FULL_PITCH"),
      makeZone("kr2-a", "KR2-A", "HALF_PITCH"),
      makeZone("kr2-b", "KR2-B", "HALF_PITCH"),
    ];
    const pitchMap = new Map<string, PitchOccupancy>([
      ["HP", makeOccupancy("HP", "Hauptplatz", "FREE_NOW")],
      ["HP-A", makeOccupancy("HP-A", "Hauptplatz", "FREE_NOW")],
      ["HP-B", makeOccupancy("HP-B", "Hauptplatz", "FREE_NOW")],
      ["KR2", makeOccupancy("KR2", "Kunstrasen 2", "FREE_NOW")],
      ["KR2-A", makeOccupancy("KR2-A", "Kunstrasen 2", "OCCUPIED_NOW", true)],
      ["KR2-B", makeOccupancy("KR2-B", "Kunstrasen 2", "FREE_NOW")],
    ]);

    const suppressed = deriveSuppressedCodes(zones, pitchMap);

    // Hauptplatz: all halves free → suppress halves
    expect(suppressed.has("HP")).toBe(false);
    expect(suppressed.has("HP-A")).toBe(true);
    expect(suppressed.has("HP-B")).toBe(true);

    // Kunstrasen 2: KR2-A occupied → suppress FULL_PITCH
    expect(suppressed.has("KR2")).toBe(true);
    expect(suppressed.has("KR2-A")).toBe(false);
    expect(suppressed.has("KR2-B")).toBe(false);
  });
});
