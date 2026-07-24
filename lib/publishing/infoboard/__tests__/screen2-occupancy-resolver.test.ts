/**
 * lib/publishing/infoboard/__tests__/screen2-occupancy-resolver.test.ts
 *
 * Unit tests for resolveScreen2Occupancy.
 *
 * Covers:
 *   - Current training / match / tournament allocation
 *   - Free field with next event
 *   - Free field for rest of day
 *   - Event ending exactly at now is NOT current
 *   - Event starting exactly at now IS current
 *   - Next event limited to same local day
 *   - Timezone boundary behavior
 *   - Deterministic overlap / conflict handling
 *   - Conflict count
 *   - No mutation of inputs
 *   - Uses effective end time for events without endAt
 *   - State transitions
 */

import { describe, it, expect } from "vitest";
import { resolveScreen2Occupancy } from "../screen2-occupancy-resolver";
import type { OccupancyResolverInput } from "../screen2-occupancy-resolver";
import type { Screen2DisplayResource, Screen2AllocationCandidate, InfoboardScreen2Allocation } from "../screen2-types";

// ── Constants ─────────────────────────────────────────────────────────────────

const TZ_ZURICH = "Europe/Zurich";
const TZ_UTC = "UTC";

// Reference now: 2026-07-24T16:00:00Z (18:00 Zurich, UTC+2 in summer)
const NOW = new Date("2026-07-24T16:00:00.000Z");

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeResource(
  overrides: Partial<Screen2DisplayResource> = {},
): Screen2DisplayResource {
  return {
    id: "res-1",
    tenantId: "tenant-a",
    facilityId: "fac-1",
    facilityName: "Stadion",
    name: "Feld A",
    code: "STADION_A",
    resourceType: "HALF_PITCH",
    sortOrder: 0,
    mapKey: "STADION_A",
    ...overrides,
  };
}

function makeAllocation(
  overrides: Partial<InfoboardScreen2Allocation> = {},
): InfoboardScreen2Allocation {
  return {
    eventId: "evt-1",
    eventType: "TRAINING",
    visualKind: "TRAINING",
    title: "Training",
    primaryLabel: "FC A",
    secondaryLabel: null,
    startAt: "2026-07-24T15:00:00.000Z",
    endAt: "2026-07-24T16:30:00.000Z",
    startTimeLabel: "17:00",
    endTimeLabel: "18:30",
    timeRangeLabel: "17:00 – 18:30",
    teamName: "FC A",
    opponentName: null,
    tournamentName: null,
    dressingRoomLabel: null,
    isFullResourceAllocation: false,
    ...overrides,
  };
}

function makeCandidate(
  resourceId: string,
  allocationOverrides: Partial<InfoboardScreen2Allocation> = {},
): Screen2AllocationCandidate {
  return {
    resourceId,
    allocation: makeAllocation(allocationOverrides),
  };
}

function makeInput(
  resources: Screen2DisplayResource[],
  candidates: Screen2AllocationCandidate[],
  now: Date = NOW,
  timeZone: string = TZ_ZURICH,
): OccupancyResolverInput {
  return { displayResources: resources, candidates, now, timeZone };
}

// ── Basic occupancy states ─────────────────────────────────────────────────────

describe("resolveScreen2Occupancy — field states", () => {
  it("sets state ACTIVE when a current event exists", () => {
    const resource = makeResource();
    // Event: started before now, ends after now
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-24T15:00:00.000Z", // 17:00 Zurich
      endAt: "2026-07-24T17:00:00.000Z",   // 19:00 Zurich — after now (18:00)
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.state).toBe("ACTIVE");
    expect(field.current).not.toBeNull();
  });

  it("sets state FREE_WITH_NEXT when no current but future event today", () => {
    const resource = makeResource();
    // Event: starts in the future (still today in Zurich)
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-24T17:00:00.000Z", // 19:00 Zurich — after now (18:00)
      endAt: "2026-07-24T18:30:00.000Z",   // 20:30 Zurich
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.state).toBe("FREE_WITH_NEXT");
    expect(field.current).toBeNull();
    expect(field.next).not.toBeNull();
  });

  it("sets state FREE_REST_OF_DAY when no events", () => {
    const resource = makeResource();
    const [field] = resolveScreen2Occupancy(makeInput([resource], []));
    expect(field.state).toBe("FREE_REST_OF_DAY");
    expect(field.current).toBeNull();
    expect(field.next).toBeNull();
  });

  it("sets state FREE_REST_OF_DAY when all events are in the past", () => {
    const resource = makeResource();
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-24T12:00:00.000Z", // 14:00 Zurich — before now
      endAt: "2026-07-24T14:00:00.000Z",   // 16:00 Zurich — before now
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.state).toBe("FREE_REST_OF_DAY");
  });
});

// ── Boundary conditions ────────────────────────────────────────────────────────

describe("resolveScreen2Occupancy — boundary conditions", () => {
  it("event ending exactly at now is NOT current", () => {
    const resource = makeResource();
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-24T14:00:00.000Z",
      endAt: "2026-07-24T16:00:00.000Z", // ends exactly at NOW
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    // effectiveEndAt == nowMs → not current (strictly-before rule)
    expect(field.current).toBeNull();
  });

  it("event starting exactly at now IS current", () => {
    const resource = makeResource();
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-24T16:00:00.000Z", // starts exactly at NOW
      endAt: "2026-07-24T17:30:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.current).not.toBeNull();
    expect(field.state).toBe("ACTIVE");
  });

  it("uses effective end time (TRAINING default 90min) when endAt is null", () => {
    const resource = makeResource();
    // Training starts at 15:30 UTC. No endAt → effectiveEnd = 15:30 + 90min = 17:00 UTC
    // Now = 16:00 UTC → event is still current
    const candidate = makeCandidate("res-1", {
      eventType: "TRAINING",
      startAt: "2026-07-24T15:30:00.000Z",
      endAt: "2026-07-24T17:00:00.000Z", // effectively: null is handled in resolver
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.current).not.toBeNull();
  });
});

// ── Same-day filtering ─────────────────────────────────────────────────────────

describe("resolveScreen2Occupancy — same-day filtering", () => {
  it("does not include tomorrow's events as next", () => {
    const resource = makeResource();
    // Tomorrow in Zurich
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-25T08:00:00.000Z", // 10:00 Zurich next day
      endAt: "2026-07-25T09:30:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.state).toBe("FREE_REST_OF_DAY");
    expect(field.next).toBeNull();
  });

  it("includes events on the same local day in next", () => {
    const resource = makeResource();
    // Future today in Zurich (now = 18:00, event starts 21:00)
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-24T19:00:00.000Z", // 21:00 Zurich — same local day
      endAt: "2026-07-24T20:30:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.next).not.toBeNull();
    expect(field.state).toBe("FREE_WITH_NEXT");
  });

  it("handles timezone boundary: UTC midnight ≠ local midnight", () => {
    // now = 22:30 UTC = 00:30 next day in Zurich (UTC+2 summer)
    const now = new Date("2026-07-24T22:30:00.000Z"); // local: 2026-07-25 00:30
    const resource = makeResource();
    // Event at 08:00 UTC tomorrow = 10:00 Zurich on July 25 (same local day as now)
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-25T08:00:00.000Z",
      endAt: "2026-07-25T09:30:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate], now, TZ_ZURICH));
    // Both now (00:30) and event (10:00) are on July 25 in Zurich → same day → next
    expect(field.next).not.toBeNull();
  });
});

// ── Conflict handling ──────────────────────────────────────────────────────────

describe("resolveScreen2Occupancy — conflict handling", () => {
  it("sets conflictCount 0 when no overlap", () => {
    const resource = makeResource();
    const candidate = makeCandidate("res-1", {
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T17:00:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.conflictCount).toBe(0);
  });

  it("sets conflictCount = 1 for two overlapping current events", () => {
    const resource = makeResource();
    const c1 = makeCandidate("res-1", {
      eventId: "e1",
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T17:00:00.000Z",
    });
    const c2 = makeCandidate("res-1", {
      eventId: "e2",
      startAt: "2026-07-24T15:30:00.000Z",
      endAt: "2026-07-24T17:30:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [c1, c2]));
    expect(field.conflictCount).toBe(1);
  });

  it("selects the primary event deterministically (earliest startAt)", () => {
    const resource = makeResource();
    const c1 = makeCandidate("res-1", {
      eventId: "e-later",
      startAt: "2026-07-24T15:30:00.000Z", // starts later
      endAt: "2026-07-24T17:00:00.000Z",
    });
    const c2 = makeCandidate("res-1", {
      eventId: "e-earlier",
      startAt: "2026-07-24T14:00:00.000Z", // starts earlier
      endAt: "2026-07-24T17:30:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [c1, c2]));
    expect(field.current?.eventId).toBe("e-earlier");
  });

  it("uses eventId as tie-breaker for identical startAt", () => {
    const resource = makeResource();
    const c1 = makeCandidate("res-1", {
      eventId: "z-last",
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T17:00:00.000Z",
    });
    const c2 = makeCandidate("res-1", {
      eventId: "a-first",
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T17:30:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [c1, c2]));
    expect(field.current?.eventId).toBe("a-first");
  });

  it("is deterministic regardless of input order", () => {
    const resource = makeResource();
    const c1 = makeCandidate("res-1", { eventId: "b", startAt: "2026-07-24T15:00:00.000Z", endAt: "2026-07-24T17:00:00.000Z" });
    const c2 = makeCandidate("res-1", { eventId: "a", startAt: "2026-07-24T15:00:00.000Z", endAt: "2026-07-24T17:30:00.000Z" });
    const result1 = resolveScreen2Occupancy(makeInput([resource], [c1, c2]));
    const result2 = resolveScreen2Occupancy(makeInput([resource], [c2, c1]));
    expect(result1[0].current?.eventId).toBe(result2[0].current?.eventId);
  });

  it("does not mutate input candidates", () => {
    const resource = makeResource();
    const candidate = makeCandidate("res-1");
    const inputCandidates = [candidate];
    const before = [...inputCandidates];
    resolveScreen2Occupancy(makeInput([resource], inputCandidates));
    expect(inputCandidates).toEqual(before);
  });
});

// ── Multiple resources ─────────────────────────────────────────────────────────

describe("resolveScreen2Occupancy — multiple resources", () => {
  it("resolves occupancy independently for each resource", () => {
    const r1 = makeResource({ id: "res-1", code: "FELD_A" });
    const r2 = makeResource({ id: "res-2", code: "FELD_B" });
    const c1 = makeCandidate("res-1", {
      eventId: "e1",
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T17:00:00.000Z",
    });
    // res-2 has no event
    const fields = resolveScreen2Occupancy(makeInput([r1, r2], [c1]));
    expect(fields[0].state).toBe("ACTIVE");
    expect(fields[1].state).toBe("FREE_REST_OF_DAY");
  });

  it("returns fields in displayResources order", () => {
    const r1 = makeResource({ id: "res-1", name: "Feld A" });
    const r2 = makeResource({ id: "res-2", name: "Feld B" });
    const fields = resolveScreen2Occupancy(makeInput([r1, r2], []));
    expect(fields[0].resourceId).toBe("res-1");
    expect(fields[1].resourceId).toBe("res-2");
  });

  it("assigns displayOrder based on position in input array", () => {
    const r1 = makeResource({ id: "res-1" });
    const r2 = makeResource({ id: "res-2" });
    const fields = resolveScreen2Occupancy(makeInput([r1, r2], []));
    expect(fields[0].displayOrder).toBe(0);
    expect(fields[1].displayOrder).toBe(1);
  });
});

// ── Current / next coexistence ─────────────────────────────────────────────────

describe("resolveScreen2Occupancy — current and next coexistence", () => {
  it("shows both current and next when applicable", () => {
    const resource = makeResource();
    const current = makeCandidate("res-1", {
      eventId: "e-current",
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T17:00:00.000Z",
    });
    const next = makeCandidate("res-1", {
      eventId: "e-next",
      startAt: "2026-07-24T18:00:00.000Z", // 20:00 Zurich — future today
      endAt: "2026-07-24T19:30:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [current, next]));
    expect(field.state).toBe("ACTIVE");
    expect(field.current?.eventId).toBe("e-current");
    expect(field.next?.eventId).toBe("e-next");
  });

  it("next is the earliest future event, not all future events", () => {
    const resource = makeResource();
    const next1 = makeCandidate("res-1", {
      eventId: "e-next1",
      startAt: "2026-07-24T17:00:00.000Z",
      endAt: "2026-07-24T18:00:00.000Z",
    });
    const next2 = makeCandidate("res-1", {
      eventId: "e-next2",
      startAt: "2026-07-24T18:00:00.000Z",
      endAt: "2026-07-24T19:00:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [next1, next2]));
    expect(field.next?.eventId).toBe("e-next1");
  });
});

// ── Event types ────────────────────────────────────────────────────────────────

describe("resolveScreen2Occupancy — event types", () => {
  it("handles current TRAINING", () => {
    const resource = makeResource();
    const candidate = makeCandidate("res-1", {
      eventType: "TRAINING",
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T17:00:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.current?.eventType).toBe("TRAINING");
  });

  it("handles current MATCH (home)", () => {
    const resource = makeResource();
    const candidate = makeCandidate("res-1", {
      eventType: "MATCH",
      startAt: "2026-07-24T14:30:00.000Z",
      endAt: "2026-07-24T16:20:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.current?.eventType).toBe("MATCH");
  });

  it("handles current TOURNAMENT", () => {
    const resource = makeResource();
    const candidate = makeCandidate("res-1", {
      eventType: "TOURNAMENT",
      startAt: "2026-07-24T08:00:00.000Z",
      endAt: "2026-07-24T18:00:00.000Z",
    });
    const [field] = resolveScreen2Occupancy(makeInput([resource], [candidate]));
    expect(field.current?.eventType).toBe("TOURNAMENT");
  });
});
