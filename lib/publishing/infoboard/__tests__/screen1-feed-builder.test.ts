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

  it("later event (after earliest-start group) appears in later", async () => {
    const early = makeEvent({ id: "next-evt", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T18:30:00.000Z") });
    const late = makeEvent({ id: "later-evt", startAt: new Date("2026-07-23T18:30:00.000Z"), endAt: new Date("2026-07-23T20:00:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([early, late]), makeInput());
    expect(feed.next.some((e) => e.id === "next-evt")).toBe(true);
    expect(feed.later.some((e) => e.id === "later-evt")).toBe(true);
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
    const next = makeEvent({ id: "nxt", startAt: new Date("2026-07-23T17:00:00.000Z"), endAt: new Date("2026-07-23T17:30:00.000Z") });
    const l1 = makeEvent({ id: "l1", startAt: new Date("2026-07-23T18:00:00.000Z"), endAt: new Date("2026-07-23T19:00:00.000Z") });
    const l2 = makeEvent({ id: "l2", startAt: new Date("2026-07-23T19:00:00.000Z"), endAt: new Date("2026-07-23T20:00:00.000Z") });
    const feed = await buildInfoboardScreen1Feed(makeLoader([next, l2, l1]), makeInput());
    const idx1 = feed.later.findIndex((e) => e.id === "l1");
    const idx2 = feed.later.findIndex((e) => e.id === "l2");
    expect(idx1).toBeLessThan(idx2);
  });
});

// ── Timezone boundary (Swiss UTC+2) ───────────────────────────────────────────

describe("buildInfoboardScreen1Feed — timezone boundary", () => {
  it("uses the supplied timezone for local-date classification", async () => {
    // now = 2026-07-23T23:00:00.000Z → 01:00 on Jul 24 in Zurich (UTC+2)
    // So "today" in Zurich is 2026-07-24
    const nowAfterMidnight = new Date("2026-07-23T23:00:00.000Z");
    // Event at 07:00 UTC on Jul 24 = 09:00 Zurich → future today for Zurich date
    const event = makeEvent({
      id: "next-day-event",
      startAt: new Date("2026-07-24T07:00:00.000Z"),  // 09:00 Zurich Jul 24 = local today
      endAt: new Date("2026-07-24T08:30:00.000Z"),
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
