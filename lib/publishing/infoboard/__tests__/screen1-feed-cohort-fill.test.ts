/**
 * Regression tests for MIN_DISPLAY_CARDS fill-forward cohort integrity.
 *
 * INFOBOARD-REGRESSION-01C — ensures same-start temporal cohorts are never
 * split when the display-window fallback selects future events.
 */

import { describe, it, expect, vi } from "vitest";
import {
  buildInfoboardScreen1Feed,
  MIN_DISPLAY_CARDS,
  selectFillEventsPreservingStartCohorts,
  SCREEN1_HORIZON_HOURS,
} from "../screen1-feed-builder";
import type { BuildScreen1FeedInput } from "../screen1-feed-builder";
import type { Screen1SourceEvent } from "../screen1-event-mapper";
import type { PublicationEventLoadInput } from "../../policy/event-selection";

const TZ = "Europe/Zurich";

const TENANT: BuildScreen1FeedInput["tenant"] = {
  id: "tenant-fca",
  key: "fca",
  name: "FC Allschwil",
  timezone: TZ,
};

function makeEvent(overrides: Partial<Screen1SourceEvent> = {}): Screen1SourceEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: "tenant-fca",
    type: "TRAINING",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    startAt: new Date("2026-08-26T13:45:00.000Z"),
    endAt: new Date("2026-08-26T15:15:00.000Z"),
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
    now: new Date("2026-08-26T06:00:00.000Z"), // 08:00 Zurich — before 15:45 cohort
    ...overrides,
  };
}

function allFeedIds(feed: Awaited<ReturnType<typeof buildInfoboardScreen1Feed>>): string[] {
  return [...feed.current, ...feed.next, ...feed.later].map((e) => e.id);
}

// ── Unit tests for cohort selection helper ────────────────────────────────────

describe("selectFillEventsPreservingStartCohorts", () => {
  it("includes an entire same-start cohort when partial selection would split it", () => {
    const sharedStart = new Date("2026-08-26T13:45:00.000Z");
    const candidates = [
      makeEvent({ id: "e3", startAt: sharedStart, team: { name: "JUNIOREN E3" } }),
      makeEvent({ id: "f2", startAt: sharedStart, team: { name: "JUNIOREN F2" } }),
      makeEvent({ id: "f3", startAt: sharedStart, team: { name: "JUNIOREN F3" } }),
      makeEvent({ id: "g", startAt: sharedStart, team: { name: "JUNIOREN G" } }),
      makeEvent({
        id: "d1",
        startAt: new Date("2026-08-26T15:30:00.000Z"),
        team: { name: "D1" },
      }),
    ];

    const selected = selectFillEventsPreservingStartCohorts(candidates, 3);
    expect(selected.map((e) => e.id)).toEqual(["e3", "f2", "f3", "g"]);
    expect(selected.some((e) => e.id === "d1")).toBe(false);
  });

  it("stops after the minimum is satisfied without pulling the next cohort", () => {
    const candidates = [
      makeEvent({ id: "a", startAt: new Date("2026-08-26T12:00:00.000Z") }),
      makeEvent({ id: "b", startAt: new Date("2026-08-26T13:00:00.000Z") }),
      makeEvent({ id: "c", startAt: new Date("2026-08-26T13:00:00.000Z") }),
      makeEvent({ id: "d", startAt: new Date("2026-08-26T13:00:00.000Z") }),
      makeEvent({ id: "e", startAt: new Date("2026-08-26T15:00:00.000Z") }),
    ];

    const selected = selectFillEventsPreservingStartCohorts(candidates, 3);
    expect(selected.map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
    expect(selected.some((e) => e.id === "e")).toBe(false);
  });

  it("includes an entire same-start cohort of six when fill budget is lower", () => {
    const sharedStart = new Date("2026-08-26T16:45:00.000Z");
    const candidates = [
      makeEvent({ id: "s1", startAt: sharedStart }),
      makeEvent({ id: "s2", startAt: sharedStart }),
      makeEvent({ id: "s3", startAt: sharedStart }),
      makeEvent({ id: "s4", startAt: sharedStart }),
      makeEvent({ id: "s5", startAt: sharedStart }),
      makeEvent({ id: "s6", startAt: sharedStart }),
      makeEvent({ id: "later", startAt: new Date("2026-08-26T18:15:00.000Z") }),
    ];

    const selected = selectFillEventsPreservingStartCohorts(candidates, 3);
    expect(selected.map((e) => e.id)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6"]);
  });
});

// ── Integration tests (A–G) ───────────────────────────────────────────────────

describe("buildInfoboardScreen1Feed — MIN_DISPLAY_CARDS cohort fill", () => {
  it("A. one future event → normal behavior (no over-fill)", async () => {
    const only = makeEvent({
      id: "solo",
      startAt: new Date("2026-08-26T13:45:00.000Z"),
    });
    const feed = await buildInfoboardScreen1Feed(makeLoader([only]), makeInput());
    expect(allFeedIds(feed)).toEqual(["solo"]);
    expect(feed.isEmpty).toBe(false);
  });

  it("B. three distinct future events → normal minimum fill", async () => {
    const events = [
      makeEvent({ id: "e1", startAt: new Date("2026-08-26T12:00:00.000Z") }),
      makeEvent({ id: "e2", startAt: new Date("2026-08-26T13:00:00.000Z") }),
      makeEvent({ id: "e3", startAt: new Date("2026-08-26T14:00:00.000Z") }),
    ];
    const feed = await buildInfoboardScreen1Feed(makeLoader(events), makeInput());
    expect(allFeedIds(feed).sort()).toEqual(["e1", "e2", "e3"]);
  });

  it("C. four same-start trainings → all four included (FC Allschwil regression)", async () => {
    const cohortStart = new Date("2026-08-26T13:45:00.000Z"); // 15:45 Zurich
    const events = [
      makeEvent({
        id: "e3",
        startAt: cohortStart,
        endAt: new Date("2026-08-26T15:15:00.000Z"),
        team: { name: "JUNIOREN E3", infoboardDisplayName: "JUNIOREN E3" },
      }),
      makeEvent({
        id: "f2",
        startAt: cohortStart,
        endAt: new Date("2026-08-26T15:15:00.000Z"),
        team: { name: "JUNIOREN F2", infoboardDisplayName: "JUNIOREN F2" },
      }),
      makeEvent({
        id: "f3",
        startAt: cohortStart,
        endAt: new Date("2026-08-26T16:45:00.000Z"),
        team: { name: "JUNIOREN F3", infoboardDisplayName: "JUNIOREN F3" },
      }),
      makeEvent({
        id: "g",
        startAt: cohortStart,
        endAt: new Date("2026-08-26T15:15:00.000Z"),
        team: { name: "JUNIOREN G", infoboardDisplayName: "JUNIOREN G" },
      }),
      makeEvent({
        id: "d1-later",
        startAt: new Date("2026-08-26T15:30:00.000Z"), // 17:30 Zurich
        endAt: new Date("2026-08-26T17:00:00.000Z"),
        team: { name: "D1" },
      }),
    ];

    const feed = await buildInfoboardScreen1Feed(makeLoader(events), makeInput());
    const ids = allFeedIds(feed);

    expect(ids).toContain("e3");
    expect(ids).toContain("f2");
    expect(ids).toContain("f3");
    expect(ids).toContain("g");
    expect(ids).not.toContain("d1-later");

    const cohortIds = ids.filter((id) =>
      ["e3", "f2", "f3", "g"].includes(id),
    );
    expect(cohortIds).toHaveLength(4);
  });

  it("D. cohort crossing minimum boundary → complete cohort retained", async () => {
    const sharedStart = new Date("2026-08-26T14:00:00.000Z");
    const events = [
      makeEvent({ id: "a", startAt: new Date("2026-08-26T12:00:00.000Z") }),
      makeEvent({ id: "b", startAt: sharedStart }),
      makeEvent({ id: "c", startAt: sharedStart }),
      makeEvent({ id: "d", startAt: sharedStart }),
      makeEvent({ id: "e", startAt: new Date("2026-08-26T15:00:00.000Z") }),
    ];

    const feed = await buildInfoboardScreen1Feed(makeLoader(events), makeInput());
    const ids = allFeedIds(feed);

    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
    expect(ids).toContain("d");
    expect(ids).not.toContain("e");
  });

  it("E. events already inside rolling window → existing behavior preserved", async () => {
    const now = new Date("2026-08-26T10:00:00.000Z"); // 12:00 Zurich
    const events = [
      makeEvent({ id: "n1", startAt: new Date("2026-08-26T11:00:00.000Z") }),
      makeEvent({ id: "n2", startAt: new Date("2026-08-26T12:00:00.000Z") }),
      makeEvent({ id: "l1", startAt: new Date("2026-08-26T13:00:00.000Z") }),
      makeEvent({ id: "far", startAt: new Date("2026-08-26T18:00:00.000Z") }),
    ];

    const feed = await buildInfoboardScreen1Feed(
      makeLoader(events),
      makeInput({ now }),
    );

    expect(feed.next.map((e) => e.id)).toEqual(["n1"]);
    expect(feed.later.map((e) => e.id)).toEqual(["n2", "l1"]);
    expect(allFeedIds(feed)).not.toContain("far");
  });

  it("F. current events → existing behavior preserved", async () => {
    const now = new Date("2026-08-26T12:30:00.000Z");
    const current = makeEvent({
      id: "running",
      startAt: new Date("2026-08-26T11:00:00.000Z"),
      endAt: new Date("2026-08-26T13:30:00.000Z"),
    });
    const future = makeEvent({
      id: "later-today",
      startAt: new Date("2026-08-26T18:00:00.000Z"),
    });

    const feed = await buildInfoboardScreen1Feed(
      makeLoader([current, future]),
      makeInput({ now }),
    );

    expect(feed.current.map((e) => e.id)).toEqual(["running"]);
    expect(allFeedIds(feed)).toContain("later-today");
  });

  it("G. same-start matches/tournaments are not grouped — both event types appear", async () => {
    const sharedStart = new Date("2026-08-26T13:45:00.000Z");
    const events = [
      makeEvent({ id: "t1", type: "TRAINING", startAt: sharedStart }),
      makeEvent({ id: "t2", type: "TRAINING", startAt: sharedStart }),
      makeEvent({
        id: "m1",
        type: "MATCH",
        homeAway: "HOME",
        startAt: sharedStart,
      }),
      makeEvent({
        id: "tour1",
        type: "TOURNAMENT",
        startAt: sharedStart,
      }),
    ];

    const feed = await buildInfoboardScreen1Feed(makeLoader(events), makeInput());
    const ids = allFeedIds(feed);

    expect(ids).toContain("t1");
    expect(ids).toContain("t2");
    expect(ids).toContain("m1");
    expect(ids).toContain("tour1");
  });

  it("documents MIN_DISPLAY_CARDS and horizon constants used by fill logic", () => {
    expect(MIN_DISPLAY_CARDS).toBe(3);
    expect(SCREEN1_HORIZON_HOURS).toBe(4);
  });
});
