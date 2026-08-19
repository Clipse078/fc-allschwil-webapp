/**
 * lib/publishing/infoboard/__tests__/screen2-feed-builder.test.ts
 *
 * Unit tests for buildInfoboardScreen2Feed.
 *
 * Covers (INFOBOARD-INTEGRATION-01C test requirements — facility overview):
 *   1.  Tenant isolation (tenantId forwarded to loader)
 *   2.  Active pitch inclusion
 *   3.  Archived pitch exclusion (handled by live service; builder uses given pitches)
 *   4.  Current match occupancy → OCCUPIED_NOW, currentEvent populated
 *   5.  Current training occupancy → OCCUPIED_NOW, type TRAINING
 *   6.  Current tournament occupancy → OCCUPIED_NOW, type TOURNAMENT
 *   7.  Upcoming activity → UPCOMING, nextEvent populated
 *   8.  Current + next shown together (JETZT + DANACH), never collapsed
 *   9.  Free pitch behavior → FREE_NOW, currentEvent null, nextEvent null
 *  10.  All configured pitches remain visible regardless of events
 *  11.  Canonical pitch ordering (input order preserved)
 *  12.  Event type mapping (MATCH → type MATCH, etc.)
 *  13.  Europe/Zurich time classification
 *  14.  Genuine empty facility state (empty pitches array)
 *  16.  Preview route remains fixture-based (not tested here — component test)
 *  17.  Screen 1 behavior is unchanged (not tested here — Screen 1 tests)
 *
 * Additional coverage (INFOBOARD-INTEGRATION-01C):
 *   - hasAllocationConflict true when two current events share a pitch
 *   - dressingRooms resolves per-resource current/next allocation
 *   - dressingRooms is empty when no dressing rooms are configured
 *   - a dressing room is never invented for an unallocated activity
 *   - unallocated activities (no matching configured pitch) are surfaced
 *     in a compact, restrained list — never fabricated
 *   - AWAY match is excluded before reaching the builder (shared policy)
 *   - rolling 4-hour horizon: event beyond the horizon is excluded, event
 *     exactly at the horizon boundary is included
 *   - canonical Team.name-first naming
 *   - displayDate matches Europe/Zurich local date
 *   - generatedAt = now.toISOString()
 *   - isStale = false
 */

import { describe, it, expect } from "vitest";
import {
  buildInfoboardScreen2Feed,
  type ConfiguredPitch,
  type ConfiguredDressingRoom,
} from "../screen2-feed-builder";
import type {
  InfoboardTenantRef,
} from "../../event-types";
import type { Screen1SourceEvent } from "../screen1-event-mapper";
import type { PublicationEventLoader } from "../../policy/event-selection";
import type { PublishingEventType, PublishingEventStatus } from "../../event-types";

// ── Test helpers ──────────────────────────────────────────────────────────────

const ZURICH_TZ = "Europe/Zurich";

const TEST_TENANT: InfoboardTenantRef = {
  id: "tenant-test-01",
  key: "test-club",
  name: "Test Club",
  timezone: ZURICH_TZ,
};

function makePitch(
  code: string,
  name: string,
  facilityName = "Teststadion",
  facilityId = "facility-01",
  resourceType: "FULL_PITCH" | "HALF_PITCH" = "FULL_PITCH",
): ConfiguredPitch {
  return { code, name, facilityName, facilityId, resourceType };
}

function makeDressingRoom(code: string, name: string): ConfiguredDressingRoom {
  return { code, name };
}

function makeEvent(overrides: Partial<{
  id: string;
  pitchCode: string;
  pitchCodes: readonly string[];
  type: PublishingEventType;
  status: PublishingEventStatus;
  startAt: Date;
  endAt: Date | null;
  tenantId: string;
  title: string;
  infoboardVisible: boolean;
  homeAway: string | null;
  teamName: string | null;
  opponentFallbackName: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
}>= {}): Screen1SourceEvent {
  const startAt = overrides.startAt ?? new Date("2026-09-12T14:00:00.000Z");
  return {
    id: overrides.id ?? "evt-test",
    tenantId: overrides.tenantId ?? TEST_TENANT.id,
    type: overrides.type ?? "MATCH",
    status: overrides.status ?? "SCHEDULED",
    infoboardVisible: overrides.infoboardVisible ?? true,
    websiteVisible: true,
    trainingsplanVisible: false,
    homeAway: overrides.homeAway ?? "HOME",
    startAt,
    endAt: overrides.endAt ?? null,
    title: overrides.title ?? "Test Match",
    seasonKey: "2025-26",
    // Mirrors the canonical source loader's shape: only Team.name is ever
    // populated (no displayName/shortName override) — see
    // canonical-source-loader.ts#mapMatchItem/mapTrainingItem/mapTournamentItem.
    team: { name: overrides.teamName ?? "FC Test" },
    opponent: null,
    opponentFallbackName:
      overrides.opponentFallbackName !== undefined ? overrides.opponentFallbackName : "FC Opponent",
    organizerName: null,
    competitionLabel: null,
    meetingTime: null,
    resultLabel: null,
    intermediateResultLabel: null,
    pitch: overrides.pitchCode
      ? { code: overrides.pitchCode, label: null, name: null, facilityName: null }
      : null,
    pitchCodes: overrides.pitchCodes,
    homeDressingRoom: overrides.homeDressingRoomCode
      ? { code: overrides.homeDressingRoomCode, label: null, name: null }
      : null,
    awayDressingRoom: overrides.awayDressingRoomCode
      ? { code: overrides.awayDressingRoomCode, label: null, name: null }
      : null,
    refereeDressingRoom: null,
  };
}

function makeLoader(
  events: Screen1SourceEvent[],
): PublicationEventLoader<Screen1SourceEvent> {
  return async () => events;
}

// 2026-09-12 15:35 UTC = 17:35 Zurich (CEST, UTC+2)
const NOW_UTC = new Date("2026-09-12T15:35:00.000Z");

// ── 1. Tenant isolation ───────────────────────────────────────────────────────

describe("1. Tenant isolation", () => {
  it("passes tenantId to the loader from tenant.id", async () => {
    let capturedTenantId: string | undefined;
    const loader: PublicationEventLoader<Screen1SourceEvent> = async (input) => {
      capturedTenantId = input.tenantId;
      return [];
    };
    await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      loader,
    });
    expect(capturedTenantId).toBe(TEST_TENANT.id);
  });
});

// ── 2. Active pitch inclusion ──────────────────────────────────────────────────

describe("2. Active pitch inclusion", () => {
  it("returns an entry for each supplied pitch even with no events", async () => {
    const pitches = [makePitch("P-1", "Platz 1"), makePitch("P-2", "Platz 2")];
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches,
      loader: makeLoader([]),
    });
    expect(feed.pitches).toHaveLength(2);
    expect(feed.pitches[0].code).toBe("P-1");
    expect(feed.pitches[1].code).toBe("P-2");
  });
});

// ── 3. Archived pitch exclusion ────────────────────────────────────────────────

describe("3. Archived pitch exclusion", () => {
  it("only includes pitches passed in — archived pitches are filtered by live service", async () => {
    // The builder trusts the caller to provide only active pitches.
    const pitches = [makePitch("P-ACTIVE", "Aktiver Platz")];
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches,
      loader: makeLoader([]),
    });
    expect(feed.pitches).toHaveLength(1);
    expect(feed.pitches[0].code).toBe("P-ACTIVE");
  });
});

// ── 4. Current match occupancy ─────────────────────────────────────────────────

describe("4. Current match occupancy", () => {
  it("pitch with current MATCH event has state OCCUPIED_NOW", async () => {
    // Event started 35 min ago, ends in 75 min — currently active
    const startAt = new Date(NOW_UTC.getTime() - 35 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() + 75 * 60_000);
    const event = makeEvent({
      pitchCode: "P-ST",
      type: "MATCH",
      startAt,
      endAt,
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-ST", "Stadion")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("OCCUPIED_NOW");
    expect(feed.pitches[0].currentEvent).not.toBeNull();
    expect(feed.pitches[0].currentEvent?.type).toBe("MATCH");
  });
});

// ── 5. Current training occupancy ──────────────────────────────────────────────

describe("5. Current training occupancy", () => {
  it("pitch with current TRAINING event has state OCCUPIED_NOW and type TRAINING", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 20 * 60_000);
    const event = makeEvent({
      pitchCode: "P-KR1",
      type: "TRAINING",
      status: "SCHEDULED",
      homeAway: null,
      startAt,
      endAt: null,
      infoboardVisible: true,
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-KR1", "Kunstrasen 1")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("OCCUPIED_NOW");
    expect(feed.pitches[0].currentEvent?.type).toBe("TRAINING");
  });
});

// ── 6. Current tournament occupancy ────────────────────────────────────────────

describe("6. Current tournament occupancy", () => {
  it("pitch with current TOURNAMENT event has state OCCUPIED_NOW and type TOURNAMENT", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 60 * 60_000);
    const event = makeEvent({
      pitchCode: "P-KR2",
      type: "TOURNAMENT",
      status: "SCHEDULED",
      homeAway: "HOME",
      startAt,
      endAt: null,
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-KR2", "Kunstrasen 2")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("OCCUPIED_NOW");
    expect(feed.pitches[0].currentEvent?.type).toBe("TOURNAMENT");
  });
});

// ── 7. Upcoming activity ───────────────────────────────────────────────────────

describe("7. Upcoming activity", () => {
  it("pitch with only upcoming event has state UPCOMING and nextEvent populated", async () => {
    // Event starts 25 min from now, still on today's local date in Zurich
    const startAt = new Date(NOW_UTC.getTime() + 25 * 60_000);
    const event = makeEvent({
      pitchCode: "P-KR1",
      type: "TRAINING",
      status: "SCHEDULED",
      homeAway: null,
      startAt,
      endAt: null,
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-KR1", "Kunstrasen 1")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("UPCOMING");
    expect(feed.pitches[0].currentEvent).toBeNull();
    expect(feed.pitches[0].nextEvent).not.toBeNull();
    expect(feed.pitches[0].nextEvent?.temporalRelation).toBe("next");
  });
});

// ── 8. Current + next shown together ────────────────────────────────────────

describe("8. Current + next shown together (JETZT + DANACH)", () => {
  it("pitch with both current and upcoming events returns OCCUPIED_NOW with BOTH currentEvent and nextEvent populated", async () => {
    const currentStart = new Date(NOW_UTC.getTime() - 30 * 60_000);
    const currentEnd = new Date(NOW_UTC.getTime() + 60 * 60_000);
    const upcomingStart = new Date(NOW_UTC.getTime() + 90 * 60_000);

    const currentEvent = makeEvent({
      id: "e-current",
      pitchCode: "P-ST",
      type: "MATCH",
      startAt: currentStart,
      endAt: currentEnd,
    });
    const upcomingEvent = makeEvent({
      id: "e-upcoming",
      pitchCode: "P-ST",
      type: "TRAINING",
      homeAway: null,
      startAt: upcomingStart,
      endAt: null,
    });

    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-ST", "Stadion")],
      loader: makeLoader([currentEvent, upcomingEvent]),
    });
    expect(feed.pitches[0].state).toBe("OCCUPIED_NOW");
    expect(feed.pitches[0].currentEvent?.eventId).toBe("e-current");
    expect(feed.pitches[0].nextEvent?.eventId).toBe("e-upcoming");
  });
});

// ── 9. Free pitch behavior ─────────────────────────────────────────────────────

describe("9. Free pitch behavior", () => {
  it("pitch with no events has state FREE_NOW", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-FREE", "Freier Platz")],
      loader: makeLoader([]),
    });
    expect(feed.pitches[0].state).toBe("FREE_NOW");
    expect(feed.pitches[0].currentEvent).toBeNull();
    expect(feed.pitches[0].nextEvent).toBeNull();
  });

  it("pitch with only ended events has state FREE_NOW", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 120 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({ pitchCode: "P-FREE", startAt, endAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-FREE", "Freier Platz")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("FREE_NOW");
  });
});

// ── 10. All configured pitches remain visible ──────────────────────────────────

describe("10. All configured pitches remain visible", () => {
  it("all pitches appear in output even when some have no events", async () => {
    const currentStart = new Date(NOW_UTC.getTime() - 30 * 60_000);
    const currentEnd = new Date(NOW_UTC.getTime() + 60 * 60_000);
    const event = makeEvent({ pitchCode: "P-1", startAt: currentStart, endAt: currentEnd });

    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [
        makePitch("P-1", "Platz 1"),
        makePitch("P-2", "Platz 2"),
        makePitch("P-3", "Platz 3"),
      ],
      loader: makeLoader([event]),
    });
    expect(feed.pitches).toHaveLength(3);
    const codes = feed.pitches.map((p) => p.code);
    expect(codes).toContain("P-1");
    expect(codes).toContain("P-2");
    expect(codes).toContain("P-3");
  });
});

// ── 11. Canonical pitch ordering ───────────────────────────────────────────────

describe("11. Canonical pitch ordering", () => {
  it("preserves input pitch order in output", async () => {
    const pitches = [
      makePitch("P-C", "Platz C"),
      makePitch("P-A", "Platz A"),
      makePitch("P-B", "Platz B"),
    ];
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches,
      loader: makeLoader([]),
    });
    expect(feed.pitches.map((p) => p.code)).toEqual(["P-C", "P-A", "P-B"]);
  });
});

// ── 12. Event type mapping ─────────────────────────────────────────────────────

describe("12. Event type mapping", () => {
  it.each([
    ["MATCH" as const, "MATCH" as const],
    ["TRAINING" as const, "TRAINING" as const],
    ["TOURNAMENT" as const, "TOURNAMENT" as const],
  ])("event type %s maps correctly to PitchEventSummary.type", async (inputType, expectedType) => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({
      pitchCode: "P-1",
      type: inputType,
      homeAway: inputType === "MATCH" ? "HOME" : null,
      startAt,
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].currentEvent?.type).toBe(expectedType);
  });
});

// ── 13. Europe/Zurich time classification ─────────────────────────────────────

describe("13. Europe/Zurich time classification", () => {
  it("uses Europe/Zurich for local date key (displayDate)", async () => {
    // 2026-09-12T15:35 UTC = 2026-09-12 17:35 Zurich (CEST UTC+2)
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      loader: makeLoader([]),
    });
    expect(feed.displayDate).toBe("2026-09-12");
  });
});

// ── 14. Genuine empty facility state ──────────────────────────────────────────

describe("14. Genuine empty facility state", () => {
  it("returns empty pitches array when no pitches configured", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      loader: makeLoader([]),
    });
    expect(feed.pitches).toHaveLength(0);
    expect(feed.dressingRooms).toHaveLength(0);
  });
});

// ── dressingRooms ──────────────────────────────────────────────────────────────

describe("dressingRooms", () => {
  it("dressingRooms is empty when no dressing rooms are configured", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({ pitchCode: "P-1", startAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.dressingRooms).toEqual([]);
  });
});

// ── Conflict detection ────────────────────────────────────────────────────────

describe("Allocation conflict", () => {
  it("hasAllocationConflict is true when two current events share a pitch", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() + 80 * 60_000);
    const evt1 = makeEvent({ id: "e1", pitchCode: "P-1", startAt, endAt });
    const evt2 = makeEvent({ id: "e2", pitchCode: "P-1", startAt, endAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([evt1, evt2]),
    });
    expect(feed.pitches[0].hasAllocationConflict).toBe(true);
  });
});

// ── currentEvents — multi-activity canonical count ────────────────────────────

describe("currentEvents — multi-training occupancy", () => {
  it("single training on a pitch: currentEvents has length 1", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() + 80 * 60_000);
    const evt = makeEvent({ id: "e1", pitchCode: "P-1", startAt, endAt, type: "TRAINING" });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([evt]),
    });
    expect(feed.pitches[0].currentEvents).toHaveLength(1);
    expect(feed.pitches[0].currentEvents?.[0].eventId).toBe("e1");
  });

  it("two simultaneous trainings on same pitch: currentEvents has length 2", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() + 80 * 60_000);
    const evt1 = makeEvent({ id: "e1", pitchCode: "P-1", startAt, endAt, type: "TRAINING" });
    const evt2 = makeEvent({ id: "e2", pitchCode: "P-1", startAt, endAt, type: "TRAINING" });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([evt1, evt2]),
    });
    expect(feed.pitches[0].currentEvents).toHaveLength(2);
    expect(feed.pitches[0].hasAllocationConflict).toBe(true);
  });

  it("three simultaneous trainings on same pitch: currentEvents has length 3", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() + 80 * 60_000);
    const evt1 = makeEvent({ id: "e1", pitchCode: "P-1", startAt, endAt, type: "TRAINING" });
    const evt2 = makeEvent({ id: "e2", pitchCode: "P-1", startAt, endAt, type: "TRAINING" });
    const evt3 = makeEvent({ id: "e3", pitchCode: "P-1", startAt, endAt, type: "TRAINING" });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([evt1, evt2, evt3]),
    });
    expect(feed.pitches[0].currentEvents).toHaveLength(3);
  });

  it("free pitch: currentEvents is empty", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([]),
    });
    expect(feed.pitches[0].currentEvents).toHaveLength(0);
    expect(feed.pitches[0].currentEvent).toBeNull();
  });

  it("currentEvent is the first of currentEvents (ordered by startAt)", async () => {
    const startAt1 = new Date(NOW_UTC.getTime() - 20 * 60_000);
    const startAt2 = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() + 60 * 60_000);
    const evt1 = makeEvent({ id: "e-first", pitchCode: "P-1", startAt: startAt1, endAt, type: "TRAINING" });
    const evt2 = makeEvent({ id: "e-second", pitchCode: "P-1", startAt: startAt2, endAt, type: "TRAINING" });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([evt2, evt1]), // supply in reverse order
    });
    expect(feed.pitches[0].currentEvent?.eventId).toBe("e-first");
    expect(feed.pitches[0].currentEvents?.[0].eventId).toBe("e-first");
  });

  it("multiple trainings on pitch A, pitch B free: A has currentEvents length 2, B has length 0", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() + 80 * 60_000);
    const evtA1 = makeEvent({ id: "a1", pitchCode: "P-A", startAt, endAt, type: "TRAINING" });
    const evtA2 = makeEvent({ id: "a2", pitchCode: "P-A", startAt, endAt, type: "TRAINING" });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [
        makePitch("P-A", "Platz A"),
        makePitch("P-B", "Platz B"),
      ],
      loader: makeLoader([evtA1, evtA2]),
    });
    expect(feed.pitches[0].currentEvents).toHaveLength(2); // P-A
    expect(feed.pitches[1].currentEvents).toHaveLength(0); // P-B free
  });
});

// ── Feed metadata ─────────────────────────────────────────────────────────────

describe("Feed metadata", () => {
  it("generatedAt equals now.toISOString()", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      loader: makeLoader([]),
    });
    expect(feed.generatedAt).toBe(NOW_UTC.toISOString());
  });

  it("isStale is false", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      loader: makeLoader([]),
    });
    expect(feed.isStale).toBe(false);
  });

  it("tenant ref is correct", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      loader: makeLoader([]),
    });
    expect(feed.tenant.id).toBe(TEST_TENANT.id);
    expect(feed.tenant.key).toBe(TEST_TENANT.key);
  });
});

// ── RangeError on invalid timezone ────────────────────────────────────────────

describe("Invalid timezone", () => {
  it("throws RangeError when timeZone is invalid", async () => {
    await expect(
      buildInfoboardScreen2Feed({
        tenant: TEST_TENANT,
        timeZone: "Invalid/Zone",
        now: NOW_UTC,
        pitches: [],
        loader: makeLoader([]),
      }),
    ).rejects.toThrow(RangeError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Rolling 4-hour horizon (reused from Screen 1 — SCREEN1_HORIZON_MS) ──────
// ─────────────────────────────────────────────────────────────────────────────

describe("Rolling 4-hour horizon", () => {
  it("next activity within +4h appears on the correct pitch", async () => {
    const startAt = new Date(NOW_UTC.getTime() + 3 * 60 * 60_000 + 30 * 60_000); // +3h30m
    const event = makeEvent({ pitchCode: "P-1", type: "TRAINING", homeAway: null, startAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("UPCOMING");
    expect(feed.pitches[0].nextEvent?.eventId).toBe("evt-test");
  });

  it("activity beyond +4h does not appear on the pitch", async () => {
    const startAt = new Date(NOW_UTC.getTime() + 4 * 60 * 60_000 + 60_000); // +4h1m
    const event = makeEvent({ pitchCode: "P-1", type: "TRAINING", homeAway: null, startAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("FREE_NOW");
    expect(feed.pitches[0].nextEvent).toBeNull();
  });

  it("activity exactly at the 4-hour boundary is included (inclusive)", async () => {
    const startAt = new Date(NOW_UTC.getTime() + 4 * 60 * 60_000); // exactly +4h
    const event = makeEvent({ pitchCode: "P-1", type: "TRAINING", homeAway: null, startAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].nextEvent?.eventId).toBe("evt-test");
  });

  it("an activity that started 6 hours ago and is still running remains current regardless of the horizon", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 6 * 60 * 60_000);
    const endAt = new Date(NOW_UTC.getTime() + 60 * 60_000);
    const event = makeEvent({ pitchCode: "P-1", startAt, endAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("OCCUPIED_NOW");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── HOME/AWAY behavior (shared publication policy, INFOBOARD_SCREEN_2) ──────
// ─────────────────────────────────────────────────────────────────────────────

describe("HOME/AWAY behavior", () => {
  it("a HOME match appears on its assigned pitch", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({ pitchCode: "P-ST", type: "MATCH", homeAway: "HOME", startAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-ST", "Stadion")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("OCCUPIED_NOW");
    expect(feed.pitches[0].currentEvent?.type).toBe("MATCH");
  });

  it("an AWAY match does not appear on any pitch (excluded by the shared publication policy)", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({ pitchCode: "P-ST", type: "MATCH", homeAway: "AWAY", startAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-ST", "Stadion")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("FREE_NOW");
    expect(feed.pitches[0].currentEvent).toBeNull();
  });

  it("an AWAY match does not appear in the unallocated section either", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    // No pitch allocation AND AWAY — must not leak into unallocated.
    const event = makeEvent({ type: "MATCH", homeAway: "AWAY", startAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      loader: makeLoader([event]),
    });
    expect(feed.unallocated).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Dressing-room allocation resolution ──────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Dressing-room allocation resolution", () => {
  it("training home dressing-room allocation resolves correctly", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({
      type: "TRAINING",
      homeAway: null,
      startAt,
      homeDressingRoomCode: "G3",
      teamName: "Juniorinnen FF-14",
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      dressingRooms: [makeDressingRoom("G3", "Kabine 3")],
      loader: makeLoader([event]),
    });
    expect(feed.dressingRooms[0].state).toBe("OCCUPIED_NOW");
    expect(feed.dressingRooms[0].current?.assignedTo).toBe("Juniorinnen FF-14");
    expect(feed.dressingRooms[0].current?.role).toBe("TRAINING");
  });

  it("match home + away dressing-room allocations resolve to distinct rooms", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({
      type: "MATCH",
      homeAway: "HOME",
      startAt,
      teamName: "FC Allschwil E1",
      opponentFallbackName: "FC Binningen E1",
      homeDressingRoomCode: "G1",
      awayDressingRoomCode: "G2",
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      dressingRooms: [makeDressingRoom("G1", "Kabine 1"), makeDressingRoom("G2", "Kabine 2")],
      loader: makeLoader([event]),
    });
    const home = feed.dressingRooms.find((r) => r.code === "G1");
    const away = feed.dressingRooms.find((r) => r.code === "G2");
    expect(home?.current?.assignedTo).toBe("FC Allschwil E1");
    expect(home?.current?.role).toBe("HOME");
    expect(away?.current?.assignedTo).toBe("FC Binningen E1");
    expect(away?.current?.role).toBe("AWAY");
  });

  it("missing dressing-room allocation is not invented — free state is returned", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      dressingRooms: [makeDressingRoom("G9", "Kabine 9")],
      loader: makeLoader([]),
    });
    expect(feed.dressingRooms[0].state).toBe("FREE_NOW");
    expect(feed.dressingRooms[0].current).toBeNull();
    expect(feed.dressingRooms[0].next).toBeNull();
  });

  it("a training with no dressing-room allocation never assigns it to a configured room", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({ type: "TRAINING", homeAway: null, startAt }); // no homeDressingRoomCode
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      dressingRooms: [makeDressingRoom("G1", "Kabine 1")],
      loader: makeLoader([event]),
    });
    expect(feed.dressingRooms[0].state).toBe("FREE_NOW");
  });

  it("chronological current/next selection per dressing room: current preferred, next only when free", async () => {
    const currentStart = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const nextStart = new Date(NOW_UTC.getTime() + 60 * 60_000);
    const currentEvent = makeEvent({
      id: "dr-current",
      type: "TRAINING",
      homeAway: null,
      startAt: currentStart,
      homeDressingRoomCode: "G1",
      teamName: "Team Now",
    });
    const nextEvent = makeEvent({
      id: "dr-next",
      type: "TRAINING",
      homeAway: null,
      startAt: nextStart,
      homeDressingRoomCode: "G1",
      teamName: "Team Later",
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      dressingRooms: [makeDressingRoom("G1", "Kabine 1")],
      loader: makeLoader([nextEvent, currentEvent]),
    });
    expect(feed.dressingRooms[0].current?.assignedTo).toBe("Team Now");
    // A room already occupied does not also surface a "next" slot in this MVP.
    expect(feed.dressingRooms[0].next).toBeNull();
  });

  it("dressing room with only an upcoming allocation within the horizon resolves to UPCOMING", async () => {
    const startAt = new Date(NOW_UTC.getTime() + 30 * 60_000);
    const event = makeEvent({
      type: "TRAINING",
      homeAway: null,
      startAt,
      homeDressingRoomCode: "G4",
      teamName: "Team Später",
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      dressingRooms: [makeDressingRoom("G4", "Kabine 4")],
      loader: makeLoader([event]),
    });
    expect(feed.dressingRooms[0].state).toBe("UPCOMING");
    expect(feed.dressingRooms[0].next?.assignedTo).toBe("Team Später");
  });

  it("multi-room ordering matches the configured dressing-room inventory order", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      dressingRooms: [makeDressingRoom("G3", "Kabine 3"), makeDressingRoom("G1", "Kabine 1")],
      loader: makeLoader([]),
    });
    expect(feed.dressingRooms.map((r) => r.code)).toEqual(["G3", "G1"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Unallocated activities (restrained — never fabricated) ──────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Unallocated activities", () => {
  it("an eligible activity with no pitch allocation appears in unallocated", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({ type: "TRAINING", homeAway: null, startAt, teamName: "Aktive Herren" });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.unallocated).toHaveLength(1);
    expect(feed.unallocated[0].teamDisplayName).toBe("Aktive Herren");
  });

  it("an activity allocated to a pitch outside the configured inventory appears in unallocated", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({ type: "TRAINING", homeAway: null, startAt, pitchCode: "P-UNKNOWN" });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.unallocated).toHaveLength(1);
  });

  it("an activity mapped to a configured pitch does not also appear in unallocated", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({ type: "TRAINING", homeAway: null, startAt, pitchCode: "P-1" });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.unallocated).toHaveLength(0);
  });

  it("unallocated is empty when there is nothing unmapped", async () => {
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([]),
    });
    expect(feed.unallocated).toEqual([]);
  });

  it("an unmapped activity beyond the 4-hour horizon does not appear in unallocated", async () => {
    const startAt = new Date(NOW_UTC.getTime() + 5 * 60 * 60_000);
    const event = makeEvent({ type: "TRAINING", homeAway: null, startAt });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      loader: makeLoader([event]),
    });
    expect(feed.unallocated).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Canonical Team.name-first naming ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Canonical Team.name-first naming", () => {
  it("pitch currentEvent.teamDisplayName resolves from Team.name (the only candidate the canonical loader ever populates)", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({
      pitchCode: "P-1",
      type: "TRAINING",
      homeAway: null,
      startAt,
      teamName: "FC Allschwil E1",
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].currentEvent?.teamDisplayName).toBe("FC Allschwil E1");
  });

  it("dressing-room assignedTo resolves from the same canonical Team.name", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({
      type: "TRAINING",
      homeAway: null,
      startAt,
      homeDressingRoomCode: "G1",
      teamName: "FC Allschwil E1",
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [],
      dressingRooms: [makeDressingRoom("G1", "Kabine 1")],
      loader: makeLoader([event]),
    });
    expect(feed.dressingRooms[0].current?.assignedTo).toBe("FC Allschwil E1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Multi-resource allocation (full-pitch / half-pitch) ──────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Multi-resource allocation", () => {
  it("an activity occupying two simultaneous pitch codes appears on both configured pitches", async () => {
    const startAt = new Date(NOW_UTC.getTime() - 10 * 60_000);
    const event = makeEvent({
      type: "TRAINING",
      homeAway: null,
      startAt,
      pitchCodes: ["KR2_A", "KR2_B"],
    });
    const feed = await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("KR2_A", "Kunstrasen 2 A"), makePitch("KR2_B", "Kunstrasen 2 B")],
      loader: makeLoader([event]),
    });
    expect(feed.pitches[0].state).toBe("OCCUPIED_NOW");
    expect(feed.pitches[1].state).toBe("OCCUPIED_NOW");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Tenant isolation (dressing rooms + unallocated) ──────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("Tenant isolation — dressing rooms and unallocated", () => {
  it("the loader only ever receives the caller-supplied tenantId, regardless of section", async () => {
    let capturedTenantId: string | undefined;
    const loader: PublicationEventLoader<Screen1SourceEvent> = async (input) => {
      capturedTenantId = input.tenantId;
      return [];
    };
    await buildInfoboardScreen2Feed({
      tenant: TEST_TENANT,
      timeZone: ZURICH_TZ,
      now: NOW_UTC,
      pitches: [makePitch("P-1", "Platz 1")],
      dressingRooms: [makeDressingRoom("G1", "Kabine 1")],
      loader,
    });
    expect(capturedTenantId).toBe(TEST_TENANT.id);
  });
});
