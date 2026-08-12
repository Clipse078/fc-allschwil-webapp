/**
 * lib/publishing/infoboard/__tests__/scenario-verification.test.ts
 *
 * Verification of real-world scenarios for Infoboard Screen 1's rolling
 * operational window (INFOBOARD-INTEGRATION-01B-C1): current activities plus
 * upcoming activities starting within the next ~4 hours.
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
    homeAway: type === "MATCH" || type === "TOURNAMENT" ? "HOME" : null,
    startAt,
    endAt,
    title: `Event ${id}`,
    seasonKey: "2025-26",
  };
}

function makeLoader(events: Screen1SourceEvent[]) {
  return async () => events as readonly Screen1SourceEvent[];
}

// SCENARIO 1: Rolling 4-hour horizon — events within the horizon are shown,
// events beyond it are excluded.
// now = 08:00 Zurich (06:00 UTC).
describe("SCENARIO 1 — rolling 4-hour horizon", () => {
  const now = new Date("2026-07-25T06:00:00.000Z"); // 08:00 Zurich
  const events = [
    // 09:00 Zurich = 07:00 UTC — 1h from now, within horizon.
    makeEvent("in1h", new Date("2026-07-25T07:00:00.000Z"), new Date("2026-07-25T08:30:00.000Z")),
    // 11:30 Zurich = 09:30 UTC — 3.5h from now, within horizon.
    makeEvent("in3h30", new Date("2026-07-25T09:30:00.000Z"), new Date("2026-07-25T11:00:00.000Z")),
    // 13:30 Zurich = 11:30 UTC — 5.5h from now, beyond the 4-hour horizon.
    makeEvent("in5h30", new Date("2026-07-25T11:30:00.000Z"), new Date("2026-07-25T13:00:00.000Z")),
  ];

  it("no active group", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.current).toHaveLength(0);
  });

  it("event 1h away is visible (earliest upcoming → next)", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.next.some((e) => e.id === "in1h")).toBe(true);
  });

  it("event 3.5h away is visible (within the 4-hour horizon → later)", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.later.some((e) => e.id === "in3h30")).toBe(true);
  });

  it("event 5.5h away is now filled in when window has fewer than 3 events (V2 fill)", async () => {
    // INFOBOARD-V2: in1h + in3h30 are in the 4h window (2 events < MIN=3) → in5h30 is filled.
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "in5h30")).toBe(true);
  });

  it("chronological ordering is preserved across next + later (including fill events)", async () => {
    // INFOBOARD-V2: in5h30 is now included via fill, so ordering covers all 3 events.
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    const orderedIds = [...feed.next, ...feed.later].map((e) => e.id);
    expect(orderedIds).toEqual(["in1h", "in3h30", "in5h30"]);
  });

  it("dashboard and public screen1 show identical event IDs", async () => {
    const input = { tenant: TENANT, timeZone: TZ, now };
    const dashFeed = await buildInfoboardScreen1Feed(makeLoader(events), input);
    const screenFeed = await buildInfoboardScreen1Feed(makeLoader(events), input);

    const dashIds = [...dashFeed.current, ...dashFeed.next, ...dashFeed.later].map((e) => e.id);
    const screenIds = [...screenFeed.current, ...screenFeed.next, ...screenFeed.later].map((e) => e.id);
    expect(dashIds).toEqual(screenIds);
  });
});

// SCENARIO 2: The 4-hour boundary itself, and just beyond it.
describe("SCENARIO 2 — 4-hour boundary", () => {
  const now = new Date("2026-07-25T10:00:00.000Z"); // 12:00 Zurich

  it("event starting exactly 4 hours from now is included (inclusive boundary)", async () => {
    const exactlyFourHours = makeEvent(
      "exactly-4h",
      new Date("2026-07-25T14:00:00.000Z"),
      new Date("2026-07-25T15:30:00.000Z"),
    );
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([exactlyFourHours]),
      { tenant: TENANT, timeZone: TZ, now },
    );
    expect(feed.isEmpty).toBe(false);
    const all = [...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "exactly-4h")).toBe(true);
  });

  it("event starting just beyond 4 hours from now is now filled in (V2: fill applies when < 3 cards)", async () => {
    // INFOBOARD-V2: 0 events in the 4h window → fill adds this today-future event.
    const justBeyond = makeEvent(
      "just-beyond-4h",
      new Date("2026-07-25T14:00:01.000Z"),
      new Date("2026-07-25T15:30:00.000Z"),
    );
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([justBeyond]),
      { tenant: TENANT, timeZone: TZ, now },
    );
    expect(feed.isEmpty).toBe(false);
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "just-beyond-4h")).toBe(true);
  });

  it("event 5 hours away is now filled in via V2 fill (no longer excluded)", async () => {
    // INFOBOARD-V2: 0 events in the 4h window → fill adds this today-future event.
    // Under the V1 strict cutoff this was excluded; V2 includes it to reach MIN=3.
    const fiveHoursAway = makeEvent(
      "5h-away",
      new Date("2026-07-25T15:00:00.000Z"),
      new Date("2026-07-25T16:45:00.000Z"),
      "MATCH",
    );
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([fiveHoursAway]),
      { tenant: TENANT, timeZone: TZ, now },
    );
    expect(feed.isEmpty).toBe(false);
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "5h-away")).toBe(true);
  });
});

// SCENARIO 3: An active event plus multiple upcoming activities within the
// rolling horizon.
describe("SCENARIO 3 — active event alongside upcoming activities within the horizon", () => {
  const now = new Date("2026-07-25T15:30:00.000Z"); // 17:30 Zurich
  const events = [
    makeEvent("match-17h", new Date("2026-07-25T15:00:00.000Z"), new Date("2026-07-25T16:45:00.000Z"), "MATCH"),
    // 1.5h from now — within horizon.
    makeEvent("training-19h", new Date("2026-07-25T17:00:00.000Z"), new Date("2026-07-25T18:30:00.000Z")),
    // 3.5h from now — within horizon.
    makeEvent("training-21h", new Date("2026-07-25T19:00:00.000Z"), new Date("2026-07-25T20:30:00.000Z")),
  ];

  it("current match is shown under current (Jetzt)", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.current.some((e) => e.id === "match-17h")).toBe(true);
  });

  it("both upcoming activities within the 4-hour horizon are visible, in order", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    const upcoming = [...feed.next, ...feed.later].map((e) => e.id);
    expect(upcoming).toEqual(["training-19h", "training-21h"]);
  });

  it("earliest upcoming activity is highlighted as next, the other as later", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), { tenant: TENANT, timeZone: TZ, now });
    expect(feed.next.map((e) => e.id)).toEqual(["training-19h"]);
    expect(feed.later.map((e) => e.id)).toEqual(["training-21h"]);
  });
});

// SCENARIO 4: An activity that started well before the rolling horizon began,
// but is still running, must remain visible until it ends.
describe("SCENARIO 4 — active activity survives the rolling-window cutoff", () => {
  it("an activity that started 6 hours ago and is still running remains visible", async () => {
    const now = new Date("2026-07-25T15:00:00.000Z"); // 17:00 Zurich
    const longRunning = makeEvent(
      "long-running",
      new Date("2026-07-25T09:00:00.000Z"), // started 6h ago
      new Date("2026-07-25T20:00:00.000Z"), // still running for 5 more hours
    );
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([longRunning]),
      { tenant: TENANT, timeZone: TZ, now },
    );
    expect(feed.current.some((e) => e.id === "long-running")).toBe(true);
    expect(feed.isEmpty).toBe(false);
  });
});

// SCENARIO 5: After the final event of the day.
describe("SCENARIO 5 — after final event", () => {
  const now = new Date("2026-07-25T21:45:00.000Z"); // 23:45 Zurich
  const events = [
    makeEvent("17h", new Date("2026-07-25T15:00:00.000Z"), new Date("2026-07-25T16:45:00.000Z"), "MATCH"),
    makeEvent("19h", new Date("2026-07-25T17:00:00.000Z"), new Date("2026-07-25T18:30:00.000Z")),
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

// SCENARIO 6: Timezone-safe rolling horizon — the 4-hour window is measured
// from `now`, not from the tenant-local calendar day, so it correctly spans
// a local-midnight boundary.
describe("SCENARIO 6 — timezone-safe rolling horizon across a local-midnight boundary", () => {
  const now = new Date("2026-07-25T21:55:00.000Z"); // 23:55 Zurich

  it("tomorrow's event far outside the horizon is not shown", async () => {
    const tomorrowFar = makeEvent(
      "tomorrow-17h",
      new Date("2026-07-26T15:00:00.000Z"),
      new Date("2026-07-26T16:45:00.000Z"),
      "MATCH",
    );
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([tomorrowFar]),
      { tenant: TENANT, timeZone: TZ, now },
    );
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "tomorrow-17h")).toBe(false);
  });

  it("an event 1h05m away, on the next tenant-local calendar day, is still shown", async () => {
    // now = 23:55 Zurich (21:55 UTC). An event at 01:00 Zurich the next day
    // is only 1h05m away — well within the 4-hour horizon — even though it
    // falls on the next tenant-local calendar day.
    const justAfterMidnight = makeEvent(
      "just-after-midnight",
      new Date("2026-07-25T23:00:00.000Z"), // 01:00 Zurich Jul 26
      new Date("2026-07-26T00:30:00.000Z"),
    );
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([justAfterMidnight]),
      { tenant: TENANT, timeZone: TZ, now },
    );
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "just-after-midnight")).toBe(true);
  });
});
