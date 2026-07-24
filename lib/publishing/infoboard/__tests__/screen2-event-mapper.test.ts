/**
 * lib/publishing/infoboard/__tests__/screen2-event-mapper.test.ts
 *
 * Unit tests for the Screen 2 event mapper.
 *
 * Covers:
 *   - Training labels (team name as primaryLabel, null secondaryLabel)
 *   - Match labels (team name, opponent name)
 *   - Tournament labels (competition/organizer as primaryLabel)
 *   - Team/opponent name resolution
 *   - Dressing-room label resolution
 *   - Timezone-aware time labels
 *   - HALF_PITCH direct assignment
 *   - FULL_PITCH expansion to sibling HALF_PITCH resources
 *   - FULL_PITCH with no children → direct assignment
 *   - Unrecognized pitchCode → empty candidates (unassigned)
 *   - Null pitchCode → empty candidates
 *   - Deduplication of (resourceId, eventId) pairs
 *   - Source event is not mutated
 *   - isFullResourceAllocation flag
 */

import { describe, it, expect } from "vitest";
import { mapScreen2Event, mapAllScreen2Events } from "../screen2-event-mapper";
import type { MapScreen2EventInput } from "../screen2-event-mapper";
import type { Screen2SourceEvent, Screen2DisplayResource } from "../screen2-types";
import { normalizeScreen2Resources } from "../screen2-resource-normalizer";
import type { Screen2FacilityResourceRow } from "../screen2-resource-normalizer";

// ── Constants ─────────────────────────────────────────────────────────────────

const TZ_ZURICH = "Europe/Zurich";
const TENANT_ID = "tenant-fca";

// ── Resource fixtures ─────────────────────────────────────────────────────────

const RAW_RESOURCES: Screen2FacilityResourceRow[] = [
  // Stadion: one FULL_PITCH + two HALF_PITCH sub-fields
  {
    id: "full-stadion", tenantId: TENANT_ID, facilityId: "fac-stadion",
    name: "Stadion (gesamt)", code: "STADION", type: "FULL_PITCH", status: "ACTIVE", sortOrder: 0,
    facility: { id: "fac-stadion", name: "Stadion" },
  },
  {
    id: "half-stadion-a", tenantId: TENANT_ID, facilityId: "fac-stadion",
    name: "Feld A", code: "STADION_A", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 10,
    facility: { id: "fac-stadion", name: "Stadion" },
  },
  {
    id: "half-stadion-b", tenantId: TENANT_ID, facilityId: "fac-stadion",
    name: "Feld B", code: "STADION_B", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 20,
    facility: { id: "fac-stadion", name: "Stadion" },
  },
  // KR2: FULL_PITCH only (no HALF_PITCH children)
  {
    id: "full-kr2", tenantId: TENANT_ID, facilityId: "fac-kr2",
    name: "KR 2 (gesamt)", code: "KUNSTRASEN_2", type: "FULL_PITCH", status: "ACTIVE", sortOrder: 30,
    facility: { id: "fac-kr2", name: "KR 2" },
  },
  // Dressing room (must be excluded by normalizer)
  {
    id: "dr-e1", tenantId: TENANT_ID, facilityId: "fac-stadion",
    name: "E1", code: "E1", type: "DRESSING_ROOM", status: "ACTIVE", sortOrder: 0,
    facility: { id: "fac-stadion", name: "Stadion" },
  },
];

const DISPLAY_RESOURCES: Screen2DisplayResource[] = normalizeScreen2Resources(RAW_RESOURCES);

// code → name for ALL resources (including dressing rooms)
const RESOURCE_NAME_BY_CODE = new Map<string, string>([
  ["STADION", "Stadion (gesamt)"],
  ["STADION_A", "Feld A"],
  ["STADION_B", "Feld B"],
  ["KUNSTRASEN_2", "KR 2 (gesamt)"],
  ["E1", "E1"],
]);

const MAPPER_INPUT: MapScreen2EventInput = {
  displayResources: DISPLAY_RESOURCES,
  timeZone: TZ_ZURICH,
  resourceNameByCode: RESOURCE_NAME_BY_CODE,
};

// ── Event factory ─────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<Screen2SourceEvent> = {}): Screen2SourceEvent {
  return {
    id: "evt-1",
    tenantId: TENANT_ID,
    type: "TRAINING",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    startAt: new Date("2026-07-24T17:00:00.000Z"),
    endAt: new Date("2026-07-24T18:30:00.000Z"),
    sortOrder: 0,
    title: "Training U17",
    pitchCode: "STADION_A",
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    ...overrides,
  };
}

// ── Training labels ────────────────────────────────────────────────────────────

describe("mapScreen2Event — TRAINING labels", () => {
  it("uses team displayName as primaryLabel", () => {
    const event = makeEvent({
      type: "TRAINING",
      team: { name: "U17", displayName: "FC A U17", shortName: null },
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.primaryLabel).toBe("FC A U17");
  });

  it("falls back to team.name when displayName is absent", () => {
    const event = makeEvent({
      type: "TRAINING",
      team: { name: "U17", displayName: null, shortName: null },
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.primaryLabel).toBe("U17");
  });

  it("falls back to event title when team is absent", () => {
    const event = makeEvent({ type: "TRAINING", team: null });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.primaryLabel).toBe("Training U17");
  });

  it("sets secondaryLabel to null for training", () => {
    const event = makeEvent({ type: "TRAINING" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.secondaryLabel).toBeNull();
  });

  it("sets eventType to TRAINING", () => {
    const candidates = mapScreen2Event(makeEvent({ type: "TRAINING" }), MAPPER_INPUT);
    expect(candidates[0].allocation.eventType).toBe("TRAINING");
    expect(candidates[0].allocation.visualKind).toBe("TRAINING");
  });
});

// ── Match labels ───────────────────────────────────────────────────────────────

describe("mapScreen2Event — MATCH labels", () => {
  it("uses team name as primaryLabel", () => {
    const event = makeEvent({
      type: "MATCH",
      homeAway: "HOME",
      team: { name: "FC A", displayName: "FC Allschwil", shortName: null },
      opponentFallbackName: "FC Binningen",
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.primaryLabel).toBe("FC Allschwil");
  });

  it("uses opponent name as secondaryLabel", () => {
    const event = makeEvent({
      type: "MATCH",
      homeAway: "HOME",
      opponentFallbackName: "FC Binningen",
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.secondaryLabel).toBe("FC Binningen");
  });

  it("sets secondaryLabel to null when opponent is absent", () => {
    const event = makeEvent({
      type: "MATCH",
      homeAway: "HOME",
      opponentFallbackName: null,
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.secondaryLabel).toBeNull();
  });

  it("sets opponentName field for MATCH", () => {
    const event = makeEvent({
      type: "MATCH",
      opponentFallbackName: "FC Oberwil",
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.opponentName).toBe("FC Oberwil");
  });
});

// ── Tournament labels ──────────────────────────────────────────────────────────

describe("mapScreen2Event — TOURNAMENT labels", () => {
  it("uses competitionLabel as primaryLabel", () => {
    const event = makeEvent({
      type: "TOURNAMENT",
      competitionLabel: "U12 Hallenturnier",
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.primaryLabel).toBe("U12 Hallenturnier");
  });

  it("falls back to organizerName when competitionLabel absent", () => {
    const event = makeEvent({
      type: "TOURNAMENT",
      competitionLabel: null,
      organizerName: "FC Allschwil",
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.primaryLabel).toBe("FC Allschwil");
  });

  it("falls back to title when both absent", () => {
    const event = makeEvent({
      type: "TOURNAMENT",
      competitionLabel: null,
      organizerName: null,
      title: "Turnier",
      team: null,
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.primaryLabel).toBe("Turnier");
  });

  it("sets tournamentName for TOURNAMENT", () => {
    const event = makeEvent({
      type: "TOURNAMENT",
      competitionLabel: "U10 Turnier",
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.tournamentName).toBe("U10 Turnier");
  });

  it("sets opponentName to null for TOURNAMENT", () => {
    const event = makeEvent({
      type: "TOURNAMENT",
      opponentFallbackName: "FC Other",
      pitchCode: "STADION_A",
    });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.opponentName).toBeNull();
  });
});

// ── Time labels ────────────────────────────────────────────────────────────────

describe("mapScreen2Event — time labels", () => {
  it("formats startTimeLabel in tenant timezone (UTC+2 in summer)", () => {
    // 17:00 UTC = 19:00 Europe/Zurich (UTC+2 in summer)
    const event = makeEvent({
      startAt: new Date("2026-07-24T17:00:00.000Z"),
      endAt: new Date("2026-07-24T18:30:00.000Z"),
    });
    const candidates = mapScreen2Event(event, { ...MAPPER_INPUT, timeZone: "Europe/Zurich" });
    expect(candidates[0].allocation.startTimeLabel).toBe("19:00");
  });

  it("formats endTimeLabel in tenant timezone", () => {
    const event = makeEvent({
      startAt: new Date("2026-07-24T17:00:00.000Z"),
      endAt: new Date("2026-07-24T18:30:00.000Z"),
    });
    const candidates = mapScreen2Event(event, { ...MAPPER_INPUT, timeZone: "Europe/Zurich" });
    expect(candidates[0].allocation.endTimeLabel).toBe("20:30");
  });

  it("builds timeRangeLabel as 'start – end'", () => {
    const event = makeEvent({
      startAt: new Date("2026-07-24T17:00:00.000Z"),
      endAt: new Date("2026-07-24T18:30:00.000Z"),
    });
    const candidates = mapScreen2Event(event, { ...MAPPER_INPUT, timeZone: "Europe/Zurich" });
    expect(candidates[0].allocation.timeRangeLabel).toBe("19:00 – 20:30");
  });

  it("uses effective end time when endAt is null", () => {
    const event = makeEvent({
      type: "TRAINING",
      startAt: new Date("2026-07-24T17:00:00.000Z"),
      endAt: null,
    });
    // TRAINING default duration = 90 min → end = 18:30 UTC = 20:30 Zurich
    const candidates = mapScreen2Event(event, { ...MAPPER_INPUT, timeZone: "Europe/Zurich" });
    expect(candidates[0].allocation.endAt).toBeTruthy();
    expect(candidates[0].allocation.endTimeLabel).toBe("20:30");
  });

  it("formats time in UTC when timeZone is UTC", () => {
    const event = makeEvent({
      startAt: new Date("2026-07-24T17:00:00.000Z"),
      endAt: new Date("2026-07-24T18:30:00.000Z"),
    });
    const candidates = mapScreen2Event(event, { ...MAPPER_INPUT, timeZone: "UTC" });
    expect(candidates[0].allocation.startTimeLabel).toBe("17:00");
    expect(candidates[0].allocation.endTimeLabel).toBe("18:30");
  });
});

// ── Dressing room labels ───────────────────────────────────────────────────────

describe("mapScreen2Event — dressing-room labels", () => {
  it("resolves home dressing-room label from resource name map", () => {
    const event = makeEvent({ homeDressingRoomCode: "E1" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.dressingRoomLabel).toBe("E1");
  });

  it("falls back to code when name is not in resource map", () => {
    const event = makeEvent({ homeDressingRoomCode: "UNKNOWN_DR" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.dressingRoomLabel).toBe("UNKNOWN_DR");
  });

  it("sets dressingRoomLabel to null when no home dressing room assigned", () => {
    const event = makeEvent({ homeDressingRoomCode: null });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates[0].allocation.dressingRoomLabel).toBeNull();
  });
});

// ── Pitch assignment and expansion ─────────────────────────────────────────────

describe("mapScreen2Event — resource assignment", () => {
  it("returns one candidate for a direct HALF_PITCH assignment", () => {
    const event = makeEvent({ pitchCode: "STADION_A" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].resourceId).toBe("half-stadion-a");
    expect(candidates[0].allocation.isFullResourceAllocation).toBe(false);
  });

  it("expands FULL_PITCH assignment to sibling HALF_PITCH resources", () => {
    const event = makeEvent({ pitchCode: "STADION" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    // Stadion has two HALF_PITCH children: STADION_A and STADION_B
    expect(candidates).toHaveLength(2);
    const resourceIds = candidates.map((c) => c.resourceId).sort();
    expect(resourceIds).toEqual(["half-stadion-a", "half-stadion-b"]);
  });

  it("marks FULL_PITCH-expanded candidates as isFullResourceAllocation = true", () => {
    const event = makeEvent({ pitchCode: "STADION" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates.every((c) => c.allocation.isFullResourceAllocation)).toBe(true);
  });

  it("assigns FULL_PITCH directly when no HALF_PITCH children exist", () => {
    const event = makeEvent({ pitchCode: "KUNSTRASEN_2" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    // KR2 has no HALF_PITCH children → direct assignment to FULL_PITCH resource
    expect(candidates).toHaveLength(1);
    expect(candidates[0].resourceId).toBe("full-kr2");
    expect(candidates[0].allocation.isFullResourceAllocation).toBe(false);
  });

  it("returns empty array when pitchCode is null", () => {
    const event = makeEvent({ pitchCode: null });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates).toHaveLength(0);
  });

  it("returns empty array when pitchCode does not match any display resource", () => {
    const event = makeEvent({ pitchCode: "UNKNOWN_FIELD" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates).toHaveLength(0);
  });

  it("does not include dressing-room resources as candidates", () => {
    // E1 is in RESOURCE_NAME_BY_CODE but not in DISPLAY_RESOURCES (filtered)
    const event = makeEvent({ pitchCode: "E1" });
    const candidates = mapScreen2Event(event, MAPPER_INPUT);
    expect(candidates).toHaveLength(0);
  });

  it("does not mutate the source event", () => {
    const event = makeEvent({ pitchCode: "STADION_A" });
    const before = { ...event };
    mapScreen2Event(event, MAPPER_INPUT);
    expect(event).toEqual(before);
  });
});

// ── mapAllScreen2Events ────────────────────────────────────────────────────────

describe("mapAllScreen2Events", () => {
  it("collects all candidates from multiple events", () => {
    const events = [
      makeEvent({ id: "e1", pitchCode: "STADION_A" }),
      makeEvent({ id: "e2", pitchCode: "STADION_B" }),
    ];
    const { candidates } = mapAllScreen2Events(events, MAPPER_INPUT);
    expect(candidates).toHaveLength(2);
  });

  it("reports unassigned event IDs", () => {
    const events = [
      makeEvent({ id: "e1", pitchCode: "STADION_A" }),
      makeEvent({ id: "e2", pitchCode: null }),
      makeEvent({ id: "e3", pitchCode: "NOWHERE" }),
    ];
    const { unassignedIds } = mapAllScreen2Events(events, MAPPER_INPUT);
    expect(unassignedIds).toContain("e2");
    expect(unassignedIds).toContain("e3");
    expect(unassignedIds).not.toContain("e1");
  });

  it("deduplicates exact (resourceId, eventId) pairs", () => {
    // Two calls to the same event produce duplicate candidates
    const events = [
      makeEvent({ id: "e1", pitchCode: "STADION_A" }),
      makeEvent({ id: "e1", pitchCode: "STADION_A" }), // duplicate
    ];
    const { candidates } = mapAllScreen2Events(events, MAPPER_INPUT);
    expect(candidates).toHaveLength(1);
  });

  it("handles empty input", () => {
    const { candidates, unassignedIds } = mapAllScreen2Events([], MAPPER_INPUT);
    expect(candidates).toHaveLength(0);
    expect(unassignedIds).toHaveLength(0);
  });
});
