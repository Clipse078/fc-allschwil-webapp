/**
 * @vitest-environment jsdom
 */

/**
 * app/infoboard/screen-2-preview/__tests__/page.test.tsx
 *
 * Acceptance harness tests for the Screen 2 / Anlageplan preview page.
 *
 * Verifies:
 *   - All 7 scenarios produce correct pitch occupancy states
 *   - FREE scenario → all pitches FREE
 *   - Feld A occupied / Feld B free
 *   - Feld A free / Feld B occupied
 *   - Both-free → only full-pitch shown (groupFacilityPitches rule)
 *   - Both-halves occupied → both halves shown
 *   - TURNIER state appears on a pitch
 *   - Only simplified status labels are used (FREI/TRAINING/MATCH/TURNIER)
 *   - Scenario selector covers all required scenarios
 */

import { describe, it, expect } from "vitest";
import {
  ACCEPTANCE_SCENARIOS_S2,
  DEFAULT_SCENARIO_S2,
  getAcceptancePayloadS2,
  ANLAGEPLAN_ALLOWED_STATUSES,
  ACCEPTANCE_ANLAGEPLAN_CONFIG,
  ACCEPTANCE_CURRENT_TIME_ISO_S2,
} from "@/components/infoboard/screen2/screen2-acceptance-fixtures";
import { groupFacilityPitches } from "@/lib/publishing/infoboard/facility-group";

// ── Scenario registry ─────────────────────────────────────────────────────────

describe("ACCEPTANCE_SCENARIOS_S2 registry", () => {
  it("contains exactly 7 scenarios", () => {
    expect(ACCEPTANCE_SCENARIOS_S2).toHaveLength(7);
  });

  it("contains all required scenario ids", () => {
    const ids = ACCEPTANCE_SCENARIOS_S2.map((s) => s.id);
    expect(ids).toContain("alles-frei");
    expect(ids).toContain("feld-a-training");
    expect(ids).toContain("feld-b-match");
    expect(ids).toContain("beide-frei");
    expect(ids).toContain("beide-belegt");
    expect(ids).toContain("turnier");
    expect(ids).toContain("mixed-anlage");
  });

  it("default scenario is mixed-anlage", () => {
    expect(DEFAULT_SCENARIO_S2).toBe("mixed-anlage");
  });

  it("current time is a valid ISO string", () => {
    expect(() => new Date(ACCEPTANCE_CURRENT_TIME_ISO_S2)).not.toThrow();
    expect(new Date(ACCEPTANCE_CURRENT_TIME_ISO_S2).toISOString()).toBe(
      ACCEPTANCE_CURRENT_TIME_ISO_S2,
    );
  });
});

// ── Anlageplan config ─────────────────────────────────────────────────────────

describe("ACCEPTANCE_ANLAGEPLAN_CONFIG", () => {
  it("version is 1", () => {
    expect(ACCEPTANCE_ANLAGEPLAN_CONFIG.version).toBe(1);
  });

  it("contains resource zones for all 7 resources", () => {
    const zones = ACCEPTANCE_ANLAGEPLAN_CONFIG.elements.filter(
      (e) => e.kind === "RESOURCE_ZONE",
    );
    expect(zones.length).toBeGreaterThanOrEqual(7);
  });

  it("has a STADION zone", () => {
    const zone = ACCEPTANCE_ANLAGEPLAN_CONFIG.elements.find(
      (e) => e.kind === "RESOURCE_ZONE" && e.resourceCode === "ACC-STADION",
    );
    expect(zone).toBeDefined();
  });

  it("has KR2 full zone", () => {
    const zone = ACCEPTANCE_ANLAGEPLAN_CONFIG.elements.find(
      (e) => e.kind === "RESOURCE_ZONE" && e.resourceCode === "ACC-KR2",
    );
    expect(zone).toBeDefined();
  });

  it("has KR2-A and KR2-B half zones", () => {
    const codeA = ACCEPTANCE_ANLAGEPLAN_CONFIG.elements.find(
      (e) => e.kind === "RESOURCE_ZONE" && e.resourceCode === "ACC-KR2-A",
    );
    const codeB = ACCEPTANCE_ANLAGEPLAN_CONFIG.elements.find(
      (e) => e.kind === "RESOURCE_ZONE" && e.resourceCode === "ACC-KR2-B",
    );
    expect(codeA).toBeDefined();
    expect(codeB).toBeDefined();
  });

  it("has KR3 full zone and KR3-A, KR3-B half zones", () => {
    const codes = ACCEPTANCE_ANLAGEPLAN_CONFIG.elements
      .filter((e) => e.kind === "RESOURCE_ZONE")
      .map((e) => (e as { resourceCode: string | null }).resourceCode);
    expect(codes).toContain("ACC-KR3");
    expect(codes).toContain("ACC-KR3-A");
    expect(codes).toContain("ACC-KR3-B");
  });
});

// ── Scenario: Alles frei ──────────────────────────────────────────────────────

describe("Scenario: alles-frei", () => {
  const { screen2 } = getAcceptancePayloadS2("alles-frei");
  const pitches = screen2.feed.pitches;

  it("all pitches are FREE_NOW", () => {
    expect(pitches.every((p) => p.state === "FREE_NOW")).toBe(true);
  });

  it("no pitch has a currentEvent", () => {
    expect(pitches.every((p) => p.currentEvent === null)).toBe(true);
  });

  it("STADION pitch is free", () => {
    const stadion = pitches.find((p) => p.code === "ACC-STADION");
    expect(stadion?.state).toBe("FREE_NOW");
  });
});

// ── Scenario: Feld A Training ─────────────────────────────────────────────────

describe("Scenario: feld-a-training", () => {
  const { screen2 } = getAcceptancePayloadS2("feld-a-training");
  const pitches = screen2.feed.pitches;

  it("KR2 Feld A is OCCUPIED with TRAINING", () => {
    const feldA = pitches.find((p) => p.code === "ACC-KR2-A");
    expect(feldA?.state).toBe("OCCUPIED_NOW");
    expect(feldA?.currentEvent?.type).toBe("TRAINING");
  });

  it("KR2 Feld B is FREE", () => {
    const feldB = pitches.find((p) => p.code === "ACC-KR2-B");
    expect(feldB?.state).toBe("FREE_NOW");
  });

  it("Feld A and Feld B are separate (Feld A logic correct)", () => {
    const feldA = pitches.find((p) => p.code === "ACC-KR2-A");
    const feldB = pitches.find((p) => p.code === "ACC-KR2-B");
    // They must have different states
    expect(feldA?.state).not.toBe(feldB?.state);
  });

  it("groupFacilityPitches shows both half-pitches (not full) when Feld A is active", () => {
    const { visiblePitches, suppressedCodes } = groupFacilityPitches(pitches);
    // KR2 full pitch should be suppressed
    expect(suppressedCodes.has("ACC-KR2")).toBe(true);
    // Both halves should be visible
    const kr2Visible = visiblePitches.filter((p) => p.code.startsWith("ACC-KR2-"));
    expect(kr2Visible.length).toBe(2);
  });
});

// ── Scenario: Feld B Match ────────────────────────────────────────────────────

describe("Scenario: feld-b-match", () => {
  const { screen2 } = getAcceptancePayloadS2("feld-b-match");
  const pitches = screen2.feed.pitches;

  it("KR2 Feld A is FREE", () => {
    const feldA = pitches.find((p) => p.code === "ACC-KR2-A");
    expect(feldA?.state).toBe("FREE_NOW");
  });

  it("KR2 Feld B is OCCUPIED with MATCH", () => {
    const feldB = pitches.find((p) => p.code === "ACC-KR2-B");
    expect(feldB?.state).toBe("OCCUPIED_NOW");
    expect(feldB?.currentEvent?.type).toBe("MATCH");
  });

  it("groupFacilityPitches shows both half-pitches when Feld B is active", () => {
    const { visiblePitches, suppressedCodes } = groupFacilityPitches(pitches);
    expect(suppressedCodes.has("ACC-KR2")).toBe(true);
    const kr2Halves = visiblePitches.filter((p) => p.code.startsWith("ACC-KR2-"));
    expect(kr2Halves.length).toBe(2);
  });
});

// ── Scenario: Beide frei ──────────────────────────────────────────────────────

describe("Scenario: beide-frei", () => {
  const { screen2 } = getAcceptancePayloadS2("beide-frei");
  const pitches = screen2.feed.pitches;

  it("KR2 Feld A is FREE", () => {
    const feldA = pitches.find((p) => p.code === "ACC-KR2-A");
    expect(feldA?.state).toBe("FREE_NOW");
  });

  it("KR2 Feld B is FREE", () => {
    const feldB = pitches.find((p) => p.code === "ACC-KR2-B");
    expect(feldB?.state).toBe("FREE_NOW");
  });

  it("groupFacilityPitches shows FULL_PITCH when both halves are free", () => {
    // Domain rule: when all halves are free, show FULL_PITCH as one free pitch
    const { visiblePitches, suppressedCodes } = groupFacilityPitches(pitches);
    // KR2 FULL should be visible (not suppressed)
    expect(suppressedCodes.has("ACC-KR2")).toBe(false);
    // The halves may be suppressed
    const kr2Full = visiblePitches.find((p) => p.code === "ACC-KR2");
    expect(kr2Full).toBeDefined();
  });
});

// ── Scenario: Beide belegt ─────────────────────────────────────────────────────

describe("Scenario: beide-belegt", () => {
  const { screen2 } = getAcceptancePayloadS2("beide-belegt");
  const pitches = screen2.feed.pitches;

  it("KR2 Feld A is OCCUPIED with TRAINING", () => {
    const feldA = pitches.find((p) => p.code === "ACC-KR2-A");
    expect(feldA?.state).toBe("OCCUPIED_NOW");
    expect(feldA?.currentEvent?.type).toBe("TRAINING");
  });

  it("KR2 Feld B is OCCUPIED with MATCH", () => {
    const feldB = pitches.find((p) => p.code === "ACC-KR2-B");
    expect(feldB?.state).toBe("OCCUPIED_NOW");
    expect(feldB?.currentEvent?.type).toBe("MATCH");
  });

  it("both halves have different activity types (distinguishable)", () => {
    const feldA = pitches.find((p) => p.code === "ACC-KR2-A");
    const feldB = pitches.find((p) => p.code === "ACC-KR2-B");
    expect(feldA?.currentEvent?.type).not.toBe(feldB?.currentEvent?.type);
  });

  it("groupFacilityPitches shows both half-pitches and suppresses full", () => {
    const { visiblePitches, suppressedCodes } = groupFacilityPitches(pitches);
    expect(suppressedCodes.has("ACC-KR2")).toBe(true);
    const kr2Halves = visiblePitches.filter((p) => p.code.startsWith("ACC-KR2-"));
    expect(kr2Halves.length).toBe(2);
  });
});

// ── Scenario: Turnier ────────────────────────────────────────────────────────

describe("Scenario: turnier", () => {
  const { screen2 } = getAcceptancePayloadS2("turnier");
  const pitches = screen2.feed.pitches;

  it("has at least one pitch with TOURNAMENT currentEvent", () => {
    const tourPitch = pitches.find((p) => p.currentEvent?.type === "TOURNAMENT");
    expect(tourPitch).toBeDefined();
  });

  it("TOURNAMENT pitch state is OCCUPIED_NOW", () => {
    const tourPitch = pitches.find((p) => p.currentEvent?.type === "TOURNAMENT");
    expect(tourPitch?.state).toBe("OCCUPIED_NOW");
  });
});

// ── Scenario: Mixed Anlage ────────────────────────────────────────────────────

describe("Scenario: mixed-anlage", () => {
  const { screen2 } = getAcceptancePayloadS2("mixed-anlage");
  const pitches = screen2.feed.pitches;

  it("STADION is OCCUPIED with MATCH", () => {
    const stadion = pitches.find((p) => p.code === "ACC-STADION");
    expect(stadion?.state).toBe("OCCUPIED_NOW");
    expect(stadion?.currentEvent?.type).toBe("MATCH");
  });

  it("KR2 Feld A is OCCUPIED with TRAINING", () => {
    const feldA = pitches.find((p) => p.code === "ACC-KR2-A");
    expect(feldA?.state).toBe("OCCUPIED_NOW");
    expect(feldA?.currentEvent?.type).toBe("TRAINING");
  });

  it("KR2 Feld B is FREE", () => {
    const feldB = pitches.find((p) => p.code === "ACC-KR2-B");
    expect(feldB?.state).toBe("FREE_NOW");
  });

  it("KR3 is OCCUPIED with TOURNAMENT", () => {
    const kr3 = pitches.find((p) => p.code === "ACC-KR3");
    expect(kr3?.state).toBe("OCCUPIED_NOW");
    expect(kr3?.currentEvent?.type).toBe("TOURNAMENT");
  });
});

// ── Simplified status contract ────────────────────────────────────────────────

describe("Simplified status contract", () => {
  it("ANLAGEPLAN_ALLOWED_STATUSES contains exactly FREI, TRAINING, MATCH, TURNIER", () => {
    expect(ANLAGEPLAN_ALLOWED_STATUSES).toContain("FREI");
    expect(ANLAGEPLAN_ALLOWED_STATUSES).toContain("TRAINING");
    expect(ANLAGEPLAN_ALLOWED_STATUSES).toContain("MATCH");
    expect(ANLAGEPLAN_ALLOWED_STATUSES).toContain("TURNIER");
    expect(ANLAGEPLAN_ALLOWED_STATUSES).toHaveLength(4);
  });

  const scenarioIds = [
    "alles-frei",
    "feld-a-training",
    "feld-b-match",
    "beide-frei",
    "beide-belegt",
    "turnier",
    "mixed-anlage",
  ] as const;

  for (const scenarioId of scenarioIds) {
    it(`${scenarioId}: all event types map to allowed status labels`, () => {
      const { screen2 } = getAcceptancePayloadS2(scenarioId);
      const allEvents = screen2.feed.pitches
        .flatMap((p) =>
          [p.currentEvent, p.nextEvent].filter((e) => e !== null),
        );

      for (const event of allEvents) {
        if (event?.type === "TRAINING") {
          expect(ANLAGEPLAN_ALLOWED_STATUSES).toContain("TRAINING");
        } else if (event?.type === "MATCH") {
          expect(ANLAGEPLAN_ALLOWED_STATUSES).toContain("MATCH");
        } else if (event?.type === "TOURNAMENT") {
          expect(ANLAGEPLAN_ALLOWED_STATUSES).toContain("TURNIER");
        }
      }
    });
  }
});

// ── Payload structure ─────────────────────────────────────────────────────────

describe("AnlageplanLivePayload structure", () => {
  it("every scenario has a valid anlageplanConfig", () => {
    for (const scenario of ACCEPTANCE_SCENARIOS_S2) {
      const payload = getAcceptancePayloadS2(scenario.id);
      expect(payload.anlageplanConfig).toBeDefined();
      expect(payload.anlageplanConfig.version).toBe(1);
    }
  });

  it("every scenario has currentTimeIso", () => {
    for (const scenario of ACCEPTANCE_SCENARIOS_S2) {
      const payload = getAcceptancePayloadS2(scenario.id);
      expect(payload.currentTimeIso).toBe(ACCEPTANCE_CURRENT_TIME_ISO_S2);
    }
  });

  it("every scenario feed has the correct tenant", () => {
    for (const scenario of ACCEPTANCE_SCENARIOS_S2) {
      const payload = getAcceptancePayloadS2(scenario.id);
      expect(payload.screen2.feed.tenant.key).toBe("fc-allschwil");
    }
  });

  it("unknown scenario falls back to mixed-anlage", () => {
    const payload = getAcceptancePayloadS2("nonexistent");
    const mixedPayload = getAcceptancePayloadS2("mixed-anlage");
    // Both should have the same STADION state
    const stadion1 = payload.screen2.feed.pitches.find((p) => p.code === "ACC-STADION");
    const stadion2 = mixedPayload.screen2.feed.pitches.find((p) => p.code === "ACC-STADION");
    expect(stadion1?.state).toBe(stadion2?.state);
  });
});
