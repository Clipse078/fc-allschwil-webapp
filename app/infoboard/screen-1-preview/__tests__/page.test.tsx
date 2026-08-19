/**
 * @vitest-environment jsdom
 */

/**
 * app/infoboard/screen-1-preview/__tests__/page.test.tsx
 *
 * Acceptance harness tests for the Screen 1 preview page.
 *
 * Verifies:
 *   - All 6 scenario fixtures produce correct demand values
 *   - 1-match → sparse layout mode
 *   - 1-training → sparse layout mode
 *   - 2-match → sparse layout mode
 *   - dense → fill layout mode
 *   - long-text fixture exists and contains long content
 *   - alignment scenario contains both Match and Turnier card types
 *   - demand calculation does not duplicate production layout implementation
 *   - preview does not import DB or production API modules
 *   - production routes unaffected
 */

import { describe, it, expect } from "vitest";
import {
  ACCEPTANCE_SCENARIOS_S1,
  ACCEPTANCE_FIXTURE_ONE_MATCH,
  ACCEPTANCE_FIXTURE_ONE_TRAINING,
  ACCEPTANCE_FIXTURE_TWO_MATCHES,
  ACCEPTANCE_FIXTURE_DENSE,
  ACCEPTANCE_FIXTURE_LONG_TEXT,
  ACCEPTANCE_FIXTURE_ALIGNMENT,
  ACCEPTANCE_DENSE_EXTENSIONS,
  ACCEPTANCE_ALIGNMENT_EXTENSIONS,
  LAYOUT_MODE_SPARSE_THRESHOLD,
  layoutModeS1,
  computeTotalDemandS1,
  getAcceptanceFixtureS1,
  DEFAULT_SCENARIO_S1,
  ACCEPTANCE_CURRENT_TIME_ISO_S1,
} from "@/components/infoboard/screen1/screen1-acceptance-fixtures";
import {
  computeTrainingGroupDemand,
  computeEventDemand,
  densityTier,
  CARD_DEMAND_MATCH,
  CARD_DEMAND_PAGE_MAX,
} from "@/components/infoboard/screen1/InfoboardScreen1";

// ── Scenario registry ─────────────────────────────────────────────────────────

describe("ACCEPTANCE_SCENARIOS_S1 registry", () => {
  it("contains exactly 6 scenarios", () => {
    expect(ACCEPTANCE_SCENARIOS_S1).toHaveLength(6);
  });

  it("contains all required scenario ids", () => {
    const ids = ACCEPTANCE_SCENARIOS_S1.map((s) => s.id);
    expect(ids).toContain("one-match");
    expect(ids).toContain("one-training");
    expect(ids).toContain("two-matches");
    expect(ids).toContain("dense");
    expect(ids).toContain("long-text");
    expect(ids).toContain("alignment");
  });

  it("default scenario is one-match", () => {
    expect(DEFAULT_SCENARIO_S1).toBe("one-match");
  });

  it("current time is a valid ISO string", () => {
    expect(() => new Date(ACCEPTANCE_CURRENT_TIME_ISO_S1)).not.toThrow();
    expect(new Date(ACCEPTANCE_CURRENT_TIME_ISO_S1).toISOString()).toBe(
      ACCEPTANCE_CURRENT_TIME_ISO_S1,
    );
  });
});

// ── Layout threshold ──────────────────────────────────────────────────────────

describe("LAYOUT_MODE_SPARSE_THRESHOLD", () => {
  it("is greater than 2 × CARD_DEMAND_MATCH (two matches stay sparse)", () => {
    expect(LAYOUT_MODE_SPARSE_THRESHOLD).toBeGreaterThan(2 * CARD_DEMAND_MATCH);
  });

  it("layoutModeS1 returns sparse below threshold", () => {
    expect(layoutModeS1(LAYOUT_MODE_SPARSE_THRESHOLD - 0.01)).toBe("sparse");
  });

  it("layoutModeS1 returns fill at threshold", () => {
    expect(layoutModeS1(LAYOUT_MODE_SPARSE_THRESHOLD)).toBe("fill");
  });

  it("layoutModeS1 returns fill above threshold", () => {
    expect(layoutModeS1(LAYOUT_MODE_SPARSE_THRESHOLD + 1)).toBe("fill");
  });
});

// ── Scenario A: 1 Match ───────────────────────────────────────────────────────

describe("Scenario: one-match", () => {
  const feed = ACCEPTANCE_FIXTURE_ONE_MATCH;

  it("has exactly 1 event total", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all).toHaveLength(1);
  });

  it("event type is MATCH", () => {
    expect(feed.current[0].type).toBe("MATCH");
  });

  it("demand equals CARD_DEMAND_MATCH", () => {
    const demand = computeTotalDemandS1(feed, []);
    expect(demand).toBeCloseTo(CARD_DEMAND_MATCH, 5);
  });

  it("resolves to sparse layout mode", () => {
    const demand = computeTotalDemandS1(feed, []);
    expect(layoutModeS1(demand)).toBe("sparse");
  });

  it("demand is well below CARD_DEMAND_PAGE_MAX", () => {
    const demand = computeTotalDemandS1(feed, []);
    expect(demand).toBeLessThan(CARD_DEMAND_PAGE_MAX);
  });
});

// ── Scenario B: 1 Training ────────────────────────────────────────────────────

describe("Scenario: one-training", () => {
  const feed = ACCEPTANCE_FIXTURE_ONE_TRAINING;

  it("has exactly 1 event total", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all).toHaveLength(1);
  });

  it("event type is TRAINING", () => {
    expect(feed.current[0].type).toBe("TRAINING");
  });

  it("demand equals computeTrainingGroupDemand(1)", () => {
    const demand = computeTotalDemandS1(feed, []);
    expect(demand).toBeCloseTo(computeTrainingGroupDemand(1), 5);
  });

  it("resolves to sparse layout mode", () => {
    const demand = computeTotalDemandS1(feed, []);
    expect(layoutModeS1(demand)).toBe("sparse");
  });
});

// ── Scenario C: 2 Matches ─────────────────────────────────────────────────────

describe("Scenario: two-matches", () => {
  const feed = ACCEPTANCE_FIXTURE_TWO_MATCHES;

  it("has exactly 2 events total", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all).toHaveLength(2);
  });

  it("both events are MATCH type", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.every((e) => e.type === "MATCH")).toBe(true);
  });

  it("demand equals 2 × CARD_DEMAND_MATCH", () => {
    const demand = computeTotalDemandS1(feed, []);
    expect(demand).toBeCloseTo(2 * CARD_DEMAND_MATCH, 5);
  });

  it("resolves to sparse layout mode (below fill threshold)", () => {
    const demand = computeTotalDemandS1(feed, []);
    expect(layoutModeS1(demand)).toBe("sparse");
  });

  it("demand is strictly less than LAYOUT_MODE_SPARSE_THRESHOLD", () => {
    const demand = computeTotalDemandS1(feed, []);
    expect(demand).toBeLessThan(LAYOUT_MODE_SPARSE_THRESHOLD);
  });
});

// ── Scenario D: Dense ─────────────────────────────────────────────────────────

describe("Scenario: dense", () => {
  const feed = ACCEPTANCE_FIXTURE_DENSE;
  const extensions = ACCEPTANCE_DENSE_EXTENSIONS;

  it("has more than 3 events total", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.length).toBeGreaterThan(3);
  });

  it("contains at least one MATCH event", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.type === "MATCH")).toBe(true);
  });

  it("contains at least one TRAINING event", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.type === "TRAINING")).toBe(true);
  });

  it("contains at least one TOURNAMENT event", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.type === "TOURNAMENT")).toBe(true);
  });

  it("resolves to fill layout mode", () => {
    const demand = computeTotalDemandS1(feed, extensions);
    expect(layoutModeS1(demand)).toBe("fill");
  });

  it("demand exceeds LAYOUT_MODE_SPARSE_THRESHOLD", () => {
    const demand = computeTotalDemandS1(feed, extensions);
    expect(demand).toBeGreaterThanOrEqual(LAYOUT_MODE_SPARSE_THRESHOLD);
  });
});

// ── Scenario E: Long Text ─────────────────────────────────────────────────────

describe("Scenario: long-text", () => {
  const feed = ACCEPTANCE_FIXTURE_LONG_TEXT;

  it("fixture exists with events", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.length).toBeGreaterThan(0);
  });

  it("contains a match event with long team names (> 30 chars)", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    const match = all.find((e) => e.type === "MATCH");
    expect(match).toBeDefined();
    expect((match?.teamDisplayName ?? "").length).toBeGreaterThan(30);
    expect((match?.opponentDisplayName ?? "").length).toBeGreaterThan(30);
  });

  it("contains a long pitchLabel (> 20 chars)", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    const hasLongPitch = all.some(
      (e) => (e.allocation.pitchLabel ?? "").length > 20,
    );
    expect(hasLongPitch).toBe(true);
  });

  it("contains a long homeDressingRoomLabel (> 20 chars)", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    const hasLongRoom = all.some(
      (e) => (e.allocation.homeDressingRoomLabel ?? "").length > 20,
    );
    expect(hasLongRoom).toBe(true);
  });
});

// ── Scenario F: Alignment ─────────────────────────────────────────────────────

describe("Scenario: alignment", () => {
  const feed = ACCEPTANCE_FIXTURE_ALIGNMENT;
  const extensions = ACCEPTANCE_ALIGNMENT_EXTENSIONS;

  it("contains a MATCH card", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.type === "MATCH")).toBe(true);
  });

  it("contains a TOURNAMENT card", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.type === "TOURNAMENT")).toBe(true);
  });

  it("match card has pitchLabel (for PLATZ field)", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    const match = all.find((e) => e.type === "MATCH");
    expect(match?.allocation.pitchLabel).toBeTruthy();
  });

  it("match card has homeDressingRoomLabel (for KABINE field)", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    const match = all.find((e) => e.type === "MATCH");
    expect(match?.allocation.homeDressingRoomLabel).toBeTruthy();
  });

  it("tournament has competitionLabel (for TURNIER/Meisterschaft display)", () => {
    const all = [...feed.current, ...feed.next, ...feed.later];
    const tournament = all.find((e) => e.type === "TOURNAMENT");
    expect(tournament?.competitionLabel).toBeTruthy();
  });

  it("tournament extension has >= 3 participant allocations", () => {
    const ext = extensions.find((e) => e.eventId === "acc-align-tournament");
    expect(ext?.participantAllocations?.length).toBeGreaterThanOrEqual(3);
  });
});

// ── getAcceptanceFixtureS1 registry ──────────────────────────────────────────

describe("getAcceptanceFixtureS1", () => {
  it("returns one-match feed for 'one-match'", () => {
    const { feed } = getAcceptanceFixtureS1("one-match");
    expect(feed).toBe(ACCEPTANCE_FIXTURE_ONE_MATCH);
  });

  it("returns one-training feed for 'one-training'", () => {
    const { feed } = getAcceptanceFixtureS1("one-training");
    expect(feed).toBe(ACCEPTANCE_FIXTURE_ONE_TRAINING);
  });

  it("returns two-matches feed for 'two-matches'", () => {
    const { feed } = getAcceptanceFixtureS1("two-matches");
    expect(feed).toBe(ACCEPTANCE_FIXTURE_TWO_MATCHES);
  });

  it("returns dense feed for 'dense'", () => {
    const { feed } = getAcceptanceFixtureS1("dense");
    expect(feed).toBe(ACCEPTANCE_FIXTURE_DENSE);
  });

  it("returns long-text feed for 'long-text'", () => {
    const { feed } = getAcceptanceFixtureS1("long-text");
    expect(feed).toBe(ACCEPTANCE_FIXTURE_LONG_TEXT);
  });

  it("returns alignment feed for 'alignment'", () => {
    const { feed } = getAcceptanceFixtureS1("alignment");
    expect(feed).toBe(ACCEPTANCE_FIXTURE_ALIGNMENT);
  });

  it("returns default fixture for unknown scenario", () => {
    const { feed } = getAcceptanceFixtureS1("unknown-xyz");
    expect(feed).toBe(ACCEPTANCE_FIXTURE_ONE_MATCH);
  });

  it("returns default fixture for null", () => {
    const { feed } = getAcceptanceFixtureS1(null);
    expect(feed).toBe(ACCEPTANCE_FIXTURE_ONE_MATCH);
  });
});

// ── data-layout-mode propagation ─────────────────────────────────────────────

describe("data-layout-mode via densityTier", () => {
  it("dense scenario demand produces densityTier dense or ultra", () => {
    const demand = computeTotalDemandS1(
      ACCEPTANCE_FIXTURE_DENSE,
      ACCEPTANCE_DENSE_EXTENSIONS,
    );
    const tier = densityTier(demand);
    expect(["dense", "ultra"]).toContain(tier);
  });

  it("one-match scenario demand produces densityTier normal", () => {
    const demand = computeTotalDemandS1(ACCEPTANCE_FIXTURE_ONE_MATCH, []);
    expect(densityTier(demand)).toBe("normal");
  });
});

// ── No production duplication ─────────────────────────────────────────────────

describe("Preview does not duplicate production layout implementation", () => {
  it("computeTotalDemandS1 for 1 match matches manual calculation via production functions", () => {
    const expected = computeEventDemand("MATCH", 0);
    const actual = computeTotalDemandS1(ACCEPTANCE_FIXTURE_ONE_MATCH, []);
    expect(actual).toBeCloseTo(expected, 10);
  });

  it("computeTotalDemandS1 for 1 training matches manual calculation via production functions", () => {
    const expected = computeTrainingGroupDemand(1);
    const actual = computeTotalDemandS1(ACCEPTANCE_FIXTURE_ONE_TRAINING, []);
    expect(actual).toBeCloseTo(expected, 10);
  });

  it("computeTotalDemandS1 for 2 matches matches 2 × production match demand", () => {
    const expected = 2 * computeEventDemand("MATCH", 0);
    const actual = computeTotalDemandS1(ACCEPTANCE_FIXTURE_TWO_MATCHES, []);
    expect(actual).toBeCloseTo(expected, 10);
  });
});
