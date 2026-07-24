/**
 * lib/publishing/policy/__tests__/event-selection.test.ts
 *
 * Unit tests for the event selection service.
 *
 * Coverage:
 * - Injected event loader contract (called exactly once, errors propagated)
 * - Correct eligible/rejected partitioning per channel
 * - RejectedPublicationEvent carries the exact PublicationDecision
 * - Original ordering is preserved in both partitions
 * - Input events and arrays are not mutated
 * - channel is not forwarded to the loader
 *
 * No external mocks needed — all dependencies are injected.
 */

import { describe, it, expect, vi } from "vitest";
import {
  selectEventsForPublication,
} from "../event-selection";
import type {
  SelectEventsForPublicationInput,
  PublicationEventLoader,
  PublicationEventLoadInput,
} from "../event-selection";
import type { PublicationPolicyEvent } from "../publication-policy";

// ── Test tenantId ──────────────────────────────────────────────────────────────

const TENANT = "tenant-abc";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeTraining(overrides: Partial<PublicationPolicyEvent> = {}): PublicationPolicyEvent {
  return {
    tenantId: TENANT,
    status: "SCHEDULED",
    type: "TRAINING",
    homeAway: null,
    infoboardVisible: true,
    websiteVisible: false,
    trainingsplanVisible: false,
    ...overrides,
  };
}

function makeHomeMatch(overrides: Partial<PublicationPolicyEvent> = {}): PublicationPolicyEvent {
  return {
    tenantId: TENANT,
    status: "SCHEDULED",
    type: "MATCH",
    homeAway: "HOME",
    infoboardVisible: true,
    websiteVisible: false,
    trainingsplanVisible: false,
    ...overrides,
  };
}

function makeAwayMatch(overrides: Partial<PublicationPolicyEvent> = {}): PublicationPolicyEvent {
  return {
    tenantId: TENANT,
    status: "SCHEDULED",
    type: "MATCH",
    homeAway: "AWAY",
    infoboardVisible: true,
    websiteVisible: false,
    trainingsplanVisible: false,
    ...overrides,
  };
}

function makeInput(
  channel: SelectEventsForPublicationInput["channel"],
  overrides: Partial<Omit<SelectEventsForPublicationInput, "channel">> = {},
): SelectEventsForPublicationInput {
  return { tenantId: TENANT, channel, ...overrides };
}

function makeLoader<T extends PublicationPolicyEvent>(
  events: T[],
): PublicationEventLoader<T> {
  return async (_input: PublicationEventLoadInput) => events;
}

// ── Loader is called exactly once ─────────────────────────────────────────────

describe("loader contract", () => {
  it("calls the loader exactly once", async () => {
    const loader = vi.fn().mockResolvedValue([makeTraining()]);
    await selectEventsForPublication(loader, makeInput("INFOBOARD_SCREEN_1"));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("calls the loader exactly once even with multiple eligible events", async () => {
    const events = [makeTraining(), makeTraining(), makeHomeMatch()];
    const loader = vi.fn().mockResolvedValue(events);
    await selectEventsForPublication(loader, makeInput("INFOBOARD_SCREEN_1"));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("calls the loader exactly once when no events are eligible", async () => {
    const loader = vi.fn().mockResolvedValue([]);
    await selectEventsForPublication(loader, makeInput("INFOBOARD_SCREEN_1"));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not forward channel to the loader", async () => {
    const loader = vi.fn<PublicationEventLoader<PublicationPolicyEvent>>().mockResolvedValue([]);
    await selectEventsForPublication(loader, makeInput("WEBSITE_MATCHES"));
    const receivedInput: PublicationEventLoadInput = loader.mock.calls[0][0];
    expect(receivedInput).not.toHaveProperty("channel");
    expect(receivedInput).toHaveProperty("tenantId", TENANT);
  });

  it("forwards optional loader fields (dateFrom, dateTo, seasonKey, teamSlug)", async () => {
    const loader = vi.fn<PublicationEventLoader<PublicationPolicyEvent>>().mockResolvedValue([]);
    const dateFrom = new Date("2025-01-01");
    const dateTo = new Date("2025-12-31");
    await selectEventsForPublication(
      loader,
      makeInput("WEBSITE_MATCHES", {
        dateFrom,
        dateTo,
        seasonKey: "2025-26",
        teamSlug: "team-a",
      }),
    );
    const receivedInput: PublicationEventLoadInput = loader.mock.calls[0][0];
    expect(receivedInput.dateFrom).toBe(dateFrom);
    expect(receivedInput.dateTo).toBe(dateTo);
    expect(receivedInput.seasonKey).toBe("2025-26");
    expect(receivedInput.teamSlug).toBe("team-a");
  });
});

// ── Result shape ───────────────────────────────────────────────────────────────

describe("result shape: eligible and rejected partitions", () => {
  it("returns { eligible, rejected } arrays", async () => {
    const result = await selectEventsForPublication(
      makeLoader([]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result).toHaveProperty("eligible");
    expect(result).toHaveProperty("rejected");
    expect(Array.isArray(result.eligible)).toBe(true);
    expect(Array.isArray(result.rejected)).toBe(true);
  });

  it("returns empty eligible and rejected when loader returns empty array", async () => {
    const result = await selectEventsForPublication(
      makeLoader([]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.eligible).toEqual([]);
    expect(result.rejected).toEqual([]);
  });
});

// ── Filtering behaviour ────────────────────────────────────────────────────────

describe("filtering: eligible events in eligible[], ineligible events in rejected[]", () => {
  it("includes eligible infoboard TRAINING events in eligible[]", async () => {
    const event = makeTraining();
    const result = await selectEventsForPublication(
      makeLoader([event]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]).toBe(event);
    expect(result.rejected).toHaveLength(0);
  });

  it("puts DRAFT training events in rejected[] with STATUS_NOT_PUBLISHABLE decision", async () => {
    const event = makeTraining({ status: "DRAFT" });
    const result = await selectEventsForPublication(
      makeLoader([event]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.eligible).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].event).toBe(event);
    expect(result.rejected[0].decision).toEqual({
      eligible: false,
      reason: "STATUS_NOT_PUBLISHABLE",
    });
  });

  it("includes HOME MATCH on infoboard in eligible[], puts AWAY MATCH in rejected[] with AWAY_MATCH", async () => {
    const home = makeHomeMatch();
    const away = makeAwayMatch();
    const result = await selectEventsForPublication(
      makeLoader([home, away]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]).toBe(home);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].event).toBe(away);
    expect(result.rejected[0].decision).toEqual({
      eligible: false,
      reason: "AWAY_MATCH",
    });
  });

  it("includes both HOME and AWAY MATCH on WEBSITE_MATCHES in eligible[]", async () => {
    const home = makeHomeMatch({ websiteVisible: true });
    const away = makeAwayMatch({ websiteVisible: true });
    const result = await selectEventsForPublication(
      makeLoader([home, away]),
      makeInput("WEBSITE_MATCHES"),
    );
    expect(result.eligible).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
  });

  it("WEBSITE_MATCHES: websiteVisible=false → WEBSITE_HIDDEN in rejected[]", async () => {
    const visible = makeHomeMatch({ websiteVisible: true });
    const hidden = makeHomeMatch({ websiteVisible: false });
    const result = await selectEventsForPublication(
      makeLoader([visible, hidden]),
      makeInput("WEBSITE_MATCHES"),
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]).toBe(visible);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].decision.reason).toBe("WEBSITE_HIDDEN");
  });

  it("WEBSITE_TRAININGS: requires both websiteVisible and trainingsplanVisible", async () => {
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
    const result = await selectEventsForPublication(
      makeLoader([fullyVisible, websiteOnly, neither]),
      makeInput("WEBSITE_TRAININGS"),
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]).toBe(fullyVisible);
    expect(result.rejected).toHaveLength(2);

    const websiteOnlyRejection = result.rejected.find((r) => r.event === websiteOnly);
    expect(websiteOnlyRejection?.decision.reason).toBe("TRAININGSPLAN_HIDDEN");

    const neitherRejection = result.rejected.find((r) => r.event === neither);
    expect(neitherRejection?.decision.reason).toBe("WEBSITE_HIDDEN");
  });

  it("WEBSITE_TOURNAMENTS: requires websiteVisible, accepts TOURNAMENT only", async () => {
    const tournament: PublicationPolicyEvent = {
      tenantId: TENANT,
      status: "SCHEDULED",
      type: "TOURNAMENT",
      homeAway: null,
      infoboardVisible: true,
      websiteVisible: true,
      trainingsplanVisible: false,
    };
    const hiddenTournament = { ...tournament, websiteVisible: false };
    const trainingEvent = makeTraining({ websiteVisible: true });

    const result = await selectEventsForPublication(
      makeLoader([tournament, hiddenTournament, trainingEvent]),
      makeInput("WEBSITE_TOURNAMENTS"),
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]).toBe(tournament);
    expect(result.rejected).toHaveLength(2);
  });

  it("WEBSITE_CLUB_EVENTS: accepts OTHER type only", async () => {
    const clubEvent: PublicationPolicyEvent = {
      tenantId: TENANT,
      status: "SCHEDULED",
      type: "OTHER",
      homeAway: null,
      infoboardVisible: true,
      websiteVisible: true,
      trainingsplanVisible: false,
    };
    const matchEvent = makeHomeMatch({ websiteVisible: true });
    const result = await selectEventsForPublication(
      makeLoader([clubEvent, matchEvent]),
      makeInput("WEBSITE_CLUB_EVENTS"),
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]).toBe(clubEvent);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].decision.reason).toBe("TYPE_MISMATCH");
  });

  it("tenant mismatch events go into rejected[] with TENANT_MISMATCH", async () => {
    const matching = makeTraining();
    const mismatched = makeTraining({ tenantId: "other-tenant" });
    const result = await selectEventsForPublication(
      makeLoader([matching, mismatched]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]).toBe(matching);
    expect(result.rejected[0].decision.reason).toBe("TENANT_MISMATCH");
  });
});

// ── Ordering is preserved ──────────────────────────────────────────────────────

describe("ordering: original input ordering is preserved in output", () => {
  it("preserves the order of eligible events from the loader", async () => {
    const e1 = makeTraining();
    const e2 = makeHomeMatch();
    const e3 = makeTraining();
    const result = await selectEventsForPublication(
      makeLoader([e1, e2, e3]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.eligible[0]).toBe(e1);
    expect(result.eligible[1]).toBe(e2);
    expect(result.eligible[2]).toBe(e3);
  });

  it("preserves relative ordering in rejected[] when some events are filtered out", async () => {
    const e1 = makeTraining();
    const e2 = makeTraining({ status: "DRAFT" }); // rejected
    const e3 = makeHomeMatch();
    const e4 = makeTraining({ type: "OTHER" }); // rejected (TYPE_MISMATCH)
    const e5 = makeTraining();
    const result = await selectEventsForPublication(
      makeLoader([e1, e2, e3, e4, e5]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.eligible).toHaveLength(3);
    expect(result.eligible[0]).toBe(e1);
    expect(result.eligible[1]).toBe(e3);
    expect(result.eligible[2]).toBe(e5);

    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0].event).toBe(e2);
    expect(result.rejected[1].event).toBe(e4);
  });
});

// ── No mutation ────────────────────────────────────────────────────────────────

describe("no mutation: input array and event objects are not mutated", () => {
  it("does not mutate the array returned by the loader", async () => {
    const events = [makeTraining(), makeHomeMatch(), makeTraining({ status: "DRAFT" })];
    const snapshot = [...events];
    await selectEventsForPublication(makeLoader(events), makeInput("INFOBOARD_SCREEN_1"));
    expect(events).toHaveLength(snapshot.length);
    expect(events[0]).toBe(snapshot[0]);
    expect(events[1]).toBe(snapshot[1]);
    expect(events[2]).toBe(snapshot[2]);
  });

  it("does not mutate individual event objects", async () => {
    const event = makeTraining();
    const originalStatus = event.status;
    const originalType = event.type;
    await selectEventsForPublication(makeLoader([event]), makeInput("INFOBOARD_SCREEN_1"));
    expect(event.status).toBe(originalStatus);
    expect(event.type).toBe(originalType);
  });
});

// ── Loader errors are propagated ──────────────────────────────────────────────

describe("loader error propagation", () => {
  it("propagates a synchronous loader error", async () => {
    const loaderError = new Error("loader failed (sync)");
    const loader = (_input: PublicationEventLoadInput): Promise<PublicationPolicyEvent[]> => {
      throw loaderError;
    };
    await expect(
      selectEventsForPublication(loader, makeInput("INFOBOARD_SCREEN_1")),
    ).rejects.toThrow("loader failed (sync)");
  });

  it("propagates an asynchronous loader rejection", async () => {
    const loaderError = new Error("loader failed (async)");
    const loader = async (_input: PublicationEventLoadInput): Promise<PublicationPolicyEvent[]> => {
      throw loaderError;
    };
    await expect(
      selectEventsForPublication(loader, makeInput("INFOBOARD_SCREEN_1")),
    ).rejects.toThrow("loader failed (async)");
  });

  it("propagates the original error instance unchanged", async () => {
    const loaderError = new Error("original error");
    await expect(
      selectEventsForPublication(
        async (_input) => {
          throw loaderError;
        },
        makeInput("INFOBOARD_SCREEN_1"),
      ),
    ).rejects.toThrow(loaderError);
  });
});

// ── Rejected decisions are exact PublicationDecision values ───────────────────

describe("rejected decisions carry exact PublicationDecision", () => {
  it("rejected event carries { eligible: false, reason }", async () => {
    const event = makeTraining({ status: "ARCHIVED" });
    const result = await selectEventsForPublication(
      makeLoader([event]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.rejected[0].decision.eligible).toBe(false);
    expect(result.rejected[0].decision.reason).toBe("STATUS_NOT_PUBLISHABLE");
  });

  it("HOME_AWAY_UNKNOWN is preserved in rejection decision", async () => {
    const event = makeHomeMatch({ homeAway: null });
    const result = await selectEventsForPublication(
      makeLoader([event]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.rejected[0].decision).toEqual({
      eligible: false,
      reason: "HOME_AWAY_UNKNOWN",
    });
  });

  it("INFOBOARD_HIDDEN is preserved in rejection decision", async () => {
    const event = makeTraining({ infoboardVisible: false });
    const result = await selectEventsForPublication(
      makeLoader([event]),
      makeInput("INFOBOARD_SCREEN_1"),
    );
    expect(result.rejected[0].decision.reason).toBe("INFOBOARD_HIDDEN");
  });
});
