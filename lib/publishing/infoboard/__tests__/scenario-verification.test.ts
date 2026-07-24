/**
 * lib/publishing/infoboard/__tests__/scenario-verification.test.ts
 *
 * Verification of Phase J scenarios using the canonical feed service.
 * Confirms expected behavior for the key real-world scenarios.
 */

import { describe, it, expect } from "vitest";
import { buildInfoboardScreen1Feed } from "../screen1-feed-builder";
import type { BuildScreen1FeedInput } from "../screen1-feed-builder";
import type { Screen1SourceEvent } from "../screen1-event-mapper";

const TZ = "Europe/Zurich";
const TENANT: BuildScreen1FeedInput["tenant"] = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: TZ,
};

function makeEvent(
  id: string,
  startAt: Date,
  endAt: Date,
  type: "TRAINING" | "MATCH" | "TOURNAMENT" = "TRAINING",
): Screen1SourceEvent {
  return {
    id,
    tenantId: "tenant-fca",
    type,
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: type === "MATCH" ? "HOME" : null,
    startAt,
    endAt,
    title: `Event ${id}`,
    seasonKey: "2025-26",
  };
}

function makeLoader(events: Screen1SourceEvent[]) {
  return async () => events as readonly Screen1SourceEvent[];
}

// SCENARIO 1: Before first event (08:00 Zurich = 06:00 UTC)
// Events at 17:00 (15:00 UTC), 19:00 (17:00 UTC), 22:30 (20:30 UTC)
describe("SCENARIO 1 — Before first event", () => {
  const now = new Date("2026-07-25T06:00:00.000Z"); // 08:00 Zurich
  const events = [
    makeEvent("17h", new Date("2026-07-25T15:00:00.000Z"), new Date("2026-07-25T16:45:00.000Z"), "MATCH"),
    makeEvent("19h", new Date("2026-07-25T17:00:00.000Z"), new Date("2026-07-25T18:30:00.000Z"), "TRAINING"),
    makeEvent("22h30", new Date("2026-07-25T20:30:00.000Z"), new Date("2026-07-25T22:00:00.000Z"), "TRAINING"),
  ];

  it("no active group", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.current).toHaveLength(0);
  });

  it("17:00 and 19:00 shown as next events (next 2)", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.next).toHaveLength(2);
    expect(feed.next.some(e => e.id === "17h")).toBe(true);
    expect(feed.next.some(e => e.id === "19h")).toBe(true);
  });

  it("22:30 not selected (goes to later)", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.later.some(e => e.id === "22h30")).toBe(true);
  });

  it("dashboard and public screen1 show identical event IDs", async () => {
    const input = { tenant: TENANT, timeZone: TZ, now };
    const dashFeed = await buildInfoboardScreen1Feed(makeLoader(events), input);
    const screenFeed = await buildInfoboardScreen1Feed(makeLoader(events), input);

    const dashIds = [...dashFeed.current, ...dashFeed.next, ...dashFeed.later].map(e => e.id);
    const screenIds = [...screenFeed.current, ...screenFeed.next, ...screenFeed.later].map(e => e.id);
    expect(dashIds).toEqual(screenIds);
  });
});

// SCENARIO 2: Large gap (12:00 Zurich = 10:00 UTC, next event at 17:00 Zurich = 15:00 UTC)
describe("SCENARIO 2 — Large gap (12:00 Zurich, next event 5h later at 17:00)", () => {
  const now = new Date("2026-07-25T10:00:00.000Z"); // 12:00 Zurich
  const events = [
    makeEvent("17h", new Date("2026-07-25T15:00:00.000Z"), new Date("2026-07-25T16:45:00.000Z"), "MATCH"),
  ];

  it("17:00 event is still shown (no cutoff)", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.isEmpty).toBe(false);
    expect(feed.next.some(e => e.id === "17h")).toBe(true);
  });
});

// SCENARIO 3: Active event at 17:30 with match 17:00–18:45
describe("SCENARIO 3 — Active event at 17:30", () => {
  const now = new Date("2026-07-25T15:30:00.000Z"); // 17:30 Zurich
  const events = [
    makeEvent("match-17h", new Date("2026-07-25T15:00:00.000Z"), new Date("2026-07-25T16:45:00.000Z"), "MATCH"),
    makeEvent("training-19h", new Date("2026-07-25T17:00:00.000Z"), new Date("2026-07-25T18:30:00.000Z"), "TRAINING"),
    makeEvent("training-21h", new Date("2026-07-25T19:00:00.000Z"), new Date("2026-07-25T20:30:00.000Z"), "TRAINING"),
  ];

  it("current match is shown under current (Jetzt)", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.current.some(e => e.id === "match-17h")).toBe(true);
  });

  it("next 2 upcoming events are shown", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.next).toHaveLength(2);
    expect(feed.next.some(e => e.id === "training-19h")).toBe(true);
    expect(feed.next.some(e => e.id === "training-21h")).toBe(true);
  });
});

// SCENARIO 4: After final event (23:45 Zurich = 21:45 UTC)
describe("SCENARIO 4 — After final event (23:45 Zurich)", () => {
  const now = new Date("2026-07-25T21:45:00.000Z"); // 23:45 Zurich
  const events = [
    makeEvent("17h", new Date("2026-07-25T15:00:00.000Z"), new Date("2026-07-25T16:45:00.000Z"), "MATCH"),
    makeEvent("19h", new Date("2026-07-25T17:00:00.000Z"), new Date("2026-07-25T18:30:00.000Z"), "TRAINING"),
  ];

  it("no cards rendered (isEmpty)", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.isEmpty).toBe(true);
  });

  it("emptyStateReason is DAY_COMPLETED", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.emptyStateReason).toBe("DAY_COMPLETED");
  });
});

// SCENARIO 5a: Day boundary (23:55 Zurich — tomorrow's events not shown)
describe("SCENARIO 5 — Day boundary (23:55 Zurich)", () => {
  const now = new Date("2026-07-25T21:55:00.000Z"); // 23:55 Zurich
  const events = [
    // Tomorrow's event: 2026-07-26 at 17:00 Zurich = 15:00 UTC
    makeEvent("tomorrow-17h", new Date("2026-07-26T15:00:00.000Z"), new Date("2026-07-26T16:45:00.000Z"), "MATCH"),
  ];

  it("tomorrow's events are not shown", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some(e => e.id === "tomorrow-17h")).toBe(false);
  });
});
