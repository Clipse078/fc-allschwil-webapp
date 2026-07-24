/**
 * lib/publishing/infoboard/__tests__/screen2-feed-builder.test.ts
 *
 * Integration tests for buildInfoboardScreen2Feed.
 *
 * Uses plain test objects and injected loader functions. No DB, no Prisma,
 * no environment access.
 *
 * Covers:
 *   - Loader contract (event loader called once, resource loader called once)
 *   - Publication policy integration (INFOBOARD_SCREEN_2)
 *   - Away matches excluded
 *   - Hidden events excluded
 *   - Cross-tenant events excluded
 *   - Empty facility
 *   - Fields with no events (FREE_REST_OF_DAY)
 *   - Mixed occupied and free fields
 *   - Display date uses tenant timezone
 *   - Deterministic field ordering
 *   - Diagnostics counts (sourceEventCount, eligibleEventCount, etc.)
 *   - Source loader receives bounded date range (±25h window)
 *   - Supplied now is never replaced
 *   - Feed metadata (generatedAt, tenant, timeZone, isStale)
 *   - Invalid timezone throws RangeError
 *   - Error propagation from loaders
 */

import { describe, it, expect, vi } from "vitest";
import { buildInfoboardScreen2Feed } from "../screen2-feed-builder";
import type { BuildScreen2FeedInput } from "../screen2-feed-builder";
import type { Screen2SourceEvent } from "../screen2-types";
import type { PublicationEventLoadInput } from "../../policy/event-selection";
import type { Screen2FacilityResourceRow } from "../screen2-resource-normalizer";

// ── Constants ─────────────────────────────────────────────────────────────────

const TZ_ZURICH = "Europe/Zurich";
const TENANT_ID = "tenant-fca";

const TENANT: BuildScreen2FeedInput["tenant"] = {
  id: TENANT_ID,
  key: "fca",
  name: "FC Allschwil",
  timezone: TZ_ZURICH,
};

// Reference now: 2026-07-24T16:00:00Z (18:00 Zurich, UTC+2)
const NOW = new Date("2026-07-24T16:00:00.000Z");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RESOURCE_ROWS: Screen2FacilityResourceRow[] = [
  {
    id: "res-stadion-a", tenantId: TENANT_ID, facilityId: "fac-stadion",
    name: "Feld A", code: "STADION_A", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 10,
    facility: { id: "fac-stadion", name: "Stadion" },
  },
  {
    id: "res-stadion-b", tenantId: TENANT_ID, facilityId: "fac-stadion",
    name: "Feld B", code: "STADION_B", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 20,
    facility: { id: "fac-stadion", name: "Stadion" },
  },
];

function makeEvent(overrides: Partial<Screen2SourceEvent> = {}): Screen2SourceEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    tenantId: TENANT_ID,
    type: "TRAINING",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    startAt: new Date("2026-07-24T15:00:00.000Z"), // 17:00 Zurich — current
    endAt: new Date("2026-07-24T17:00:00.000Z"),   // 19:00 Zurich
    sortOrder: 0,
    title: "Training",
    pitchCode: "STADION_A",
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    ...overrides,
  };
}

function makeFeedInput(
  loadEvents: (input: PublicationEventLoadInput) => Promise<readonly Screen2SourceEvent[]>,
  resources: Screen2FacilityResourceRow[] = RESOURCE_ROWS,
  now: Date = NOW,
): [typeof loadEvents, BuildScreen2FeedInput] {
  return [
    loadEvents,
    {
      tenant: TENANT,
      timeZone: TZ_ZURICH,
      now,
      loadFacilityResources: vi.fn().mockResolvedValue(resources),
    },
  ];
}

// ── Feed metadata ──────────────────────────────────────────────────────────────

describe("buildInfoboardScreen2Feed — metadata", () => {
  it("sets generatedAt to now.toISOString()", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.generatedAt).toBe(NOW.toISOString());
  });

  it("sets tenant to the supplied tenant reference", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.tenant.id).toBe(TENANT_ID);
    expect(feed.tenant.name).toBe("FC Allschwil");
  });

  it("sets displayDate from tenant timezone (18:00 Zurich = 2026-07-24)", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.displayDate).toBe("2026-07-24");
  });

  it("sets timeZone to the supplied timezone", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.timeZone).toBe(TZ_ZURICH);
  });

  it("sets isStale to false by default", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.isStale).toBe(false);
  });

  it("throws RangeError for invalid timezone", async () => {
    const [loadEvents, _input] = makeFeedInput(async () => []);
    const invalidInput: BuildScreen2FeedInput = {
      tenant: TENANT,
      timeZone: "Invalid/Timezone",
      now: NOW,
      loadFacilityResources: vi.fn(),
    };
    await expect(buildInfoboardScreen2Feed(loadEvents, invalidInput)).rejects.toThrow(RangeError);
  });
});

// ── Loader contract ────────────────────────────────────────────────────────────

describe("buildInfoboardScreen2Feed — loader contract", () => {
  it("calls loadEvents exactly once", async () => {
    const loadEvents = vi.fn().mockResolvedValue([]);
    const [, input] = makeFeedInput(loadEvents);
    await buildInfoboardScreen2Feed(loadEvents, input);
    expect(loadEvents).toHaveBeenCalledTimes(1);
  });

  it("calls loadFacilityResources exactly once", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    await buildInfoboardScreen2Feed(loadEvents, input);
    expect(input.loadFacilityResources).toHaveBeenCalledTimes(1);
  });

  it("passes tenantId to the event loader", async () => {
    const loadEvents = vi.fn().mockResolvedValue([]);
    const [, input] = makeFeedInput(loadEvents);
    await buildInfoboardScreen2Feed(loadEvents, input);
    expect(loadEvents).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
  });

  it("passes a bounded date range (dateFrom before now, dateTo after now)", async () => {
    const loadEvents = vi.fn().mockResolvedValue([]);
    const [, input] = makeFeedInput(loadEvents);
    await buildInfoboardScreen2Feed(loadEvents, input);
    const callArg = loadEvents.mock.calls[0][0] as PublicationEventLoadInput;
    expect(callArg.dateFrom).toBeDefined();
    expect(callArg.dateTo).toBeDefined();
    expect(callArg.dateFrom!.getTime()).toBeLessThan(NOW.getTime());
    expect(callArg.dateTo!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("supplied now is never replaced (generatedAt matches supplied now)", async () => {
    const customNow = new Date("2026-03-15T09:30:00.000Z");
    const [loadEvents, _input] = makeFeedInput(async () => []);
    const input: BuildScreen2FeedInput = {
      tenant: TENANT,
      timeZone: TZ_ZURICH,
      now: customNow,
      loadFacilityResources: vi.fn().mockResolvedValue(RESOURCE_ROWS),
    };
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.generatedAt).toBe(customNow.toISOString());
  });

  it("propagates error from event loader", async () => {
    const loadEvents = vi.fn().mockRejectedValue(new Error("event load failure"));
    const [, input] = makeFeedInput(loadEvents);
    await expect(buildInfoboardScreen2Feed(loadEvents, input)).rejects.toThrow("event load failure");
  });

  it("propagates error from resource loader", async () => {
    const loadEvents = vi.fn().mockResolvedValue([]);
    const input: BuildScreen2FeedInput = {
      tenant: TENANT,
      timeZone: TZ_ZURICH,
      now: NOW,
      loadFacilityResources: vi.fn().mockRejectedValue(new Error("resource load failure")),
    };
    await expect(buildInfoboardScreen2Feed(loadEvents, input)).rejects.toThrow("resource load failure");
  });
});

// ── Publication policy ─────────────────────────────────────────────────────────

describe("buildInfoboardScreen2Feed — publication policy", () => {
  it("excludes away matches", async () => {
    const awayMatch = makeEvent({
      type: "MATCH",
      homeAway: "AWAY",
      pitchCode: "STADION_A",
    });
    const [loadEvents, input] = makeFeedInput(async () => [awayMatch]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.eligibleEventCount).toBe(0);
    expect(feed.diagnostics.unassignedEventCount).toBe(0);
    expect(feed.fields.every((f) => f.current === null)).toBe(true);
  });

  it("excludes events with infoboardVisible = false", async () => {
    const hidden = makeEvent({ infoboardVisible: false });
    const [loadEvents, input] = makeFeedInput(async () => [hidden]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.eligibleEventCount).toBe(0);
  });

  it("excludes events with status DRAFT", async () => {
    const draft = makeEvent({ status: "DRAFT" });
    const [loadEvents, input] = makeFeedInput(async () => [draft]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.eligibleEventCount).toBe(0);
  });

  it("excludes events from a different tenant", async () => {
    const crossTenant = makeEvent({ tenantId: "tenant-other" });
    const [loadEvents, input] = makeFeedInput(async () => [crossTenant]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.eligibleEventCount).toBe(0);
  });

  it("includes home matches", async () => {
    const homeMatch = makeEvent({
      type: "MATCH",
      homeAway: "HOME",
      pitchCode: "STADION_A",
    });
    const [loadEvents, input] = makeFeedInput(async () => [homeMatch]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.eligibleEventCount).toBe(1);
  });

  it("includes trainings", async () => {
    const training = makeEvent({ type: "TRAINING" });
    const [loadEvents, input] = makeFeedInput(async () => [training]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.eligibleEventCount).toBe(1);
  });

  it("includes tournaments", async () => {
    const tournament = makeEvent({ type: "TOURNAMENT", pitchCode: "STADION_A" });
    const [loadEvents, input] = makeFeedInput(async () => [tournament]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.eligibleEventCount).toBe(1);
  });
});

// ── Empty and free fields ──────────────────────────────────────────────────────

describe("buildInfoboardScreen2Feed — empty facility and free fields", () => {
  it("returns fields for all display resources even with no events", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.fields).toHaveLength(2); // RESOURCE_ROWS has 2 entries
  });

  it("all fields are FREE_REST_OF_DAY when no events", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.fields.every((f) => f.state === "FREE_REST_OF_DAY")).toBe(true);
  });

  it("returns empty fields array when no resources", async () => {
    const [loadEvents, input] = makeFeedInput(async () => [], []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.fields).toHaveLength(0);
  });
});

// ── Mixed occupied / free fields ───────────────────────────────────────────────

describe("buildInfoboardScreen2Feed — mixed fields", () => {
  it("STADION_A occupied, STADION_B free", async () => {
    const training = makeEvent({
      pitchCode: "STADION_A",
      startAt: new Date("2026-07-24T15:00:00.000Z"),
      endAt: new Date("2026-07-24T17:00:00.000Z"),
    });
    const [loadEvents, input] = makeFeedInput(async () => [training]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    const feldA = feed.fields.find((f) => f.mapKey === "STADION_A");
    const feldB = feed.fields.find((f) => f.mapKey === "STADION_B");
    expect(feldA?.state).toBe("ACTIVE");
    expect(feldB?.state).toBe("FREE_REST_OF_DAY");
  });
});

// ── Deterministic ordering ────────────────────────────────────────────────────

describe("buildInfoboardScreen2Feed — deterministic field ordering", () => {
  it("fields are ordered by display resource sortOrder", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    // RESOURCE_ROWS: sortOrder 10 (STADION_A) < sortOrder 20 (STADION_B)
    expect(feed.fields[0].mapKey).toBe("STADION_A");
    expect(feed.fields[1].mapKey).toBe("STADION_B");
  });
});

// ── Diagnostics ────────────────────────────────────────────────────────────────

describe("buildInfoboardScreen2Feed — diagnostics", () => {
  it("reports sourceEventCount (eligible + rejected)", async () => {
    const eligible = makeEvent({ type: "TRAINING" });
    const rejected = makeEvent({ type: "MATCH", homeAway: "AWAY" });
    const [loadEvents, input] = makeFeedInput(async () => [eligible, rejected]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.sourceEventCount).toBe(2);
    expect(feed.diagnostics.eligibleEventCount).toBe(1);
  });

  it("reports unassignedEventCount for events with no pitchCode match", async () => {
    const noMatch = makeEvent({ pitchCode: "UNKNOWN_FIELD" });
    const [loadEvents, input] = makeFeedInput(async () => [noMatch]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.unassignedEventCount).toBe(1);
    expect(feed.diagnostics.unassignedEventIds).toContain(noMatch.id);
  });

  it("reports fieldCount matching display resource count", async () => {
    const [loadEvents, input] = makeFeedInput(async () => []);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.fieldCount).toBe(2);
  });

  it("reports conflictingFieldCount for fields with overlapping events", async () => {
    const e1 = makeEvent({
      id: "e1",
      pitchCode: "STADION_A",
      startAt: new Date("2026-07-24T15:00:00.000Z"),
      endAt: new Date("2026-07-24T17:30:00.000Z"),
    });
    const e2 = makeEvent({
      id: "e2",
      pitchCode: "STADION_A",
      startAt: new Date("2026-07-24T15:30:00.000Z"),
      endAt: new Date("2026-07-24T17:00:00.000Z"),
    });
    const [loadEvents, input] = makeFeedInput(async () => [e1, e2]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.conflictingFieldCount).toBe(1);
    expect(feed.diagnostics.conflictingFieldResourceIds).toContain("res-stadion-a");
  });

  it("reports zero unassigned when all events match resources", async () => {
    const training = makeEvent({ pitchCode: "STADION_A" });
    const [loadEvents, input] = makeFeedInput(async () => [training]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.unassignedEventCount).toBe(0);
    expect(feed.diagnostics.unassignedEventIds).toHaveLength(0);
  });

  it("unassignedEventIds are sorted stably", async () => {
    const e1 = makeEvent({ id: "z-event", pitchCode: null });
    const e2 = makeEvent({ id: "a-event", pitchCode: null });
    const [loadEvents, input] = makeFeedInput(async () => [e1, e2]);
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    expect(feed.diagnostics.unassignedEventIds[0]).toBe("a-event");
    expect(feed.diagnostics.unassignedEventIds[1]).toBe("z-event");
  });
});

// ── Timezone handling ─────────────────────────────────────────────────────────

describe("buildInfoboardScreen2Feed — timezone handling", () => {
  it("display date changes at local midnight, not UTC midnight", async () => {
    // 22:30 UTC on July 24 = 00:30 on July 25 in Zurich (UTC+2 summer)
    const lateNow = new Date("2026-07-24T22:30:00.000Z");
    const [loadEvents, _input] = makeFeedInput(async () => []);
    const input: BuildScreen2FeedInput = {
      tenant: TENANT,
      timeZone: TZ_ZURICH,
      now: lateNow,
      loadFacilityResources: vi.fn().mockResolvedValue(RESOURCE_ROWS),
    };
    const feed = await buildInfoboardScreen2Feed(loadEvents, input);
    // In Zurich, 22:30 UTC on July 24 is 00:30 on July 25
    expect(feed.displayDate).toBe("2026-07-25");
  });
});
