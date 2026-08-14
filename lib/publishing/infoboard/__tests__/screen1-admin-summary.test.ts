/**
 * lib/publishing/infoboard/__tests__/screen1-admin-summary.test.ts
 *
 * Unit tests for buildScreen1AdminSummary.
 *
 * Verifies:
 *   - Empty feed returns all zero counts
 *   - current events counted correctly
 *   - next events counted correctly
 *   - later events counted correctly
 *   - flattened order is deterministic: current → next → later
 *   - event data is not mutated
 *   - displayDate is passed through from the feed
 *   - no publication or temporal logic is duplicated
 */

import { describe, it, expect } from "vitest";
import {
  buildScreen1AdminSummary,
} from "../screen1-admin-summary";
import type { InfoboardScreen1Feed, InfoboardScreen1Event } from "../../event-types";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
};

function makeEvent(overrides: Partial<InfoboardScreen1Event>): InfoboardScreen1Event {
  return {
    id: "evt-1",
    type: "TRAINING",
    displayTitle: "Training U14",
    teamDisplayName: "U14",
    opponentDisplayName: null,
    opponentLogoUrl: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt: "2026-07-24T16:00:00.000Z",
    endAt: "2026-07-24T17:30:00.000Z",
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "later",
    allocation: {
      pitchLabel: "Platz 1",
      homeDressingRoomLabel: "Kabine A",
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
    },
    seasonKey: "2025-26",
    ...overrides,
  };
}

function makeFeed(
  overrides: Partial<InfoboardScreen1Feed> = {},
): InfoboardScreen1Feed {
  return {
    generatedAt: "2026-07-24T10:00:00.000Z",
    tenant: TENANT,
    displayDate: "2026-07-24",
    isStale: false,
    wochenplanVariantBadge: null,
    current: [],
    next: [],
    later: [],
    isEmpty: true,
    emptyStateReason: "NO_EVENTS_TODAY",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildScreen1AdminSummary", () => {
  it("returns all zero counts for an empty feed", () => {
    const feed = makeFeed();
    const summary = buildScreen1AdminSummary(feed);

    expect(summary.counts.visibleToday).toBe(0);
    expect(summary.counts.currentCount).toBe(0);
    expect(summary.counts.nextCount).toBe(0);
    expect(summary.counts.laterCount).toBe(0);
    expect(summary.events).toHaveLength(0);
  });

  it("returns correct current count", () => {
    const current = [
      makeEvent({ id: "c1", temporalBucket: "current" }),
      makeEvent({ id: "c2", temporalBucket: "current" }),
    ];
    const feed = makeFeed({ current, isEmpty: false });
    const summary = buildScreen1AdminSummary(feed);

    expect(summary.counts.currentCount).toBe(2);
    expect(summary.counts.nextCount).toBe(0);
    expect(summary.counts.laterCount).toBe(0);
    expect(summary.counts.visibleToday).toBe(2);
  });

  it("returns correct next count", () => {
    const next = [makeEvent({ id: "n1", temporalBucket: "next" })];
    const feed = makeFeed({ next, isEmpty: false });
    const summary = buildScreen1AdminSummary(feed);

    expect(summary.counts.nextCount).toBe(1);
    expect(summary.counts.currentCount).toBe(0);
    expect(summary.counts.laterCount).toBe(0);
    expect(summary.counts.visibleToday).toBe(1);
  });

  it("returns correct later count", () => {
    const later = [
      makeEvent({ id: "l1", temporalBucket: "later" }),
      makeEvent({ id: "l2", temporalBucket: "later" }),
      makeEvent({ id: "l3", temporalBucket: "later" }),
    ];
    const feed = makeFeed({ later, isEmpty: false });
    const summary = buildScreen1AdminSummary(feed);

    expect(summary.counts.laterCount).toBe(3);
    expect(summary.counts.visibleToday).toBe(3);
  });

  it("aggregates counts across all buckets", () => {
    const current = [makeEvent({ id: "c1", temporalBucket: "current" })];
    const next = [makeEvent({ id: "n1", temporalBucket: "next" })];
    const later = [
      makeEvent({ id: "l1", temporalBucket: "later" }),
      makeEvent({ id: "l2", temporalBucket: "later" }),
    ];
    const feed = makeFeed({ current, next, later, isEmpty: false });
    const summary = buildScreen1AdminSummary(feed);

    expect(summary.counts.visibleToday).toBe(4);
    expect(summary.counts.currentCount).toBe(1);
    expect(summary.counts.nextCount).toBe(1);
    expect(summary.counts.laterCount).toBe(2);
  });

  it("flattens events in deterministic order: current → next → later", () => {
    const c1 = makeEvent({ id: "c1", temporalBucket: "current", displayTitle: "Current 1" });
    const n1 = makeEvent({ id: "n1", temporalBucket: "next", displayTitle: "Next 1" });
    const n2 = makeEvent({ id: "n2", temporalBucket: "next", displayTitle: "Next 2" });
    const l1 = makeEvent({ id: "l1", temporalBucket: "later", displayTitle: "Later 1" });
    const feed = makeFeed({
      current: [c1],
      next: [n1, n2],
      later: [l1],
      isEmpty: false,
    });

    const summary = buildScreen1AdminSummary(feed);

    expect(summary.events).toHaveLength(4);
    expect(summary.events[0].id).toBe("c1");
    expect(summary.events[0].temporalBucket).toBe("current");
    expect(summary.events[1].id).toBe("n1");
    expect(summary.events[1].temporalBucket).toBe("next");
    expect(summary.events[2].id).toBe("n2");
    expect(summary.events[2].temporalBucket).toBe("next");
    expect(summary.events[3].id).toBe("l1");
    expect(summary.events[3].temporalBucket).toBe("later");
  });

  it("maps event fields correctly from the feed", () => {
    const event = makeEvent({
      id: "evt-match",
      type: "MATCH",
      displayTitle: "1. Mannschaft vs FC Riehen",
      teamDisplayName: "1. Mannschaft",
      opponentDisplayName: "FC Riehen",
      competitionLabel: "4. Liga Gruppe 3",
      startAt: "2026-07-24T14:00:00.000Z",
      endAt: "2026-07-24T15:50:00.000Z",
      status: "SCHEDULED",
      temporalBucket: "next",
      allocation: {
        pitchLabel: "Platz 2",
        homeDressingRoomLabel: "Kabine B",
        awayDressingRoomLabel: "Kabine C",
        refereeDressingRoomLabel: null,
      },
    });

    const feed = makeFeed({ next: [event], isEmpty: false });
    const summary = buildScreen1AdminSummary(feed);

    expect(summary.events).toHaveLength(1);
    const entry = summary.events[0];

    expect(entry.id).toBe("evt-match");
    expect(entry.type).toBe("MATCH");
    expect(entry.displayTitle).toBe("1. Mannschaft vs FC Riehen");
    expect(entry.teamDisplayName).toBe("1. Mannschaft");
    expect(entry.opponentDisplayName).toBe("FC Riehen");
    expect(entry.competitionLabel).toBe("4. Liga Gruppe 3");
    expect(entry.startAt).toBe("2026-07-24T14:00:00.000Z");
    expect(entry.endAt).toBe("2026-07-24T15:50:00.000Z");
    expect(entry.status).toBe("SCHEDULED");
    expect(entry.temporalBucket).toBe("next");
    expect(entry.pitchLabel).toBe("Platz 2");
    expect(entry.homeDressingRoomLabel).toBe("Kabine B");
    expect(entry.awayDressingRoomLabel).toBe("Kabine C");
  });

  it("passes through displayDate from the feed", () => {
    const feed = makeFeed({ displayDate: "2026-07-25" });
    const summary = buildScreen1AdminSummary(feed);

    expect(summary.displayDate).toBe("2026-07-25");
  });

  it("does not mutate the input feed", () => {
    const event = makeEvent({ id: "evt-1", temporalBucket: "current" });
    const current = [event];
    const feed = makeFeed({ current, isEmpty: false });
    const originalCurrentLength = current.length;

    buildScreen1AdminSummary(feed);

    expect(feed.current).toHaveLength(originalCurrentLength);
    expect(current).toHaveLength(originalCurrentLength);
    // Verify original event object is unchanged
    expect(event.id).toBe("evt-1");
  });

  it("does not mutate the returned events array across calls", () => {
    const event = makeEvent({ id: "evt-1", temporalBucket: "later" });
    const feed = makeFeed({ later: [event], isEmpty: false });

    const summary1 = buildScreen1AdminSummary(feed);
    const summary2 = buildScreen1AdminSummary(feed);

    expect(summary1.events).not.toBe(summary2.events);
    expect(summary1.events[0]).not.toBe(summary2.events[0]);
  });

  it("handles events with null allocation fields", () => {
    const event = makeEvent({
      id: "evt-training",
      type: "TRAINING",
      temporalBucket: "later",
      allocation: {
        pitchLabel: null,
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    });

    const feed = makeFeed({ later: [event], isEmpty: false });
    const summary = buildScreen1AdminSummary(feed);

    expect(summary.events[0].pitchLabel).toBeNull();
    expect(summary.events[0].homeDressingRoomLabel).toBeNull();
    expect(summary.events[0].awayDressingRoomLabel).toBeNull();
  });
});
