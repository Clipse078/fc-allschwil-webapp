/**
 * lib/publishing/infoboard/__tests__/screen1-event-lifecycle.test.ts
 */

import { describe, expect, it } from "vitest";
import type { InfoboardScreen1Event } from "../../event-types";
import {
  getScreen1DisplayEndAt,
  getScreen1LifecyclePhase,
  isScreen1LifecycleEligibleAt,
  SCREEN1_POST_EVENT_GRACE_MS,
  SCREEN1_PRE_EVENT_RELEVANCE_MS,
} from "../screen1-event-lifecycle";

function training(
  startAt: string,
  endAt: string,
): InfoboardScreen1Event {
  return {
    id: "t1",
    type: "TRAINING",
    displayTitle: "JUNIOREN E3",
    teamDisplayName: "JUNIOREN E3",
    opponentDisplayName: null,
    opponentLogoUrl: null,
    matchPresentation: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt,
    endAt,
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "later",
    seasonKey: "2025-26",
    allocation: {
      pitchLabel: "KR 2 – FELD B",
      homeDressingRoomLabel: "Kabine E2",
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
    },
  };
}

describe("screen1-event-lifecycle", () => {
  const event = training(
    "2026-08-26T13:45:00.000Z",
    "2026-08-26T15:15:00.000Z",
  );

  it("documents lifecycle windows", () => {
    expect(SCREEN1_PRE_EVENT_RELEVANCE_MS).toBe(120 * 60 * 1000);
    expect(SCREEN1_POST_EVENT_GRACE_MS).toBe(15 * 60 * 1000);
  });

  it("returns post-event grace immediately after effective end", () => {
    expect(
      getScreen1LifecyclePhase(event, new Date("2026-08-26T15:15:00.000Z")),
    ).toBe("post-event-grace");
  });

  it("expires after grace window", () => {
    const displayEnd = getScreen1DisplayEndAt(event);
    expect(isScreen1LifecycleEligibleAt(event, displayEnd)).toBe(false);
  });
});
