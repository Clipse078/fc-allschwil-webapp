/**
 * lib/publishing/infoboard/__tests__/screen1-feed-builder.test.ts
 *
 * Integration tests for buildInfoboardScreen1Feed.
 *
 * Uses plain test objects and an injected loader function. No DB, no Prisma,
 * no environment access.
 *
 * Tests cover:
 *   - Loader contract (called once, parameters forwarded correctly)
 *   - Publication policy integration (representative boundary cases only)
 *   - Temporal grouping (current / next / later / omission)
 *   - Timezone boundaries (Swiss UTC+2 example)
 *   - Feed metadata
 *   - Mapping integration (naming, allocation)
 *   - Immutability
 *   - Empty states
 *   - Error propagation
 */

import { describe, it, expect, vi } from "vitest";
import { buildInfoboardScreen1Feed } from "../screen1-feed-builder";
import type { BuildScreen1FeedInput } from "../screen1-feed-builder";
import type { Screen1SourceEvent } from "../screen1-event-mapper";
import type { PublicationEventLoadInput } from "../../policy/event-selection";

// ── Constants ─────────────────────────────────────────────────────────────────

const TZ_ZURICH = "Europe/Zurich";
const TZ_UTC = "UTC";

const TENANT: BuildScreen1FeedInput["tenant"] = {
  id: "tenant-fca",
  key: "fca",
  name: "FC Allschwil",
  timezone: TZ_ZURICH,
};

// Reference "now": 2026-07-23 16:00:00 UTC (18:00 local in Zurich, UTC+2)
const NOW = new Date("2026-07-23T16:00:00.000Z");

// ── Event factory ─────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<Screen1SourceEvent> = {}): Screen1SourceEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    tenantId: "tenant-fca",
    type: "TRAINING",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    startAt: new Date("2026-07-23T17:00:00.000Z"),  // 19:00 Zurich — future today
    endAt: new Date("2026-07-23T18:30:00.000Z"),
    title: "Training",
    seasonKey: "2025-26",
    ...overrides,
  };
}

function makeLoader(events: Screen1SourceEvent[]) {
  return vi.fn(async (_input: PublicationEventLoadInput) => events as readonly Screen1SourceEvent[]);
}

function makeInput(overrides: Partial<BuildScreen1FeedInput> = {}): BuildScreen1FeedInput {
  return {
    tenant: TENANT,
    timeZone: TZ_ZURICH,
    now: NOW,
    ...overrides,
  };
}

// ── Loader behavior ───────────────────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — loader behavior", () => {
  it("calls the loader exactly once", async () => {
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput());
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("forwards tenantId to the loader", async () => {
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput());
    expect(loader.mock.calls[0][0].tenantId).toBe("tenant-fca");
  });

  it("forwards dateFrom to the loader when supplied", async () => {
    const dateFrom = new Date("2026-07-23T00:00:00.000Z");
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput({ dateFrom }));
    expect(loader.mock.calls[0][0].dateFrom).toBe(dateFrom);
  });

  it("forwards dateTo to the loader when supplied", async () => {
    const dateTo = new Date("2026-07-23T23:59:59.000Z");
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput({ dateTo }));
    expect(loader.mock.calls[0][0].dateTo).toBe(dateTo);
  });

  it("forwards seasonKey to the loader when supplied", async () => {
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput({ seasonKey: "2025-26" }));
    expect(loader.mock.calls[0][0].seasonKey).toBe("2025-26");
  });

  it("forwards teamSlug to the loader when supplied", async () => {
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput({ teamSlug: "u17-junioren" }));
    expect(loader.mock.calls[0][0].teamSlug).toBe("u17-junioren");
  });

  it("does not forward channel to the loader", async () => {
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput());
    const loadInput = loader.mock.calls[0][0];
    expect(loadInput).not.toHaveProperty("channel");
  });

  it("does not forward timezone to the loader", async () => {
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput());
    const loadInput = loader.mock.calls[0][0];
    expect(loadInput).not.toHaveProperty("timezone");
    expect(loadInput).not.toHaveProperty("timeZone");
  });

  it("does not forward now to the loader", async () => {
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput());
    const loadInput = loader.mock.calls[0][0];
    expect(loadInput).not.toHaveProperty("now");
  });

  it("does not forward tenant display metadata to the loader", async () => {
    const loader = makeLoader([]);
    await buildInfoboardScreen1Feed(loader, makeInput());
    const loadInput = loader.mock.calls[0][0];
    expect(loadInput).not.toHaveProperty("tenant");
    expect(loadInput).not.toHaveProperty("tenantKey");
    expect(loadInput).not.toHaveProperty("tenantName");
  });

  it("propagates loader errors unchanged", async () => {
    const loaderError = new Error("DB connection failed");
    const loader = vi.fn(async () => { throw loaderError; });
    await expect(
      buildInfoboardScreen1Feed(loader, makeInput()),
    ).rejects.toBe(loaderError);
  });

  it("does not produce a partial feed after loader failure", async () => {
    const loader = vi.fn(async () => { throw new Error("timeout"); });
    let result: unknown = undefined;
    try {
      result = await buildInfoboardScreen1Feed(loader, makeInput());
    } catch {
      // expected
    }
    expect(result).toBeUndefined();
  });
});

// ── Publication policy integration ────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — publication policy integration", () => {
  it("includes a visible training", async () => {
    const training = makeEvent({ type: "TRAINING", infoboardVisible: true, homeAway: null });
    const loader = makeLoader([training]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === training.id)).toBe(true);
  });

  it("excludes a hidden training", async () => {
    const training = makeEvent({ type: "TRAINING", infoboardVisible: false });
    const loader = makeLoader([training]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === training.id)).toBe(false);
  });

  it("includes a visible home match", async () => {
    const match = makeEvent({ type: "MATCH", homeAway: "HOME", infoboardVisible: true });
    const loader = makeLoader([match]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === match.id)).toBe(true);
  });

  it("excludes an away match", async () => {
    const match = makeEvent({ type: "MATCH", homeAway: "AWAY", infoboardVisible: true });
    const loader = makeLoader([match]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === match.id)).toBe(false);
  });

  it("excludes a match with unknown homeAway", async () => {
    const match = makeEvent({ type: "MATCH", homeAway: null, infoboardVisible: true });
    const loader = makeLoader([match]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === match.id)).toBe(false);
  });

  it("includes a visible tournament", async () => {
    const tournament = makeEvent({ type: "TOURNAMENT", homeAway: null, infoboardVisible: true });
    const loader = makeLoader([tournament]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === tournament.id)).toBe(true);
  });

  it("excludes OTHER type events", async () => {
    // OTHER is not in the allowed infoboard types
    const other = makeEvent({ type: "OTHER" as Screen1SourceEvent["type"] });
    const loader = makeLoader([other as Screen1SourceEvent]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === other.id)).toBe(false);
  });

  it("excludes DRAFT status events", async () => {
    const event = makeEvent({ status: "DRAFT" as Screen1SourceEvent["status"] });
    const loader = makeLoader([event as Screen1SourceEvent]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === event.id)).toBe(false);
  });

  it("excludes CANCELLED status events", async () => {
    const event = makeEvent({ status: "CANCELLED" });
    const loader = makeLoader([event]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === event.id)).toBe(false);
  });

  it("excludes ARCHIVED status events", async () => {
    const event = makeEvent({ status: "ARCHIVED" as Screen1SourceEvent["status"] });
    const loader = makeLoader([event as Screen1SourceEvent]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === event.id)).toBe(false);
  });

  it("excludes events from a different tenant", async () => {
    const event = makeEvent({ tenantId: "other-tenant" });
    const loader = makeLoader([event]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === event.id)).toBe(false);
  });

  it("website visibility does not affect Screen 1 eligibility", async () => {
    const training = makeEvent({ type: "TRAINING", infoboardVisible: true, websiteVisible: false });
    const loader = makeLoader([training]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === training.id)).toBe(true);
  });

  it("trainingsplan visibility does not affect Screen 1 eligibility", async () => {
    const training = makeEvent({ type: "TRAINING", infoboardVisible: true, trainingsplanVisible: false });
    const loader = makeLoader([training]);
    const feed = await buildInfoboardScreen1Feed(loader, makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === training.id)).toBe(true);
  });
});

// ── Temporal grouping ─────────────────────────────────────────────────────────
// now = 2026-07-23T16:00:00.000Z (18:00 Zurich)
// today in Zurich = 2026-07-23

describe("buildInfoboardScreen1Feed — temporal grouping", () => {
  it("active event (started before now, ends after now) appears in current", async () => {
    const event = makeEvent({
      id: "active-evt",
      startAt: new Date("2026-07-23T14:00:00.000Z"),  // started 2h ago
      endAt: new Date("2026-07-23T17:30:00.000Z"),    // ends 1.5h from now
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    expect(feed.current.some((e) => e.id === "active-evt")).toBe(true);
    expect(feed.next.some((e) => e.id === "active-evt")).toBe(false);
    expect(feed.later.some((e) => e.id === "active-evt")).toBe(false);
  });

  it("event whose effective end is exactly now is not current", async () => {
    // Event ended exactly at now: endAt === now → effectiveEnd <= now → excluded
    const event = makeEvent({
      id: "ended-exactly-now",
      startAt: new Date("2026-07-23T14:30:00.000Z"),
      endAt: NOW,  // exactly now
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "ended-exactly-now")).toBe(false);
  });

  it("null endAt uses type-default duration for classification", async () => {
    // TRAINING default = 90 min; startAt = 15:30 UTC → effective end = 17:00 UTC > now (16:00)
    const event = makeEvent({
      id: "null-end",
      type: "TRAINING",
      startAt: new Date("2026-07-23T14:30:00.000Z"),  // started 1.5h ago
      endAt: null,  // uses 90-min default → effective end 16:00 UTC = now → excluded
    });
    // 14:30 + 90min = 16:00 UTC = now → effectiveEnd <= now → excluded
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "null-end")).toBe(false);
  });

  it("null endAt training started 30min ago is still current (effective end is 60min away)", async () => {
    // TRAINING default = 90 min; startAt = 15:30 UTC → effective end = 17:00 UTC > now (16:00)
    const event = makeEvent({
      id: "current-via-default",
      type: "TRAINING",
      startAt: new Date("2026-07-23T15:30:00.000Z"),  // 30 min ago
      endAt: null,  // effective end = 15:30 + 90min = 17:00 UTC > 16:00
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    expect(feed.current.some((e) => e.id === "current-via-default")).toBe(true);
  });

  it("completed time window is omitted even when status is publishable", async () => {
    // SCHEDULED status, but event ended before now
    const event = makeEvent({
      id: "already-ended",
      status: "SCHEDULED",
      startAt: new Date("2026-07-23T12:00:00.000Z"),
      endAt: new Date("2026-07-23T13:30:00.000Z"),    // ended 2.5h ago
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "already-ended")).toBe(false);
  });

  it("single future-today event appears in next", async () => {
    const event = makeEvent({
      id: "next-evt",
      startAt: new Date("2026-07-23T17:00:00.000Z"),  // 19:00 Zurich — future today
      endAt: new Date("2026-07-23T18:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    expect(feed.next.some((e) => e.id === "next-evt")).toBe(true);
    expect(feed.current.some((e) => e.id === "next-evt")).toBe(false);
    expect(feed.later.some((e) => e.id === "next-evt")).toBe(false);
  });

  it("simultaneous earliest-start events all appear in next", async () => {
    const sameStart = new Date("2026-07-23T17:00:00.000Z");
    const event1 = makeEvent({ id: "next-a", startAt: sameStart, endAt: new Date("2026-07-23T18:30:00.000Z") });
    const event2 = makeEvent({ id: "next-b", startAt: sameStart, endAt: new Date("2026-07-23T18:30:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event1, event2]), makeInput());
    expect(feed.next.some((e) => e.id === "next-a")).toBe(true);
    expect(feed.next.some((e) => e.id === "next-b")).toBe(true);
  });

  it("two future events with different start times: earliest is next, the other is later (both within horizon)", async () => {
    // now = 16:00 UTC. Both events start within the 4-hour rolling horizon.
    const early = makeEvent({ id: "next-evt", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:30:00.000Z") });
    const late = makeEvent({ id: "next-evt-2", startAt: new Date("2026-07-23T18:30:00.000Z"), endAt: new Date("2026-07-23T20:00:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([early, late]), makeInput());
    expect(feed.next.map((e) => e.id)).toEqual(["next-evt"]);
    expect(feed.later.map((e) => e.id)).toEqual(["next-evt-2"]);
  });

  it("a 3rd upcoming event within the horizon appears in later, not in next", async () => {
    // e1/e2/e3 are all within the 4-hour rolling horizon of now (16:00 UTC).
    const e1 = makeEvent({ id: "e1", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:00:00.000Z") });
    const e2 = makeEvent({ id: "e2", startAt: new Date("2026-07-23T18:00:00.000Z"), endAt: new Date("2026-07-23T19:00:00.000Z") });
    const e3 = makeEvent({ id: "e3", startAt: new Date("2026-07-23T19:00:00.000Z"), endAt: new Date("2026-07-23T20:30:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([e1, e2, e3]), makeInput());
    expect(feed.next.map((e) => e.id)).toEqual(["e1"]);
    expect(feed.later.map((e) => e.id)).toEqual(["e2", "e3"]);
  });

  it("tomorrow event is omitted from all buckets", async () => {
    const tomorrow = makeEvent({
      id: "tomorrow-evt",
      // 2026-07-24 in Zurich (UTC+2) = UTC+2 midnight = 22:00 UTC on Jul 23 → next local day
      startAt: new Date("2026-07-24T06:00:00.000Z"),  // Jul 24 in Zurich
      endAt: new Date("2026-07-24T07:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([tomorrow]), makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "tomorrow-evt")).toBe(false);
  });

  it("overnight event (started prior local day, still running) appears in current", async () => {
    // Event started yesterday (Jul 22) local time, ends after now → still current
    const overnight = makeEvent({
      id: "overnight-evt",
      startAt: new Date("2026-07-22T22:00:00.000Z"),  // yesterday in Zurich (00:00 Jul 23 local)
      endAt: new Date("2026-07-23T17:00:00.000Z"),    // ends 1h from now
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([overnight]), makeInput());
    expect(feed.current.some((e) => e.id === "overnight-evt")).toBe(true);
  });

  it("ordering within current is by startAt ascending", async () => {
    const c1 = makeEvent({ id: "c1", startAt: new Date("2026-07-23T13:00:00.000Z"), endAt: new Date("2026-07-23T17:00:00.000Z") });
    const c2 = makeEvent({ id: "c2", startAt: new Date("2026-07-23T14:00:00.000Z"), endAt: new Date("2026-07-23T17:00:00.000Z") });
    // Load in reverse order to verify sort
    const feed = await buildInfoboardScreen1Feed(makeLoader([c2, c1]), makeInput());
    const idx1 = feed.current.findIndex((e) => e.id === "c1");
    const idx2 = feed.current.findIndex((e) => e.id === "c2");
    expect(idx1).toBeLessThan(idx2);
  });

  it("ordering within next is by startAt ascending", async () => {
    const n1 = makeEvent({ id: "n1", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:00:00.000Z") });
    const n2 = makeEvent({ id: "n2", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:00:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([n1, n2]), makeInput());
    // Both same startAt → original order preserved (stable sort)
    expect(feed.next[0].id).toBe("n1");
    expect(feed.next[1].id).toBe("n2");
  });

  it("ordering within later is by startAt ascending", async () => {
    // now = 16:00 UTC. n1 (17:00) is the earliest upcoming event → next.
    // n2/l1/l2 (18:00 / 19:00 / 20:00) all fall within the 4-hour horizon
    // (delta 2h / 3h / 4h) and land in later, in startAt order.
    const n1 = makeEvent({ id: "nxt1", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T17:30:00.000Z") });
    const n2 = makeEvent({ id: "nxt2", startAt: new Date("2026-07-23T18:00:00.000Z"), endAt: new Date("2026-07-23T18:30:00.000Z") });
    const l1 = makeEvent({ id: "l1", startAt: new Date("2026-07-23T19:00:00.000Z"), endAt: new Date("2026-07-23T20:00:00.000Z") });
    const l2 = makeEvent({ id: "l2", startAt: new Date("2026-07-23T20:00:00.000Z"), endAt: new Date("2026-07-23T21:00:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([n1, n2, l2, l1]), makeInput());
    expect(feed.next.map((e) => e.id)).toEqual(["nxt1"]);
    expect(feed.later.map((e) => e.id)).toEqual(["nxt2", "l1", "l2"]);
  });
});

// ── Timezone boundary (Swiss UTC+2) ───────────────────────────────────────────

describe("buildInfoboardScreen1Feed — timezone boundary", () => {
  it("uses the supplied timezone for local-date classification", async () => {
    // now = 2026-07-23T23:00:00.000Z → 01:00 on Jul 24 in Zurich (UTC+2)
    // So "today" in Zurich is 2026-07-24
    const nowAfterMidnight = new Date("2026-07-23T23:00:00.000Z");
    // Event at 02:00 UTC on Jul 24 = 04:00 Zurich → 3h from now, within the
    // rolling horizon, and on Zurich's local "today".
    const event = makeEvent({
      id: "next-day-event",
      startAt: new Date("2026-07-24T02:00:00.000Z"),
      endAt: new Date("2026-07-24T03:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([event]),
      makeInput({ now: nowAfterMidnight }),
    );
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "next-day-event")).toBe(true);
  });

  it("uses UTC timezone correctly when explicitly supplied", async () => {
    // now = 2026-07-23T16:00:00.000Z; timezone = UTC; today = 2026-07-23
    const event = makeEvent({
      id: "utc-event",
      startAt: new Date("2026-07-23T17:00:00.000Z"),
      endAt: new Date("2026-07-23T18:00:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([event]),
      makeInput({ timeZone: TZ_UTC }),
    );
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "utc-event")).toBe(true);
  });

  it("throws RangeError for invalid timezone", async () => {
    const loader = makeLoader([]);
    await expect(
      buildInfoboardScreen1Feed(loader, makeInput({ timeZone: "Invalid/Zone" })),
    ).rejects.toThrow(RangeError);
  });

  it("throws RangeError before calling the loader when timezone is invalid", async () => {
    const loader = makeLoader([]);
    try {
      await buildInfoboardScreen1Feed(loader, makeInput({ timeZone: "NotATimezone" }));
    } catch {
      // expected
    }
    expect(loader).not.toHaveBeenCalled();
  });
});

// ── Feed metadata ─────────────────────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — feed metadata", () => {
  it("populates tenant reference correctly", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed.tenant).toBe(TENANT);
  });

  it("sets generatedAt to supplied now as UTC ISO string", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed.generatedAt).toBe(NOW.toISOString());
  });

  it("sets displayDate to local calendar date in supplied timezone", async () => {
    // now = 2026-07-23T16:00:00.000Z; Zurich = UTC+2 → 18:00 local → 2026-07-23
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed.displayDate).toBe("2026-07-23");
  });

  it("displayDate reflects timezone (after midnight in Zurich)", async () => {
    // now = 2026-07-23T23:00:00.000Z → 01:00 Zurich Jul 24
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([]),
      makeInput({ now: new Date("2026-07-23T23:00:00.000Z") }),
    );
    expect(feed.displayDate).toBe("2026-07-24");
  });

  it("does not read current time implicitly (generatedAt equals supplied now)", async () => {
    const specificNow = new Date("2026-01-15T08:00:00.000Z");
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput({ now: specificNow }));
    expect(feed.generatedAt).toBe("2026-01-15T08:00:00.000Z");
  });

  it("isStale is false", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed.isStale).toBe(false);
  });

  it("wochenplanVariantBadge is null", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed.wochenplanVariantBadge).toBeNull();
  });
});

// ── isEmpty ───────────────────────────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — isEmpty", () => {
  it("is true when no events", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed.isEmpty).toBe(true);
  });

  it("is false when current has events", async () => {
    const event = makeEvent({
      startAt: new Date("2026-07-23T14:00:00.000Z"),
      endAt: new Date("2026-07-23T17:00:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    expect(feed.isEmpty).toBe(false);
  });

  it("is false when next has events", async () => {
    const event = makeEvent({ startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:30:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    expect(feed.isEmpty).toBe(false);
  });

  it("is true when all eligible events have ended", async () => {
    const ended = makeEvent({
      startAt: new Date("2026-07-23T10:00:00.000Z"),
      endAt: new Date("2026-07-23T11:30:00.000Z"),  // ended 4.5h ago
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([ended]), makeInput());
    expect(feed.isEmpty).toBe(true);
  });

  it("is true when all events are rejected", async () => {
    const rejected = makeEvent({ infoboardVisible: false });
    const feed = await buildInfoboardScreen1Feed(makeLoader([rejected]), makeInput());
    expect(feed.isEmpty).toBe(true);
  });
});

// ── Mapping integration ───────────────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — mapping integration", () => {
  const now = new Date("2026-07-23T14:00:00.000Z");  // 16:00 Zurich

  function makeFutureEvent(overrides: Partial<Screen1SourceEvent> = {}): Screen1SourceEvent {
    return makeEvent({
      startAt: new Date("2026-07-23T17:00:00.000Z"),
      endAt: new Date("2026-07-23T18:30:00.000Z"),
      ...overrides,
    });
  }

  it("resolves team infoboard name (shortName first)", async () => {
    const event = makeFutureEvent({
      team: { name: "FC Allschwil U17", displayName: "FCA U17", shortName: "U17" },
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput({ now }));
    const mapped = feed.next.find((e) => e.id === event.id);
    expect(mapped?.teamDisplayName).toBe("U17");
  });

  it("resolves opponent infoboard name (infoboardName first)", async () => {
    const event = makeFutureEvent({
      type: "MATCH",
      homeAway: "HOME",
      opponent: { officialName: "FC Basel", shortName: "FCB", infoboardName: "Basel" },
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput({ now }));
    const mapped = feed.next.find((e) => e.id === event.id);
    expect(mapped?.opponentDisplayName).toBe("Basel");
  });

  it("resolves competition label", async () => {
    const event = makeFutureEvent({ competitionLabel: "4. Liga Gruppe 1" });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput({ now }));
    const mapped = feed.next.find((e) => e.id === event.id);
    expect(mapped?.competitionLabel).toBe("4. Liga Gruppe 1");
  });

  it("resolves pitch label", async () => {
    const event = makeFutureEvent({ pitch: { label: "Stadion", code: "STADION" } });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput({ now }));
    const mapped = feed.next.find((e) => e.id === event.id);
    expect(mapped?.allocation.pitchLabel).toBe("Stadion");
  });

  it("resolves home dressing room", async () => {
    const event = makeFutureEvent({ homeDressingRoom: { label: "E1", code: "E1" } });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput({ now }));
    const mapped = feed.next.find((e) => e.id === event.id);
    expect(mapped?.allocation.homeDressingRoomLabel).toBe("E1");
  });

  it("resolves away dressing room", async () => {
    const event = makeFutureEvent({ awayDressingRoom: { label: "O2", code: "O2" } });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput({ now }));
    const mapped = feed.next.find((e) => e.id === event.id);
    expect(mapped?.allocation.awayDressingRoomLabel).toBe("O2");
  });

  it("assigns temporal bucket consistently with temporal grouping", async () => {
    const current = makeEvent({
      id: "current-evt",
      startAt: new Date("2026-07-23T12:00:00.000Z"),
      endAt: new Date("2026-07-23T17:00:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([current]), makeInput({ now }));
    const mapped = feed.current.find((e) => e.id === "current-evt");
    expect(mapped?.temporalBucket).toBe("current");
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — immutability", () => {
  it("does not mutate builder input", async () => {
    const input = makeInput({ seasonKey: "2025-26", teamSlug: "u17" });
    const inputSnapshot = { ...input };
    await buildInfoboardScreen1Feed(makeLoader([]), input);
    expect(input.tenant).toBe(inputSnapshot.tenant);
    expect(input.seasonKey).toBe(inputSnapshot.seasonKey);
    expect(input.teamSlug).toBe(inputSnapshot.teamSlug);
  });

  it("does not mutate source event objects", async () => {
    const event = makeEvent({ team: { name: "FC Team", shortName: "T" } });
    const teamRef = event.team;
    await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    expect(event.team).toBe(teamRef);
    expect(event.team?.name).toBe("FC Team");
  });

  it("returns new arrays for current, next, and later on each call", async () => {
    const event = makeEvent({ startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:30:00.000Z") });
    const loader = makeLoader([event]);
    const feed1 = await buildInfoboardScreen1Feed(loader, makeInput());
    const feed2 = await buildInfoboardScreen1Feed(loader, makeInput());
    expect(feed1.next).not.toBe(feed2.next);
  });

  it("repeated calls with same input produce equivalent feeds", async () => {
    const event = makeEvent({ startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:30:00.000Z") });
    const loader = makeLoader([event]);
    const feed1 = await buildInfoboardScreen1Feed(loader, makeInput());
    const feed2 = await buildInfoboardScreen1Feed(loader, makeInput());
    expect(feed1.displayDate).toBe(feed2.displayDate);
    expect(feed1.generatedAt).toBe(feed2.generatedAt);
    expect(feed1.next.length).toBe(feed2.next.length);
    expect(feed1.next[0]?.id).toBe(feed2.next[0]?.id);
  });
});

// ── Empty states ──────────────────────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — empty states", () => {
  it("no events returns a valid empty feed", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed).toBeDefined();
    expect(feed.current).toEqual([]);
    expect(feed.next).toEqual([]);
    expect(feed.later).toEqual([]);
    expect(feed.isEmpty).toBe(true);
    expect(typeof feed.generatedAt).toBe("string");
    expect(typeof feed.displayDate).toBe("string");
  });

  it("all events rejected returns a valid empty feed", async () => {
    const events = [
      makeEvent({ infoboardVisible: false }),
      makeEvent({ status: "DRAFT" as Screen1SourceEvent["status"] }),
      makeEvent({ tenantId: "wrong-tenant" }),
    ];
    const feed = await buildInfoboardScreen1Feed(makeLoader(events as Screen1SourceEvent[]), makeInput());
    expect(feed.current).toEqual([]);
    expect(feed.next).toEqual([]);
    expect(feed.later).toEqual([]);
    expect(feed.isEmpty).toBe(true);
  });

  it("all eligible events ended returns a valid empty feed", async () => {
    const events = [
      makeEvent({ startAt: new Date("2026-07-23T08:00:00.000Z"), endAt: new Date("2026-07-23T09:30:00.000Z") }),
      makeEvent({ startAt: new Date("2026-07-23T10:00:00.000Z"), endAt: new Date("2026-07-23T11:30:00.000Z") }),
    ];
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), makeInput());
    expect(feed.current).toEqual([]);
    expect(feed.next).toEqual([]);
    expect(feed.later).toEqual([]);
    expect(feed.isEmpty).toBe(true);
  });
});

// ── emptyStateReason ──────────────────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — emptyStateReason", () => {
  it("is null when feed is not empty (has active event)", async () => {
    const event = makeEvent({
      startAt: new Date("2026-07-23T14:00:00.000Z"),
      endAt: new Date("2026-07-23T17:30:00.000Z"),  // ends after now
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    expect(feed.isEmpty).toBe(false);
    expect(feed.emptyStateReason).toBeNull();
  });

  it("is null when feed is not empty (has upcoming event)", async () => {
    const event = makeEvent({
      startAt: new Date("2026-07-23T17:00:00.000Z"),
      endAt: new Date("2026-07-23T18:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([event]), makeInput());
    expect(feed.isEmpty).toBe(false);
    expect(feed.emptyStateReason).toBeNull();
  });

  it("is NO_EVENTS_TODAY when no eligible events exist at all", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("NO_EVENTS_TODAY");
  });

  it("is NO_EVENTS_TODAY when all events are rejected by publication policy", async () => {
    const rejected = makeEvent({ infoboardVisible: false });
    const feed = await buildInfoboardScreen1Feed(makeLoader([rejected]), makeInput());
    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("NO_EVENTS_TODAY");
  });

  it("is NO_EVENTS_TODAY when the only events are from tomorrow", async () => {
    // tomorrow-only events are excluded from all buckets; no events existed today
    const tomorrow = makeEvent({
      id: "tomorrow-evt",
      startAt: new Date("2026-07-24T06:00:00.000Z"),  // Jul 24 Zurich
      endAt: new Date("2026-07-24T07:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([tomorrow]), makeInput());
    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("NO_EVENTS_TODAY");
  });

  it("is DAY_COMPLETED when eligible today events all ended before now", async () => {
    // now = 2026-07-23T16:00:00Z; events ended hours ago
    const ended1 = makeEvent({
      id: "ended-1",
      startAt: new Date("2026-07-23T08:00:00.000Z"),
      endAt: new Date("2026-07-23T09:30:00.000Z"),
    });
    const ended2 = makeEvent({
      id: "ended-2",
      startAt: new Date("2026-07-23T10:00:00.000Z"),
      endAt: new Date("2026-07-23T11:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([ended1, ended2]), makeInput());
    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("DAY_COMPLETED");
  });

  it("is DAY_COMPLETED when the last event of the day just ended", async () => {
    // A TRAINING that ended exactly 1 minute before now
    const justEnded = makeEvent({
      id: "just-ended",
      type: "TRAINING",
      startAt: new Date("2026-07-23T14:00:00.000Z"),
      endAt: new Date("2026-07-23T15:59:00.000Z"),  // ended 1min before now (16:00)
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([justEnded]), makeInput());
    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("DAY_COMPLETED");
  });

  it("is NO_EVENTS_TODAY when only tomorrow events exist alongside rejected today events", async () => {
    // Rejected today event (hidden) + valid tomorrow event
    const rejectedToday = makeEvent({ infoboardVisible: false });
    const tomorrowEvent = makeEvent({
      startAt: new Date("2026-07-24T06:00:00.000Z"),
      endAt: new Date("2026-07-24T07:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([rejectedToday, tomorrowEvent]),
      makeInput(),
    );
    expect(feed.isEmpty).toBe(true);
    // Rejected events are NOT eligible; no eligible events for today
    expect(feed.emptyStateReason).toBe("NO_EVENTS_TODAY");
  });
});

// ── Rolling 4-hour operational horizon (INFOBOARD-INTEGRATION-01B-C1) ────────

describe("buildInfoboardScreen1Feed — rolling 4-hour horizon selection logic", () => {
  // now = 2026-07-23T16:00:00.000Z (18:00 Zurich)

  it("active event is always included regardless of count", async () => {
    const active = makeEvent({
      id: "active",
      startAt: new Date("2026-07-23T14:00:00.000Z"),
      endAt: new Date("2026-07-23T17:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([active]), makeInput());
    expect(feed.current.some((e) => e.id === "active")).toBe(true);
  });

  it("two upcoming events within the 4-hour horizon are both included (earliest as next)", async () => {
    const e1 = makeEvent({ id: "e1", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:00:00.000Z") }); // 1h away
    const e2 = makeEvent({ id: "e2", startAt: new Date("2026-07-23T19:00:00.000Z"), endAt: new Date("2026-07-23T20:00:00.000Z") }); // 3h away
    const feed = await buildInfoboardScreen1Feed(makeLoader([e1, e2]), makeInput());
    expect(feed.next.map((e) => e.id)).toEqual(["e1"]);
    expect(feed.later.map((e) => e.id)).toEqual(["e2"]);
  });

  it("upcoming event 6 hours away is excluded (beyond the 4-hour horizon)", async () => {
    const nowMidnight = new Date("2026-07-23T00:00:00.000Z");  // 02:00 Zurich
    const lateEvent = makeEvent({
      id: "late-event",
      startAt: new Date("2026-07-23T06:00:00.000Z"),   // 6h after nowMidnight
      endAt: new Date("2026-07-23T07:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([lateEvent]),
      makeInput({ now: nowMidnight }),
    );
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "late-event")).toBe(false);
    expect(feed.isEmpty).toBe(true);
  });

  it("a 3rd upcoming event beyond 4h is excluded while the earlier two remain", async () => {
    const e1 = makeEvent({ id: "e1", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:00:00.000Z") }); // 1h away
    const e2 = makeEvent({ id: "e2", startAt: new Date("2026-07-23T18:00:00.000Z"), endAt: new Date("2026-07-23T19:00:00.000Z") }); // 2h away
    const e3 = makeEvent({ id: "e3", startAt: new Date("2026-07-23T21:00:00.000Z"), endAt: new Date("2026-07-23T22:00:00.000Z") }); // 5h away — beyond horizon
    const feed = await buildInfoboardScreen1Feed(makeLoader([e1, e2, e3]), makeInput());
    expect(feed.next.map((e) => e.id)).toEqual(["e1"]);
    expect(feed.later.map((e) => e.id)).toEqual(["e2"]);
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "e3")).toBe(false);
  });

  it("all active events remain included even when there are more than 2", async () => {
    const a1 = makeEvent({ id: "a1", startAt: new Date("2026-07-23T12:00:00.000Z"), endAt: new Date("2026-07-23T17:00:00.000Z") });
    const a2 = makeEvent({ id: "a2", startAt: new Date("2026-07-23T13:00:00.000Z"), endAt: new Date("2026-07-23T17:00:00.000Z") });
    const a3 = makeEvent({ id: "a3", startAt: new Date("2026-07-23T14:00:00.000Z"), endAt: new Date("2026-07-23T17:00:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([a1, a2, a3]), makeInput());
    expect(feed.current).toHaveLength(3);
    expect(feed.current.some((e) => e.id === "a1")).toBe(true);
    expect(feed.current.some((e) => e.id === "a2")).toBe(true);
    expect(feed.current.some((e) => e.id === "a3")).toBe(true);
  });

  it("before the first event of the day: only activities within the 4-hour horizon render", async () => {
    // now = 08:00 Zurich (06:00 UTC). Events at +3h, +4h (inclusive boundary), +5h (excluded).
    const nowMorning = new Date("2026-07-23T06:00:00.000Z");
    const eIn3h = makeEvent({ id: "in3h", startAt: new Date("2026-07-23T09:00:00.000Z"), endAt: new Date("2026-07-23T10:30:00.000Z") });
    const eIn4h = makeEvent({ id: "in4h", startAt: new Date("2026-07-23T10:00:00.000Z"), endAt: new Date("2026-07-23T11:30:00.000Z") });
    const eIn5h = makeEvent({ id: "in5h", startAt: new Date("2026-07-23T11:00:00.000Z"), endAt: new Date("2026-07-23T12:30:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([eIn3h, eIn4h, eIn5h]),
      makeInput({ now: nowMorning }),
    );
    expect(feed.current).toHaveLength(0);
    expect(feed.next.map((e) => e.id)).toEqual(["in3h"]);
    expect(feed.later.map((e) => e.id)).toEqual(["in4h"]);
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "in5h")).toBe(false);
  });

  it("across a large gap beyond 4 hours: the upcoming event is excluded", async () => {
    // now = 12:00 Zurich (10:00 UTC); single event at 17:00 Zurich = 15:00 UTC (5h away)
    const nowMidday = new Date("2026-07-23T10:00:00.000Z");
    const e1700 = makeEvent({ id: "17h", startAt: new Date("2026-07-23T15:00:00.000Z"), endAt: new Date("2026-07-23T16:45:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([e1700]),
      makeInput({ now: nowMidday }),
    );
    expect(feed.isEmpty).toBe(true);
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "17h")).toBe(false);
  });

  it("after final event of the day: empty feed with DAY_COMPLETED reason", async () => {
    // now = 23:45 Zurich = 21:45 UTC; last event ended at 22:00 Zurich = 21:00 UTC
    const nowLate = new Date("2026-07-23T21:45:00.000Z");
    const lastEvent = makeEvent({
      id: "last-event",
      startAt: new Date("2026-07-23T18:00:00.000Z"),
      endAt: new Date("2026-07-23T21:00:00.000Z"),  // ended 45 min ago
    });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([lastEvent]),
      makeInput({ now: nowLate }),
    );
    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("DAY_COMPLETED");
  });

  it("day with no scheduled events returns NO_EVENTS_TODAY", async () => {
    const feed = await buildInfoboardScreen1Feed(makeLoader([]), makeInput());
    expect(feed.isEmpty).toBe(true);
    expect(feed.emptyStateReason).toBe("NO_EVENTS_TODAY");
  });

  it("a same-local-day event far beyond the 4-hour horizon is excluded (calendar-day rule no longer applies)", async () => {
    // now = 2026-07-23T22:00:00Z = 00:00 Jul 24 Zurich. Under the previous
    // "same calendar day" rule this event (19h away, but same local day)
    // would have been shown. The rolling horizon now excludes it.
    const nowMidnight = new Date("2026-07-23T22:00:00.000Z");
    const sameDayFarEvent = makeEvent({
      id: "same-day-far",
      startAt: new Date("2026-07-24T17:00:00.000Z"),  // 19:00 Zurich Jul 24 — same local day
      endAt: new Date("2026-07-24T18:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([sameDayFarEvent]),
      makeInput({ now: nowMidnight }),
    );
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "same-day-far")).toBe(false);
  });

  it("Europe/Zurich boundary: an event just after local midnight within the horizon is still included", async () => {
    // 22:15 UTC Jul 23 = 00:15 Zurich Jul 24 (just after local midnight).
    const nowAfterUtcMidnight = new Date("2026-07-23T22:15:00.000Z");
    // 01:00 Zurich Jul 24 = 23:00 UTC Jul 23 — 45 min away, within horizon,
    // despite crossing the tenant-local calendar day boundary.
    const soonAfterMidnight = makeEvent({
      id: "soon-after-midnight",
      startAt: new Date("2026-07-23T23:00:00.000Z"),
      endAt: new Date("2026-07-24T00:30:00.000Z"),
    });
    // Event that already ended before now, for contrast (excluded regardless).
    const yesterdayEvent = makeEvent({
      id: "yesterday-event",
      startAt: new Date("2026-07-23T07:00:00.000Z"),
      endAt: new Date("2026-07-23T08:30:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(
      makeLoader([soonAfterMidnight, yesterdayEvent]),
      makeInput({ now: nowAfterUtcMidnight }),
    );
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "soon-after-midnight")).toBe(true);
    expect(all.some((e) => e.id === "yesterday-event")).toBe(false);
  });

  it("event with stale SCHEDULED status but expired display interval is excluded", async () => {
    // SCHEDULED status, but endAt is before now → treated as completed
    const stale = makeEvent({
      id: "stale-scheduled",
      status: "SCHEDULED",
      startAt: new Date("2026-07-23T10:00:00.000Z"),
      endAt: new Date("2026-07-23T11:30:00.000Z"),  // ended 4.5h ago
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([stale]), makeInput());
    const all = [...feed.current, ...feed.next, ...feed.later];
    expect(all.some((e) => e.id === "stale-scheduled")).toBe(false);
  });

  it("dashboard and public screen produce same event IDs for same tenant/date/time", async () => {
    // Both consumer paths call buildInfoboardScreen1Feed with identical inputs.
    // Same loader, same input → identical result.
    const events = [
      makeEvent({ id: "evt-a", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:30:00.000Z") }),
      makeEvent({ id: "evt-b", startAt: new Date("2026-07-23T18:30:00.000Z"), endAt: new Date("2026-07-23T20:00:00.000Z") }),
      makeEvent({ id: "evt-c", startAt: new Date("2026-07-23T20:00:00.000Z"), endAt: new Date("2026-07-23T21:30:00.000Z") }),
    ];
    const loader = makeLoader(events);
    const input = makeInput();

    // Simulate dashboard call
    const dashboardFeed = await buildInfoboardScreen1Feed(loader, input);
    // Simulate public Screen 1 call (same inputs)
    const screen1Feed = await buildInfoboardScreen1Feed(loader, input);

    const dashboardIds = [...dashboardFeed.current, ...dashboardFeed.next, ...dashboardFeed.later].map((e) => e.id);
    const screen1Ids = [...screen1Feed.current, ...screen1Feed.next, ...screen1Feed.later].map((e) => e.id);
    expect(dashboardIds).toEqual(screen1Ids);
  });

  it("dashboard counters derive from canonical feed: counts match feed bucket lengths, beyond-horizon events excluded", async () => {
    // Verifies that no dashboard-only filter re-runs different eligibility.
    const events = [
      makeEvent({ id: "e1", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:00:00.000Z") }), // 1h away
      makeEvent({ id: "e2", startAt: new Date("2026-07-23T18:00:00.000Z"), endAt: new Date("2026-07-23T19:00:00.000Z") }), // 2h away
      makeEvent({ id: "e3", startAt: new Date("2026-07-23T21:00:00.000Z"), endAt: new Date("2026-07-23T22:00:00.000Z") }), // 5h away — excluded
    ];
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), makeInput());
    expect(feed.next).toHaveLength(1);
    expect(feed.later).toHaveLength(1);
    const visibleToday = feed.current.length + feed.next.length + feed.later.length;
    expect(visibleToday).toBe(2);
  });
});
