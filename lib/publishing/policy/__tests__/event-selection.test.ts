/**
 * lib/publishing/policy/__tests__/event-selection.test.ts
 *
 * Unit tests for the event selection service.
 *
 * Coverage:
 * - Injected event loader contract
 * - Loader is called exactly once
 * - Original ordering is preserved
 * - Input events and arrays are not mutated
 * - Loader errors are propagated unchanged
 * - Eligible events are correctly filtered per channel
 *
 * No external mocks needed — all dependencies are injected.
 */

import { describe, it, expect, vi } from "vitest";
import { selectEventsForChannel } from "../event-selection";
import { PublicationChannel } from "../publication-policy";
import type { PolicyEvent } from "../publication-policy";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeTraining(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    tenantActive: true,
    status: "SCHEDULED",
    type: "TRAINING",
    matchLocation: null,
    isVisible: true,
    websiteVisible: false,
    trainingsplanVisible: false,
    ...overrides,
  };
}

function makeHomeMatch(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    tenantActive: true,
    status: "SCHEDULED",
    type: "MATCH",
    matchLocation: "HOME",
    isVisible: true,
    websiteVisible: false,
    trainingsplanVisible: false,
    ...overrides,
  };
}

function makeAwayMatch(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    tenantActive: true,
    status: "SCHEDULED",
    type: "MATCH",
    matchLocation: "AWAY",
    isVisible: true,
    websiteVisible: false,
    trainingsplanVisible: false,
    ...overrides,
  };
}

// ── Loader is called exactly once ─────────────────────────────────────────────

describe("loader contract", () => {
  it("calls the loader exactly once", async () => {
    const loader = vi.fn().mockResolvedValue([makeTraining()]);
    await selectEventsForChannel(PublicationChannel.INFOBOARD_SCREEN_1, loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("calls the loader exactly once even with multiple eligible events", async () => {
    const events = [makeTraining(), makeTraining(), makeHomeMatch()];
    const loader = vi.fn().mockResolvedValue(events);
    await selectEventsForChannel(PublicationChannel.INFOBOARD_SCREEN_1, loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("calls the loader exactly once when no events are eligible", async () => {
    const loader = vi.fn().mockResolvedValue([]);
    await selectEventsForChannel(PublicationChannel.INFOBOARD_SCREEN_1, loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("accepts a synchronous loader (returns T[] directly)", async () => {
    const loader = vi.fn().mockReturnValue([makeTraining()]);
    const result = await selectEventsForChannel(
      PublicationChannel.INFOBOARD_SCREEN_1,
      loader,
    );
    expect(result).toHaveLength(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

// ── Filtering behaviour ────────────────────────────────────────────────────────

describe("filtering: eligible events are returned, ineligible events are excluded", () => {
  it("returns empty array when loader returns empty array", async () => {
    const result = await selectEventsForChannel(
      PublicationChannel.INFOBOARD_SCREEN_1,
      () => [],
    );
    expect(result).toEqual([]);
  });

  it("includes eligible infoboard TRAINING events", async () => {
    const event = makeTraining();
    const result = await selectEventsForChannel(
      PublicationChannel.INFOBOARD_SCREEN_1,
      () => [event],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(event);
  });

  it("excludes ineligible DRAFT events from infoboard", async () => {
    const result = await selectEventsForChannel(
      PublicationChannel.INFOBOARD_SCREEN_1,
      () => [makeTraining({ status: "DRAFT" })],
    );
    expect(result).toHaveLength(0);
  });

  it("includes HOME MATCH on infoboard, excludes AWAY MATCH", async () => {
    const home = makeHomeMatch();
    const away = makeAwayMatch();
    const result = await selectEventsForChannel(
      PublicationChannel.INFOBOARD_SCREEN_1,
      () => [home, away],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(home);
  });

  it("includes both HOME and AWAY MATCH on WEBSITE_MATCHES", async () => {
    const home = makeHomeMatch({ websiteVisible: true });
    const away = makeAwayMatch({ websiteVisible: true });
    const result = await selectEventsForChannel(
      PublicationChannel.WEBSITE_MATCHES,
      () => [home, away],
    );
    expect(result).toHaveLength(2);
  });

  it("filters WEBSITE_MATCHES: only websiteVisible MATCH events pass", async () => {
    const visible = makeHomeMatch({ websiteVisible: true });
    const hidden = makeHomeMatch({ websiteVisible: false });
    const result = await selectEventsForChannel(
      PublicationChannel.WEBSITE_MATCHES,
      () => [visible, hidden],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(visible);
  });

  it("filters WEBSITE_TRAININGSPLAN: requires both websiteVisible and trainingsplanVisible", async () => {
    const fullyVisible = makeTraining({
      websiteVisible: true,
      trainingsplanVisible: true,
    });
    const websiteOnly = makeTraining({
      websiteVisible: true,
      trainingsplanVisible: false,
    });
    const neither = makeTraining({
      websiteVisible: false,
      trainingsplanVisible: false,
    });
    const result = await selectEventsForChannel(
      PublicationChannel.WEBSITE_TRAININGSPLAN,
      () => [fullyVisible, websiteOnly, neither],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(fullyVisible);
  });

  it("filters WEBSITE_TOURNAMENTS: requires websiteVisible, accepts TOURNAMENT only", async () => {
    const tournament = {
      tenantActive: true,
      status: "SCHEDULED" as const,
      type: "TOURNAMENT" as const,
      matchLocation: null,
      isVisible: true,
      websiteVisible: true,
      trainingsplanVisible: false,
    };
    const hiddenTournament = { ...tournament, websiteVisible: false };
    const trainingEvent = makeTraining({ websiteVisible: true });

    const result = await selectEventsForChannel(
      PublicationChannel.WEBSITE_TOURNAMENTS,
      () => [tournament, hiddenTournament, trainingEvent],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(tournament);
  });

  it("filters WEBSITE_CLUB_EVENTS: accepts OTHER type only", async () => {
    const clubEvent = {
      tenantActive: true,
      status: "SCHEDULED" as const,
      type: "OTHER" as const,
      matchLocation: null,
      isVisible: true,
      websiteVisible: true,
      trainingsplanVisible: false,
    };
    const matchEvent = makeHomeMatch({ websiteVisible: true });
    const result = await selectEventsForChannel(
      PublicationChannel.WEBSITE_CLUB_EVENTS,
      () => [clubEvent, matchEvent],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(clubEvent);
  });
});

// ── Ordering is preserved ──────────────────────────────────────────────────────

describe("ordering: original input ordering is preserved in output", () => {
  it("preserves the order of eligible events from the loader", async () => {
    const e1 = makeTraining();
    const e2 = makeHomeMatch();
    const e3 = makeTraining();
    const result = await selectEventsForChannel(
      PublicationChannel.INFOBOARD_SCREEN_1,
      () => [e1, e2, e3],
    );
    expect(result[0]).toBe(e1);
    expect(result[1]).toBe(e2);
    expect(result[2]).toBe(e3);
  });

  it("preserves relative ordering when some events are filtered out", async () => {
    const e1 = makeTraining();
    const e2 = makeTraining({ status: "DRAFT" }); // filtered
    const e3 = makeHomeMatch();
    const e4 = makeTraining({ type: "OTHER" }); // filtered (wrong type)
    const e5 = makeTraining();
    const result = await selectEventsForChannel(
      PublicationChannel.INFOBOARD_SCREEN_1,
      () => [e1, e2, e3, e4, e5],
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(e1);
    expect(result[1]).toBe(e3);
    expect(result[2]).toBe(e5);
  });
});

// ── No mutation ────────────────────────────────────────────────────────────────

describe("no mutation: input array and event objects are not mutated", () => {
  it("does not mutate the array returned by the loader", async () => {
    const events = [makeTraining(), makeHomeMatch(), makeTraining({ status: "DRAFT" })];
    const snapshot = [...events];
    await selectEventsForChannel(PublicationChannel.INFOBOARD_SCREEN_1, () => events);
    expect(events).toHaveLength(snapshot.length);
    expect(events[0]).toBe(snapshot[0]);
    expect(events[1]).toBe(snapshot[1]);
    expect(events[2]).toBe(snapshot[2]);
  });

  it("does not mutate individual event objects", async () => {
    const event = makeTraining();
    const originalStatus = event.status;
    const originalType = event.type;
    await selectEventsForChannel(PublicationChannel.INFOBOARD_SCREEN_1, () => [event]);
    expect(event.status).toBe(originalStatus);
    expect(event.type).toBe(originalType);
  });
});

// ── Loader errors are propagated ──────────────────────────────────────────────

describe("loader error propagation", () => {
  it("propagates a synchronous loader error", async () => {
    const loaderError = new Error("loader failed (sync)");
    const loader = () => {
      throw loaderError;
    };
    await expect(
      selectEventsForChannel(PublicationChannel.INFOBOARD_SCREEN_1, loader),
    ).rejects.toThrow("loader failed (sync)");
  });

  it("propagates an asynchronous loader rejection", async () => {
    const loaderError = new Error("loader failed (async)");
    const loader = async () => {
      throw loaderError;
    };
    await expect(
      selectEventsForChannel(PublicationChannel.INFOBOARD_SCREEN_1, loader),
    ).rejects.toThrow("loader failed (async)");
  });

  it("propagates the original error instance unchanged", async () => {
    const loaderError = new Error("original error");
    await expect(
      selectEventsForChannel(PublicationChannel.INFOBOARD_SCREEN_1, async () => {
        throw loaderError;
      }),
    ).rejects.toThrow(loaderError);
  });
});
