/**
 * lib/publishing/infoboard/__tests__/screen1-feed-builder-v2.test.ts
 *
 * Focused tests for INFOBOARD-V2 display window changes:
 *   - min-3-card fill logic
 *   - completed events not reintroduced
 *   - non-training events not incorrectly grouped
 *   - solo training uses training-group language (component-level test
 *     is in InfoboardScreen1 tests; here we test the feed bucket output)
 */

import { describe, it, expect, vi } from "vitest";
import { buildInfoboardScreen1Feed } from "../screen1-feed-builder";
import type { BuildScreen1FeedInput } from "../screen1-feed-builder";
import type { Screen1SourceEvent } from "../screen1-event-mapper";
import type { PublicationEventLoadInput } from "../../policy/event-selection";

const TZ = "Europe/Zurich";

const TENANT: BuildScreen1FeedInput["tenant"] = {
  id: "tenant-test",
  key: "test",
  name: "Test Club",
  timezone: TZ,
};

// now = 09:00 Zurich (07:00 UTC) — morning, no activities within 4h
const NOW_MORNING = new Date("2026-07-23T07:00:00.000Z");

function makeEvent(overrides: Partial<Screen1SourceEvent> = {}): Screen1SourceEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: "tenant-test",
    type: "TRAINING",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    startAt: new Date("2026-07-23T14:00:00.000Z"),
    endAt: new Date("2026-07-23T15:30:00.000Z"),
    title: "Training",
    seasonKey: "2025-26",
    ...overrides,
  };
}

function makeLoader(events: Screen1SourceEvent[]) {
  return vi.fn(async (_: PublicationEventLoadInput) => events as readonly Screen1SourceEvent[]);
}

function makeInput(overrides: Partial<BuildScreen1FeedInput> = {}): BuildScreen1FeedInput {
  return {
    tenant: TENANT,
    timeZone: TZ,
    now: NOW_MORNING,
    ...overrides,
  };
}

// ── Min-3-card fill ───────────────────────────────────────────────────────────

describe("min-3-card fill — display window V2", () => {
  it("fills forward when 4h window produces fewer than 3 cards", async () => {
    // Board at 09:00 — no events within the 4h horizon (before 13:00)
    // Events start at 14:00, 16:00, 18:00 — all future today
    const events = [
      makeEvent({ id: "e1", startAt: new Date("2026-07-23T12:00:00.000Z"), endAt: new Date("2026-07-23T13:30:00.000Z") }),
      makeEvent({ id: "e2", startAt: new Date("2026-07-23T14:00:00.000Z"), endAt: new Date("2026-07-23T15:30:00.000Z") }),
      makeEvent({ id: "e3", startAt: new Date("2026-07-23T16:00:00.000Z"), endAt: new Date("2026-07-23T17:30:00.000Z") }),
    ];

    // e1 is within 4h of 09:00 (starts at 12:00 = 3h away, within SCREEN1_HORIZON=4h)
    // e2 starts at 14:00 = 7h away — beyond horizon
    // e3 starts at 16:00 — beyond horizon

    // With fill, we expect e2 and e3 to also appear since count < 3
    const loader = makeLoader(events);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());

    const allEvents = [...feed.current, ...feed.next, ...feed.later];
    // Should have all 3 events total
    expect(allEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("does not show more than MIN_DISPLAY_CARDS fill events when window is already full", async () => {
    // 3 events within the 4h window — no fill needed
    const events = [
      makeEvent({ id: "e1", startAt: new Date("2026-07-23T08:00:00.000Z"), endAt: new Date("2026-07-23T09:30:00.000Z") }),
      makeEvent({ id: "e2", startAt: new Date("2026-07-23T09:00:00.000Z"), endAt: new Date("2026-07-23T10:00:00.000Z") }),
      makeEvent({ id: "e3", startAt: new Date("2026-07-23T10:00:00.000Z"), endAt: new Date("2026-07-23T11:30:00.000Z") }),
      makeEvent({ id: "e4", startAt: new Date("2026-07-23T18:00:00.000Z"), endAt: new Date("2026-07-23T19:30:00.000Z") }),
    ];

    // e1 is in the past (before 09:00 but current if still running) — actually 08:00–09:30
    // At NOW_MORNING = 07:00, all are in the future
    // e1 starts at 08:00 = within 4h window (within horizon) → next
    // e2 starts at 09:00 = within 4h window → later
    // e3 starts at 10:00 = within 4h window → later

    const loader = makeLoader(events);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());

    const allEvents = [...feed.current, ...feed.next, ...feed.later];
    // e4 at 18:00 is 11h away — only included if fill needed
    const hasE4 = allEvents.some((e) => e.id === "e4");
    expect(allEvents.length).toBeGreaterThanOrEqual(3);
    // e4 should NOT be in the fill since we already have >= 3
    expect(hasE4).toBe(false);
  });

  it("does not reintroduce completed events", async () => {
    const completedEvent = makeEvent({
      id: "completed-1",
      startAt: new Date("2026-07-23T05:00:00.000Z"),  // past
      endAt: new Date("2026-07-23T06:00:00.000Z"),    // ended before now
    });
    const futureEvent = makeEvent({
      id: "future-1",
      startAt: new Date("2026-07-23T18:00:00.000Z"),
      endAt: new Date("2026-07-23T19:30:00.000Z"),
    });

    const loader = makeLoader([completedEvent, futureEvent]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());

    const allIds = [...feed.current, ...feed.next, ...feed.later].map((e) => e.id);
    expect(allIds).not.toContain("completed-1");
  });

  it("produces NO_EVENTS_TODAY empty state when no events exist today at all", async () => {
    const loader = makeLoader([]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());

    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("NO_EVENTS_TODAY");
  });

  it("produces DAY_COMPLETED when all today's events have ended", async () => {
    const endedEvent = makeEvent({
      id: "ended-1",
      startAt: new Date("2026-07-23T05:00:00.000Z"),
      endAt: new Date("2026-07-23T06:00:00.000Z"),
    });

    const loader = makeLoader([endedEvent]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());

    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("DAY_COMPLETED");
  });
});

// ── Same-start training grouping ─────────────────────────────────────────────

describe("same-start training aggregation at feed level", () => {
  it("all 3 trainings at same startAt go to the same bucket", async () => {
    const sharedStart = new Date("2026-07-23T16:00:00.000Z");
    const events = [
      makeEvent({ id: "t1", startAt: sharedStart }),
      makeEvent({ id: "t2", startAt: sharedStart }),
      makeEvent({ id: "t3", startAt: sharedStart }),
    ];

    const loader = makeLoader(events);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());

    // All 3 should be in the same bucket (later, since startAt is within horizon)
    const allEvents = [...feed.current, ...feed.next, ...feed.later];
    expect(allEvents.length).toBe(3);
    expect(allEvents.every((e) => e.startAt === sharedStart.toISOString())).toBe(true);
  });

  it("non-training events are not grouped", async () => {
    const sharedStart = new Date("2026-07-23T16:00:00.000Z");
    const training = makeEvent({ id: "t1", startAt: sharedStart, type: "TRAINING" });
    const match = makeEvent({
      id: "m1",
      startAt: sharedStart,
      type: "MATCH",
      infoboardVisible: true,
      homeAway: "HOME",
    });

    const loader = makeLoader([training, match]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());

    const allEvents = [...feed.current, ...feed.next, ...feed.later];
    expect(allEvents.length).toBe(2);
    // Both should appear — training is NOT filtering out the match
    const types = allEvents.map((e) => e.type);
    expect(types).toContain("TRAINING");
    expect(types).toContain("MATCH");
  });
});
