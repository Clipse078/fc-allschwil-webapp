/**
 * lib/publishing/infoboard/__tests__/screen1-feed-expiry.test.ts
 *
 * Screen-1 runtime expiry filtering — FC Allschwil physical-TV regression fixtures.
 */

import { describe, expect, it } from "vitest";
import type {
  InfoboardScreen1Event,
  InfoboardScreen1Feed,
} from "../../event-types";
import {
  filterExpiredScreen1Feed,
  isScreen1EventActiveAt,
} from "../screen1-feed-expiry";

const TZ = "Europe/Zurich";

function makeEvent(
  overrides: Partial<InfoboardScreen1Event> = {},
): InfoboardScreen1Event {
  return {
    id: "evt-1",
    type: "TRAINING",
    displayTitle: "Junioren F2",
    teamDisplayName: "Junioren F2",
    opponentDisplayName: null,
    opponentLogoUrl: null,
    matchPresentation: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt: "2026-08-24T15:00:00.000Z",
    endAt: "2026-08-24T16:30:00.000Z",
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "current",
    seasonKey: "2026-27",
    allocation: {
      pitchLabel: "KR 1",
      homeDressingRoomLabel: "Kabine 1",
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
    },
    ...overrides,
  };
}

function makeFeed(
  overrides: Partial<InfoboardScreen1Feed> = {},
): InfoboardScreen1Feed {
  return {
    generatedAt: "2026-08-24T16:43:00.000Z",
    tenant: {
      id: "tenant-fca",
      key: "fc-allschwil",
      name: "FC Allschwil",
      timezone: TZ,
    },
    displayDate: "2026-08-24",
    isStale: false,
    wochenplanVariantBadge: null,
    current: [],
    next: [],
    later: [],
    isEmpty: true,
    emptyStateReason: null,
    ...overrides,
  };
}

describe("screen1-feed-expiry — FC Allschwil Fixture A (expired training)", () => {
  const training = makeEvent({
    id: "fca-f2",
    teamDisplayName: "Junioren F2",
    displayTitle: "Junioren F2",
    startAt: "2026-08-24T15:00:00.000Z",
    endAt: "2026-08-24T16:30:00.000Z",
  });

  const feed = makeFeed({
    current: [training],
    isEmpty: false,
  });

  it("at 18:43 Europe/Zurich the 17:00–18:30 training is NOT active", () => {
    const now = new Date("2026-08-24T16:43:00.000Z");
    expect(isScreen1EventActiveAt(training, now)).toBe(false);
  });

  it("filterExpiredScreen1Feed removes the expired training from current", () => {
    const now = new Date("2026-08-24T16:43:00.000Z");
    const filtered = filterExpiredScreen1Feed(feed, now);
    expect(filtered.current).toHaveLength(0);
    expect(filtered.isEmpty).toBe(true);
  });
});

describe("screen1-feed-expiry — Fixture D (boundary)", () => {
  const training = makeEvent({
    startAt: "2026-08-24T15:00:00.000Z",
    endAt: "2026-08-24T16:30:00.000Z",
  });

  it("17:00 local (15:00Z) — active while running", () => {
    expect(isScreen1EventActiveAt(training, new Date("2026-08-24T15:00:00.000Z"))).toBe(
      true,
    );
  });

  it("18:29 local (16:29Z) — still active one minute before end", () => {
    expect(isScreen1EventActiveAt(training, new Date("2026-08-24T16:29:00.000Z"))).toBe(
      true,
    );
  });

  it("18:30 local (16:30Z) — remains visible during post-event grace", () => {
    expect(isScreen1EventActiveAt(training, new Date("2026-08-24T16:30:00.000Z"))).toBe(
      true,
    );
  });

  it("18:44 local (16:44Z) — still active within 15-minute grace", () => {
    expect(isScreen1EventActiveAt(training, new Date("2026-08-24T16:44:00.000Z"))).toBe(
      true,
    );
  });

  it("18:45 local (16:45Z) — expired after grace window", () => {
    expect(isScreen1EventActiveAt(training, new Date("2026-08-24T16:45:00.000Z"))).toBe(
      false,
    );
  });
});

describe("screen1-feed-expiry — MATCH and TOURNAMENT types", () => {
  it("expires MATCH after post-event grace", () => {
    const match = makeEvent({
      type: "MATCH",
      startAt: "2026-08-24T15:00:00.000Z",
      endAt: "2026-08-24T16:30:00.000Z",
    });
    expect(isScreen1EventActiveAt(match, new Date("2026-08-24T16:30:00.000Z"))).toBe(
      true,
    );
    expect(isScreen1EventActiveAt(match, new Date("2026-08-24T16:45:00.000Z"))).toBe(
      false,
    );
  });

  it("expires TOURNAMENT after post-event grace", () => {
    const tournament = makeEvent({
      type: "TOURNAMENT",
      startAt: "2026-08-24T08:00:00.000Z",
      endAt: "2026-08-24T12:00:00.000Z",
    });
    expect(
      isScreen1EventActiveAt(tournament, new Date("2026-08-24T12:00:00.000Z")),
    ).toBe(true);
    expect(
      isScreen1EventActiveAt(tournament, new Date("2026-08-24T12:15:00.000Z")),
    ).toBe(false);
  });

  it("uses default duration when endAt is null", () => {
    const training = makeEvent({
      startAt: "2026-08-24T15:00:00.000Z",
      endAt: null,
    });
    // 90-minute default → ends 16:30Z
    expect(isScreen1EventActiveAt(training, new Date("2026-08-24T16:29:00.000Z"))).toBe(
      true,
    );
    expect(isScreen1EventActiveAt(training, new Date("2026-08-24T16:30:00.000Z"))).toBe(
      true,
    );
    expect(isScreen1EventActiveAt(training, new Date("2026-08-24T16:45:00.000Z"))).toBe(
      false,
    );
  });
});
