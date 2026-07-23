/**
 * lib/publishing/policy/__tests__/publication-policy.test.ts
 *
 * Unit tests for the channel publication policy.
 *
 * Coverage:
 * - Six explicit publication channels
 * - Ten explicit decision reasons
 * - Evaluation order: tenant → status → type → visibility → channel-specific → eligible
 * - Shared infoboard policy (Screen 1 and Screen 2 produce identical decisions)
 * - All infoboard event-type rules
 * - All website channel rules
 *
 * No mocks required: all functions under test are pure.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateForChannel,
  PublicationChannel,
  DecisionReason,
} from "../publication-policy";
import type { PolicyEvent } from "../publication-policy";

// ── Fixtures ───────────────────────────────────────────────────────────────────

/** A fully-eligible infoboard event; override individual fields per test. */
function infoboardEvent(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
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

/** A fully-eligible WEBSITE_MATCHES event. */
function websiteMatchEvent(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    tenantActive: true,
    status: "SCHEDULED",
    type: "MATCH",
    matchLocation: "HOME",
    isVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    ...overrides,
  };
}

/** A fully-eligible WEBSITE_TRAININGSPLAN event. */
function websiteTrainingEvent(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    tenantActive: true,
    status: "SCHEDULED",
    type: "TRAINING",
    matchLocation: null,
    isVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    ...overrides,
  };
}

/** A fully-eligible WEBSITE_TOURNAMENTS event. */
function websiteTournamentEvent(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    tenantActive: true,
    status: "SCHEDULED",
    type: "TOURNAMENT",
    matchLocation: null,
    isVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    ...overrides,
  };
}

/** A fully-eligible WEBSITE_CLUB_EVENTS event. */
function websiteClubEvent(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    tenantActive: true,
    status: "SCHEDULED",
    type: "OTHER",
    matchLocation: null,
    isVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    ...overrides,
  };
}

// ── Tenant step ────────────────────────────────────────────────────────────────

describe("tenant step — TENANT_INACTIVE is the first check on all channels", () => {
  const channels = [
    PublicationChannel.INFOBOARD_SCREEN_1,
    PublicationChannel.INFOBOARD_SCREEN_2,
    PublicationChannel.WEBSITE_MATCHES,
    PublicationChannel.WEBSITE_TRAININGSPLAN,
    PublicationChannel.WEBSITE_TOURNAMENTS,
    PublicationChannel.WEBSITE_CLUB_EVENTS,
  ] as const;

  for (const channel of channels) {
    it(`${channel}: inactive tenant → TENANT_INACTIVE before any other check`, () => {
      const event = infoboardEvent({ tenantActive: false, status: "SCHEDULED" });
      const result = evaluateForChannel(event, channel);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(DecisionReason.TENANT_INACTIVE);
    });
  }
});

// ── Status step ────────────────────────────────────────────────────────────────

describe("status step — evaluated after tenant, before type", () => {
  it("DRAFT event → STATUS_DRAFT", () => {
    const event = infoboardEvent({ status: "DRAFT" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(DecisionReason.STATUS_DRAFT);
  });

  it("CANCELLED event → STATUS_CANCELLED", () => {
    const event = infoboardEvent({ status: "CANCELLED" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(DecisionReason.STATUS_CANCELLED);
  });

  it("ARCHIVED event → STATUS_ARCHIVED", () => {
    const event = infoboardEvent({ status: "ARCHIVED" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(DecisionReason.STATUS_ARCHIVED);
  });

  it("SCHEDULED event passes the status step", () => {
    const event = infoboardEvent({ status: "SCHEDULED" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.reason).not.toBe(DecisionReason.STATUS_DRAFT);
    expect(result.reason).not.toBe(DecisionReason.STATUS_CANCELLED);
    expect(result.reason).not.toBe(DecisionReason.STATUS_ARCHIVED);
  });

  it("LIVE event passes the status step", () => {
    const event = infoboardEvent({ status: "LIVE" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.reason).not.toBe(DecisionReason.STATUS_DRAFT);
  });

  it("COMPLETED event passes the status step", () => {
    const event = infoboardEvent({ status: "COMPLETED" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.reason).not.toBe(DecisionReason.STATUS_DRAFT);
  });

  it("POSTPONED event passes the status step", () => {
    const event = infoboardEvent({ status: "POSTPONED" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.reason).not.toBe(DecisionReason.STATUS_DRAFT);
    expect(result.reason).not.toBe(DecisionReason.STATUS_CANCELLED);
    expect(result.reason).not.toBe(DecisionReason.STATUS_ARCHIVED);
  });

  it("status is checked before type: DRAFT event with unsupported type → STATUS_DRAFT (not TYPE_NOT_SUPPORTED)", () => {
    const event = infoboardEvent({ status: "DRAFT", type: "VACATION_PERIOD" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.reason).toBe(DecisionReason.STATUS_DRAFT);
  });
});

// ── Type step ──────────────────────────────────────────────────────────────────

describe("type step — evaluated after status, before visibility", () => {
  it("infoboard: VACATION_PERIOD → TYPE_NOT_SUPPORTED", () => {
    const event = infoboardEvent({ type: "VACATION_PERIOD" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(DecisionReason.TYPE_NOT_SUPPORTED);
  });

  it("infoboard: OTHER → TYPE_NOT_SUPPORTED", () => {
    const event = infoboardEvent({ type: "OTHER" });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(DecisionReason.TYPE_NOT_SUPPORTED);
  });

  it("type is checked before visibility: unsupported type with isVisible=false → TYPE_NOT_SUPPORTED (not NOT_VISIBLE)", () => {
    const event = infoboardEvent({ type: "OTHER", isVisible: false });
    const result = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
    expect(result.reason).toBe(DecisionReason.TYPE_NOT_SUPPORTED);
  });
});

// ── Infoboard shared policy (Screen 1 and Screen 2) ───────────────────────────

describe("infoboard shared policy — Screen 1 and Screen 2 return identical decisions", () => {
  const pairs: [string, PolicyEvent][] = [
    ["eligible TRAINING", infoboardEvent({ type: "TRAINING" })],
    ["eligible HOME MATCH", infoboardEvent({ type: "MATCH", matchLocation: "HOME" })],
    ["eligible TOURNAMENT", infoboardEvent({ type: "TOURNAMENT" })],
    ["AWAY MATCH (not HOME)", infoboardEvent({ type: "MATCH", matchLocation: "AWAY" })],
    ["inactive tenant", infoboardEvent({ tenantActive: false })],
    ["DRAFT status", infoboardEvent({ status: "DRAFT" })],
    ["TYPE not supported (OTHER)", infoboardEvent({ type: "OTHER" })],
    ["not visible", infoboardEvent({ isVisible: false })],
  ];

  for (const [label, event] of pairs) {
    it(`Screen 1 and Screen 2 agree: ${label}`, () => {
      const screen1 = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1);
      const screen2 = evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_2);
      expect(screen1).toEqual(screen2);
    });
  }
});

// ── Infoboard: supported event types ─────────────────────────────────────────

describe("infoboard supported event types", () => {
  it("TRAINING is eligible", () => {
    const event = infoboardEvent({ type: "TRAINING" });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: true,
      reason: DecisionReason.ELIGIBLE,
    });
  });

  it("TOURNAMENT is eligible", () => {
    const event = infoboardEvent({ type: "TOURNAMENT" });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: true,
      reason: DecisionReason.ELIGIBLE,
    });
  });

  it("HOME MATCH is eligible", () => {
    const event = infoboardEvent({ type: "MATCH", matchLocation: "HOME" });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: true,
      reason: DecisionReason.ELIGIBLE,
    });
  });

  it("OTHER is not supported", () => {
    const event = infoboardEvent({ type: "OTHER" });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: false,
      reason: DecisionReason.TYPE_NOT_SUPPORTED,
    });
  });

  it("VACATION_PERIOD is not supported", () => {
    const event = infoboardEvent({ type: "VACATION_PERIOD" });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: false,
      reason: DecisionReason.TYPE_NOT_SUPPORTED,
    });
  });
});

// ── Infoboard: MATCH requires HOME ───────────────────────────────────────────

describe("infoboard: MATCH requires HOME", () => {
  it("AWAY MATCH → INFOBOARD_MATCH_NOT_HOME", () => {
    const event = infoboardEvent({ type: "MATCH", matchLocation: "AWAY" });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: false,
      reason: DecisionReason.INFOBOARD_MATCH_NOT_HOME,
    });
  });

  it("NEUTRAL MATCH → INFOBOARD_MATCH_NOT_HOME", () => {
    const event = infoboardEvent({ type: "MATCH", matchLocation: "NEUTRAL" });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: false,
      reason: DecisionReason.INFOBOARD_MATCH_NOT_HOME,
    });
  });

  it("MATCH with null location → INFOBOARD_MATCH_NOT_HOME", () => {
    const event = infoboardEvent({ type: "MATCH", matchLocation: null });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: false,
      reason: DecisionReason.INFOBOARD_MATCH_NOT_HOME,
    });
  });

  it("HOME MATCH → ELIGIBLE", () => {
    const event = infoboardEvent({ type: "MATCH", matchLocation: "HOME" });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: true,
      reason: DecisionReason.ELIGIBLE,
    });
  });

  it("MATCH location is checked AFTER visibility: NOT_VISIBLE before INFOBOARD_MATCH_NOT_HOME", () => {
    const event = infoboardEvent({
      type: "MATCH",
      matchLocation: "AWAY",
      isVisible: false,
    });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: false,
      reason: DecisionReason.NOT_VISIBLE,
    });
  });
});

// ── Infoboard: visibility step ────────────────────────────────────────────────

describe("infoboard visibility step (isVisible)", () => {
  it("TRAINING with isVisible=false → NOT_VISIBLE", () => {
    const event = infoboardEvent({ type: "TRAINING", isVisible: false });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: false,
      reason: DecisionReason.NOT_VISIBLE,
    });
  });

  it("TOURNAMENT with isVisible=false → NOT_VISIBLE", () => {
    const event = infoboardEvent({ type: "TOURNAMENT", isVisible: false });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: false,
      reason: DecisionReason.NOT_VISIBLE,
    });
  });

  it("visible TOURNAMENT → ELIGIBLE", () => {
    const event = infoboardEvent({ type: "TOURNAMENT", isVisible: true });
    expect(evaluateForChannel(event, PublicationChannel.INFOBOARD_SCREEN_1)).toEqual({
      eligible: true,
      reason: DecisionReason.ELIGIBLE,
    });
  });
});

// ── WEBSITE_MATCHES ────────────────────────────────────────────────────────────

describe("WEBSITE_MATCHES channel", () => {
  it("HOME MATCH with websiteVisible=true → ELIGIBLE", () => {
    const event = websiteMatchEvent({ matchLocation: "HOME" });
    expect(evaluateForChannel(event, PublicationChannel.WEBSITE_MATCHES)).toEqual({
      eligible: true,
      reason: DecisionReason.ELIGIBLE,
    });
  });

  it("AWAY MATCH with websiteVisible=true → ELIGIBLE", () => {
    const event = websiteMatchEvent({ matchLocation: "AWAY" });
    expect(evaluateForChannel(event, PublicationChannel.WEBSITE_MATCHES)).toEqual({
      eligible: true,
      reason: DecisionReason.ELIGIBLE,
    });
  });

  it("TRAINING type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteMatchEvent({ type: "TRAINING", matchLocation: null });
    expect(evaluateForChannel(event, PublicationChannel.WEBSITE_MATCHES)).toEqual({
      eligible: false,
      reason: DecisionReason.TYPE_NOT_SUPPORTED,
    });
  });

  it("TOURNAMENT type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteMatchEvent({ type: "TOURNAMENT", matchLocation: null });
    expect(evaluateForChannel(event, PublicationChannel.WEBSITE_MATCHES)).toEqual({
      eligible: false,
      reason: DecisionReason.TYPE_NOT_SUPPORTED,
    });
  });

  it("MATCH with websiteVisible=false → WEBSITE_VISIBILITY_REQUIRED", () => {
    const event = websiteMatchEvent({ websiteVisible: false });
    expect(evaluateForChannel(event, PublicationChannel.WEBSITE_MATCHES)).toEqual({
      eligible: false,
      reason: DecisionReason.WEBSITE_VISIBILITY_REQUIRED,
    });
  });

  it("DRAFT MATCH → STATUS_DRAFT before WEBSITE_VISIBILITY_REQUIRED", () => {
    const event = websiteMatchEvent({ status: "DRAFT", websiteVisible: false });
    expect(evaluateForChannel(event, PublicationChannel.WEBSITE_MATCHES)).toEqual({
      eligible: false,
      reason: DecisionReason.STATUS_DRAFT,
    });
  });
});

// ── WEBSITE_TRAININGSPLAN ──────────────────────────────────────────────────────

describe("WEBSITE_TRAININGSPLAN channel", () => {
  it("TRAINING with websiteVisible=true and trainingsplanVisible=true → ELIGIBLE", () => {
    const event = websiteTrainingEvent();
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TRAININGSPLAN),
    ).toEqual({ eligible: true, reason: DecisionReason.ELIGIBLE });
  });

  it("TRAINING with websiteVisible=false → WEBSITE_VISIBILITY_REQUIRED (checked before trainingsplanVisible)", () => {
    const event = websiteTrainingEvent({
      websiteVisible: false,
      trainingsplanVisible: false,
    });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TRAININGSPLAN),
    ).toEqual({
      eligible: false,
      reason: DecisionReason.WEBSITE_VISIBILITY_REQUIRED,
    });
  });

  it("TRAINING with websiteVisible=true but trainingsplanVisible=false → TRAININGSPLAN_VISIBILITY_REQUIRED", () => {
    const event = websiteTrainingEvent({ trainingsplanVisible: false });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TRAININGSPLAN),
    ).toEqual({
      eligible: false,
      reason: DecisionReason.TRAININGSPLAN_VISIBILITY_REQUIRED,
    });
  });

  it("MATCH type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteTrainingEvent({ type: "MATCH", matchLocation: "HOME" });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TRAININGSPLAN),
    ).toEqual({ eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED });
  });

  it("TOURNAMENT type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteTrainingEvent({ type: "TOURNAMENT" });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TRAININGSPLAN),
    ).toEqual({ eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED });
  });
});

// ── WEBSITE_TOURNAMENTS ────────────────────────────────────────────────────────

describe("WEBSITE_TOURNAMENTS channel", () => {
  it("TOURNAMENT with websiteVisible=true → ELIGIBLE", () => {
    const event = websiteTournamentEvent();
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TOURNAMENTS),
    ).toEqual({ eligible: true, reason: DecisionReason.ELIGIBLE });
  });

  it("TOURNAMENT with websiteVisible=false → WEBSITE_VISIBILITY_REQUIRED", () => {
    const event = websiteTournamentEvent({ websiteVisible: false });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TOURNAMENTS),
    ).toEqual({
      eligible: false,
      reason: DecisionReason.WEBSITE_VISIBILITY_REQUIRED,
    });
  });

  it("MATCH type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteTournamentEvent({ type: "MATCH", matchLocation: "HOME" });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TOURNAMENTS),
    ).toEqual({ eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED });
  });

  it("TRAINING type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteTournamentEvent({ type: "TRAINING" });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TOURNAMENTS),
    ).toEqual({ eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED });
  });

  it("OTHER type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteTournamentEvent({ type: "OTHER" });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_TOURNAMENTS),
    ).toEqual({ eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED });
  });
});

// ── WEBSITE_CLUB_EVENTS ────────────────────────────────────────────────────────

describe("WEBSITE_CLUB_EVENTS channel", () => {
  it("OTHER with websiteVisible=true → ELIGIBLE", () => {
    const event = websiteClubEvent();
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_CLUB_EVENTS),
    ).toEqual({ eligible: true, reason: DecisionReason.ELIGIBLE });
  });

  it("MATCH type → TYPE_NOT_SUPPORTED (only OTHER accepted)", () => {
    const event = websiteClubEvent({ type: "MATCH", matchLocation: "HOME" });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_CLUB_EVENTS),
    ).toEqual({ eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED });
  });

  it("TRAINING type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteClubEvent({ type: "TRAINING" });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_CLUB_EVENTS),
    ).toEqual({ eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED });
  });

  it("TOURNAMENT type → TYPE_NOT_SUPPORTED", () => {
    const event = websiteClubEvent({ type: "TOURNAMENT" });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_CLUB_EVENTS),
    ).toEqual({ eligible: false, reason: DecisionReason.TYPE_NOT_SUPPORTED });
  });

  it("OTHER with websiteVisible=false → WEBSITE_VISIBILITY_REQUIRED", () => {
    const event = websiteClubEvent({ websiteVisible: false });
    expect(
      evaluateForChannel(event, PublicationChannel.WEBSITE_CLUB_EVENTS),
    ).toEqual({
      eligible: false,
      reason: DecisionReason.WEBSITE_VISIBILITY_REQUIRED,
    });
  });
});

// ── All ten decision reasons are reachable ─────────────────────────────────────

describe("all ten decision reasons are reachable", () => {
  it("TENANT_INACTIVE is reachable", () => {
    const e = infoboardEvent({ tenantActive: false });
    expect(evaluateForChannel(e, PublicationChannel.INFOBOARD_SCREEN_1).reason).toBe(
      DecisionReason.TENANT_INACTIVE,
    );
  });

  it("STATUS_DRAFT is reachable", () => {
    const e = infoboardEvent({ status: "DRAFT" });
    expect(evaluateForChannel(e, PublicationChannel.INFOBOARD_SCREEN_1).reason).toBe(
      DecisionReason.STATUS_DRAFT,
    );
  });

  it("STATUS_CANCELLED is reachable", () => {
    const e = infoboardEvent({ status: "CANCELLED" });
    expect(evaluateForChannel(e, PublicationChannel.INFOBOARD_SCREEN_1).reason).toBe(
      DecisionReason.STATUS_CANCELLED,
    );
  });

  it("STATUS_ARCHIVED is reachable", () => {
    const e = infoboardEvent({ status: "ARCHIVED" });
    expect(evaluateForChannel(e, PublicationChannel.INFOBOARD_SCREEN_1).reason).toBe(
      DecisionReason.STATUS_ARCHIVED,
    );
  });

  it("TYPE_NOT_SUPPORTED is reachable", () => {
    const e = infoboardEvent({ type: "OTHER" });
    expect(evaluateForChannel(e, PublicationChannel.INFOBOARD_SCREEN_1).reason).toBe(
      DecisionReason.TYPE_NOT_SUPPORTED,
    );
  });

  it("NOT_VISIBLE is reachable", () => {
    const e = infoboardEvent({ isVisible: false });
    expect(evaluateForChannel(e, PublicationChannel.INFOBOARD_SCREEN_1).reason).toBe(
      DecisionReason.NOT_VISIBLE,
    );
  });

  it("INFOBOARD_MATCH_NOT_HOME is reachable", () => {
    const e = infoboardEvent({ type: "MATCH", matchLocation: "AWAY" });
    expect(evaluateForChannel(e, PublicationChannel.INFOBOARD_SCREEN_1).reason).toBe(
      DecisionReason.INFOBOARD_MATCH_NOT_HOME,
    );
  });

  it("WEBSITE_VISIBILITY_REQUIRED is reachable", () => {
    const e = websiteMatchEvent({ websiteVisible: false });
    expect(evaluateForChannel(e, PublicationChannel.WEBSITE_MATCHES).reason).toBe(
      DecisionReason.WEBSITE_VISIBILITY_REQUIRED,
    );
  });

  it("TRAININGSPLAN_VISIBILITY_REQUIRED is reachable", () => {
    const e = websiteTrainingEvent({ trainingsplanVisible: false });
    expect(
      evaluateForChannel(e, PublicationChannel.WEBSITE_TRAININGSPLAN).reason,
    ).toBe(DecisionReason.TRAININGSPLAN_VISIBILITY_REQUIRED);
  });

  it("ELIGIBLE is reachable", () => {
    const e = infoboardEvent({ type: "TRAINING" });
    expect(evaluateForChannel(e, PublicationChannel.INFOBOARD_SCREEN_1).reason).toBe(
      DecisionReason.ELIGIBLE,
    );
  });
});

// ── All six channels are defined ───────────────────────────────────────────────

describe("PublicationChannel enum has exactly six values", () => {
  it("contains exactly six channels", () => {
    expect(Object.keys(PublicationChannel)).toHaveLength(6);
  });

  it("contains INFOBOARD_SCREEN_1", () => {
    expect(PublicationChannel.INFOBOARD_SCREEN_1).toBe("INFOBOARD_SCREEN_1");
  });

  it("contains INFOBOARD_SCREEN_2", () => {
    expect(PublicationChannel.INFOBOARD_SCREEN_2).toBe("INFOBOARD_SCREEN_2");
  });

  it("contains WEBSITE_MATCHES", () => {
    expect(PublicationChannel.WEBSITE_MATCHES).toBe("WEBSITE_MATCHES");
  });

  it("contains WEBSITE_TRAININGSPLAN", () => {
    expect(PublicationChannel.WEBSITE_TRAININGSPLAN).toBe("WEBSITE_TRAININGSPLAN");
  });

  it("contains WEBSITE_TOURNAMENTS", () => {
    expect(PublicationChannel.WEBSITE_TOURNAMENTS).toBe("WEBSITE_TOURNAMENTS");
  });

  it("contains WEBSITE_CLUB_EVENTS", () => {
    expect(PublicationChannel.WEBSITE_CLUB_EVENTS).toBe("WEBSITE_CLUB_EVENTS");
  });
});

// ── DecisionReason enum has exactly ten values ─────────────────────────────────

describe("DecisionReason enum has exactly ten values", () => {
  it("contains exactly ten reasons", () => {
    expect(Object.keys(DecisionReason)).toHaveLength(10);
  });
});
