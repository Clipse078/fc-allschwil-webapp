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
 * - All infoboard event-type rules and homeAway distinctions
 * - All website channel rules
 * - TOURNAMENT_HOSTING_UNVERIFIED is part of the PublicationReason type contract
 *
 * No mocks required: all functions under test are pure.
 */

import { describe, it, expect } from "vitest";
import {
  evaluatePublication,
} from "../publication-policy";
import type {
  PublicationPolicyEvent,
  PublicationChannel,
  PublicationReason,
} from "../publication-policy";

// ── Test tenantId ──────────────────────────────────────────────────────────────

const TENANT = "tenant-abc";

// ── Fixtures ───────────────────────────────────────────────────────────────────

/** A fully-eligible infoboard event; override individual fields per test. */
function infoboardEvent(overrides: Partial<PublicationPolicyEvent> = {}): PublicationPolicyEvent {
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

/** A fully-eligible WEBSITE_MATCHES event. */
function websiteMatchEvent(overrides: Partial<PublicationPolicyEvent> = {}): PublicationPolicyEvent {
  return {
    tenantId: TENANT,
    status: "SCHEDULED",
    type: "MATCH",
    homeAway: "HOME",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    ...overrides,
  };
}

/** A fully-eligible WEBSITE_TRAININGS event. */
function websiteTrainingEvent(overrides: Partial<PublicationPolicyEvent> = {}): PublicationPolicyEvent {
  return {
    tenantId: TENANT,
    status: "SCHEDULED",
    type: "TRAINING",
    homeAway: null,
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    ...overrides,
  };
}

/** A fully-eligible WEBSITE_TOURNAMENTS event. */
function websiteTournamentEvent(overrides: Partial<PublicationPolicyEvent> = {}): PublicationPolicyEvent {
  return {
    tenantId: TENANT,
    status: "SCHEDULED",
    type: "TOURNAMENT",
    homeAway: null,
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    ...overrides,
  };
}

/** A fully-eligible WEBSITE_CLUB_EVENTS event. */
function websiteClubEvent(overrides: Partial<PublicationPolicyEvent> = {}): PublicationPolicyEvent {
  return {
    tenantId: TENANT,
    status: "SCHEDULED",
    type: "OTHER",
    homeAway: null,
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    ...overrides,
  };
}

// ── Tenant step ────────────────────────────────────────────────────────────────

describe("tenant step — TENANT_MISMATCH is the first check on all channels", () => {
  const channels: PublicationChannel[] = [
    "INFOBOARD_SCREEN_1",
    "INFOBOARD_SCREEN_2",
    "WEBSITE_MATCHES",
    "WEBSITE_TRAININGS",
    "WEBSITE_TOURNAMENTS",
    "WEBSITE_CLUB_EVENTS",
  ];

  for (const channel of channels) {
    it(`${channel}: mismatched tenantId → TENANT_MISMATCH before any other check`, () => {
      const event = infoboardEvent({ tenantId: "other-tenant", status: "SCHEDULED" });
      const result = evaluatePublication(event, channel, TENANT);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe<PublicationReason>("TENANT_MISMATCH");
    });
  }

  it("tenant mismatch beats status: mismatched tenant + DRAFT → TENANT_MISMATCH", () => {
    const event = infoboardEvent({ tenantId: "other-tenant", status: "DRAFT" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.reason).toBe<PublicationReason>("TENANT_MISMATCH");
  });

  it("null tenantId mismatches a non-null tenantId argument", () => {
    const event = infoboardEvent({ tenantId: null });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe<PublicationReason>("TENANT_MISMATCH");
  });
});

// ── Status step ────────────────────────────────────────────────────────────────

describe("status step — STATUS_NOT_PUBLISHABLE for all non-publishable statuses", () => {
  it("DRAFT event → STATUS_NOT_PUBLISHABLE", () => {
    const event = infoboardEvent({ status: "DRAFT" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("CANCELLED event → STATUS_NOT_PUBLISHABLE", () => {
    const event = infoboardEvent({ status: "CANCELLED" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("ARCHIVED event → STATUS_NOT_PUBLISHABLE", () => {
    const event = infoboardEvent({ status: "ARCHIVED" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("unknown status → STATUS_NOT_PUBLISHABLE", () => {
    const event = infoboardEvent({ status: "UNKNOWN_FUTURE_STATUS" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("SCHEDULED event passes the status step", () => {
    const event = infoboardEvent({ status: "SCHEDULED" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.reason).not.toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("LIVE event passes the status step", () => {
    const event = infoboardEvent({ status: "LIVE" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.reason).not.toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("COMPLETED event passes the status step", () => {
    const event = infoboardEvent({ status: "COMPLETED" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.reason).not.toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("POSTPONED event passes the status step", () => {
    const event = infoboardEvent({ status: "POSTPONED" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.reason).not.toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("status beats type: DRAFT event with unsupported type → STATUS_NOT_PUBLISHABLE (not TYPE_MISMATCH)", () => {
    const event = infoboardEvent({ status: "DRAFT", type: "VACATION_PERIOD" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.reason).toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });
});

// ── Type step ──────────────────────────────────────────────────────────────────

describe("type step — TYPE_MISMATCH evaluated after status, before visibility", () => {
  it("infoboard: VACATION_PERIOD → TYPE_MISMATCH", () => {
    const event = infoboardEvent({ type: "VACATION_PERIOD" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe<PublicationReason>("TYPE_MISMATCH");
  });

  it("infoboard: OTHER → TYPE_MISMATCH", () => {
    const event = infoboardEvent({ type: "OTHER" });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe<PublicationReason>("TYPE_MISMATCH");
  });

  it("type beats visibility: unsupported type with infoboardVisible=false → TYPE_MISMATCH (not INFOBOARD_HIDDEN)", () => {
    const event = infoboardEvent({ type: "OTHER", infoboardVisible: false });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.reason).toBe<PublicationReason>("TYPE_MISMATCH");
  });

  it("WEBSITE_CLUB_EVENTS: VACATION_PERIOD → TYPE_MISMATCH", () => {
    const event = websiteClubEvent({ type: "VACATION_PERIOD" });
    const result = evaluatePublication(event, "WEBSITE_CLUB_EVENTS", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe<PublicationReason>("TYPE_MISMATCH");
  });
});

// ── Infoboard shared policy (Screen 1 and Screen 2) ───────────────────────────

describe("infoboard shared policy — Screen 1 and Screen 2 return identical decisions", () => {
  const pairs: [string, PublicationPolicyEvent][] = [
    ["eligible TRAINING", infoboardEvent({ type: "TRAINING" })],
    ["eligible HOME MATCH", infoboardEvent({ type: "MATCH", homeAway: "HOME" })],
    ["eligible TOURNAMENT", infoboardEvent({ type: "TOURNAMENT" })],
    ["AWAY MATCH", infoboardEvent({ type: "MATCH", homeAway: "AWAY" })],
    ["null homeAway MATCH", infoboardEvent({ type: "MATCH", homeAway: null })],
    ["NEUTRAL homeAway MATCH", infoboardEvent({ type: "MATCH", homeAway: "NEUTRAL" })],
    ["tenant mismatch", infoboardEvent({ tenantId: "other" })],
    ["DRAFT status", infoboardEvent({ status: "DRAFT" })],
    ["TYPE not supported (OTHER)", infoboardEvent({ type: "OTHER" })],
    ["infoboard hidden", infoboardEvent({ infoboardVisible: false })],
  ];

  for (const [label, event] of pairs) {
    it(`Screen 1 and Screen 2 agree: ${label}`, () => {
      const screen1 = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
      const screen2 = evaluatePublication(event, "INFOBOARD_SCREEN_2", TENANT);
      expect(screen1).toEqual(screen2);
    });
  }
});

// ── Infoboard: supported event types ─────────────────────────────────────────

describe("infoboard supported event types", () => {
  it("TRAINING is eligible", () => {
    const event = infoboardEvent({ type: "TRAINING" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("TOURNAMENT is eligible", () => {
    const event = infoboardEvent({ type: "TOURNAMENT" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("HOME MATCH is eligible", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: "HOME" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("OTHER is TYPE_MISMATCH", () => {
    const event = infoboardEvent({ type: "OTHER" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("VACATION_PERIOD is TYPE_MISMATCH", () => {
    const event = infoboardEvent({ type: "VACATION_PERIOD" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });
});

// ── Infoboard: MATCH homeAway handling ────────────────────────────────────────

describe("infoboard: MATCH homeAway — AWAY_MATCH vs HOME_AWAY_UNKNOWN", () => {
  it("AWAY MATCH → AWAY_MATCH", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: "AWAY" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "AWAY_MATCH",
    });
  });

  it("NEUTRAL MATCH → HOME_AWAY_UNKNOWN (not AWAY_MATCH)", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: "NEUTRAL" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "HOME_AWAY_UNKNOWN",
    });
  });

  it("null homeAway → HOME_AWAY_UNKNOWN", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: null });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "HOME_AWAY_UNKNOWN",
    });
  });

  it("blank homeAway → HOME_AWAY_UNKNOWN", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: "   " });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "HOME_AWAY_UNKNOWN",
    });
  });

  it("unrecognized homeAway → HOME_AWAY_UNKNOWN", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: "UNKNOWN_VALUE" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "HOME_AWAY_UNKNOWN",
    });
  });

  it("homeAway normalised: lowercase 'home' → ELIGIBLE", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: "home" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("homeAway normalised: lowercase 'away' → AWAY_MATCH", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: "away" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "AWAY_MATCH",
    });
  });

  it("HOME MATCH → ELIGIBLE", () => {
    const event = infoboardEvent({ type: "MATCH", homeAway: "HOME" });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("visibility beats homeAway: infoboardVisible=false on AWAY MATCH → INFOBOARD_HIDDEN (not AWAY_MATCH)", () => {
    const event = infoboardEvent({
      type: "MATCH",
      homeAway: "AWAY",
      infoboardVisible: false,
    });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "INFOBOARD_HIDDEN",
    });
  });
});

// ── Infoboard: visibility step ────────────────────────────────────────────────

describe("infoboard visibility step (infoboardVisible)", () => {
  it("TRAINING with infoboardVisible=false → INFOBOARD_HIDDEN", () => {
    const event = infoboardEvent({ type: "TRAINING", infoboardVisible: false });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "INFOBOARD_HIDDEN",
    });
  });

  it("TOURNAMENT with infoboardVisible=false → INFOBOARD_HIDDEN", () => {
    const event = infoboardEvent({ type: "TOURNAMENT", infoboardVisible: false });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: false,
      reason: "INFOBOARD_HIDDEN",
    });
  });

  it("visible TOURNAMENT → ELIGIBLE", () => {
    const event = infoboardEvent({ type: "TOURNAMENT", infoboardVisible: true });
    expect(evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });
});

// ── WEBSITE_MATCHES ────────────────────────────────────────────────────────────

describe("WEBSITE_MATCHES channel", () => {
  it("HOME MATCH with websiteVisible=true → ELIGIBLE", () => {
    const event = websiteMatchEvent({ homeAway: "HOME" });
    expect(evaluatePublication(event, "WEBSITE_MATCHES", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("AWAY MATCH with websiteVisible=true → ELIGIBLE", () => {
    const event = websiteMatchEvent({ homeAway: "AWAY" });
    expect(evaluatePublication(event, "WEBSITE_MATCHES", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("TRAINING type → TYPE_MISMATCH", () => {
    const event = websiteMatchEvent({ type: "TRAINING", homeAway: null });
    expect(evaluatePublication(event, "WEBSITE_MATCHES", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("TOURNAMENT type → TYPE_MISMATCH", () => {
    const event = websiteMatchEvent({ type: "TOURNAMENT", homeAway: null });
    expect(evaluatePublication(event, "WEBSITE_MATCHES", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("MATCH with websiteVisible=false → WEBSITE_HIDDEN", () => {
    const event = websiteMatchEvent({ websiteVisible: false });
    expect(evaluatePublication(event, "WEBSITE_MATCHES", TENANT)).toEqual({
      eligible: false,
      reason: "WEBSITE_HIDDEN",
    });
  });

  it("status beats visibility: DRAFT MATCH with websiteVisible=false → STATUS_NOT_PUBLISHABLE", () => {
    const event = websiteMatchEvent({ status: "DRAFT", websiteVisible: false });
    expect(evaluatePublication(event, "WEBSITE_MATCHES", TENANT)).toEqual({
      eligible: false,
      reason: "STATUS_NOT_PUBLISHABLE",
    });
  });
});

// ── WEBSITE_TRAININGS ──────────────────────────────────────────────────────────

describe("WEBSITE_TRAININGS channel", () => {
  it("channel name is WEBSITE_TRAININGS", () => {
    const channel: PublicationChannel = "WEBSITE_TRAININGS";
    expect(channel).toBe("WEBSITE_TRAININGS");
  });

  it("TRAINING with websiteVisible=true and trainingsplanVisible=true → ELIGIBLE", () => {
    const event = websiteTrainingEvent();
    expect(evaluatePublication(event, "WEBSITE_TRAININGS", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("TRAINING with websiteVisible=false → WEBSITE_HIDDEN (checked before trainingsplanVisible)", () => {
    const event = websiteTrainingEvent({
      websiteVisible: false,
      trainingsplanVisible: false,
    });
    expect(evaluatePublication(event, "WEBSITE_TRAININGS", TENANT)).toEqual({
      eligible: false,
      reason: "WEBSITE_HIDDEN",
    });
  });

  it("TRAINING with websiteVisible=true but trainingsplanVisible=false → TRAININGSPLAN_HIDDEN", () => {
    const event = websiteTrainingEvent({ trainingsplanVisible: false });
    expect(evaluatePublication(event, "WEBSITE_TRAININGS", TENANT)).toEqual({
      eligible: false,
      reason: "TRAININGSPLAN_HIDDEN",
    });
  });

  it("MATCH type → TYPE_MISMATCH", () => {
    const event = websiteTrainingEvent({ type: "MATCH", homeAway: "HOME" });
    expect(evaluatePublication(event, "WEBSITE_TRAININGS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("TOURNAMENT type → TYPE_MISMATCH", () => {
    const event = websiteTrainingEvent({ type: "TOURNAMENT" });
    expect(evaluatePublication(event, "WEBSITE_TRAININGS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });
});

// ── WEBSITE_TOURNAMENTS ────────────────────────────────────────────────────────

describe("WEBSITE_TOURNAMENTS channel", () => {
  it("TOURNAMENT with websiteVisible=true → ELIGIBLE", () => {
    const event = websiteTournamentEvent();
    expect(evaluatePublication(event, "WEBSITE_TOURNAMENTS", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("TOURNAMENT with websiteVisible=false → WEBSITE_HIDDEN", () => {
    const event = websiteTournamentEvent({ websiteVisible: false });
    expect(evaluatePublication(event, "WEBSITE_TOURNAMENTS", TENANT)).toEqual({
      eligible: false,
      reason: "WEBSITE_HIDDEN",
    });
  });

  it("MATCH type → TYPE_MISMATCH", () => {
    const event = websiteTournamentEvent({ type: "MATCH", homeAway: "HOME" });
    expect(evaluatePublication(event, "WEBSITE_TOURNAMENTS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("TRAINING type → TYPE_MISMATCH", () => {
    const event = websiteTournamentEvent({ type: "TRAINING" });
    expect(evaluatePublication(event, "WEBSITE_TOURNAMENTS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("OTHER type → TYPE_MISMATCH", () => {
    const event = websiteTournamentEvent({ type: "OTHER" });
    expect(evaluatePublication(event, "WEBSITE_TOURNAMENTS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("no homeAway restriction on WEBSITE_TOURNAMENTS", () => {
    const event = websiteTournamentEvent({ homeAway: "AWAY" });
    expect(evaluatePublication(event, "WEBSITE_TOURNAMENTS", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });
});

// ── WEBSITE_CLUB_EVENTS ────────────────────────────────────────────────────────

describe("WEBSITE_CLUB_EVENTS channel", () => {
  it("OTHER with websiteVisible=true → ELIGIBLE", () => {
    const event = websiteClubEvent();
    expect(evaluatePublication(event, "WEBSITE_CLUB_EVENTS", TENANT)).toEqual({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });

  it("MATCH type → TYPE_MISMATCH (only OTHER accepted)", () => {
    const event = websiteClubEvent({ type: "MATCH", homeAway: "HOME" });
    expect(evaluatePublication(event, "WEBSITE_CLUB_EVENTS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("TRAINING type → TYPE_MISMATCH", () => {
    const event = websiteClubEvent({ type: "TRAINING" });
    expect(evaluatePublication(event, "WEBSITE_CLUB_EVENTS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("TOURNAMENT type → TYPE_MISMATCH", () => {
    const event = websiteClubEvent({ type: "TOURNAMENT" });
    expect(evaluatePublication(event, "WEBSITE_CLUB_EVENTS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("VACATION_PERIOD type → TYPE_MISMATCH", () => {
    const event = websiteClubEvent({ type: "VACATION_PERIOD" });
    expect(evaluatePublication(event, "WEBSITE_CLUB_EVENTS", TENANT)).toEqual({
      eligible: false,
      reason: "TYPE_MISMATCH",
    });
  });

  it("OTHER with websiteVisible=false → WEBSITE_HIDDEN", () => {
    const event = websiteClubEvent({ websiteVisible: false });
    expect(evaluatePublication(event, "WEBSITE_CLUB_EVENTS", TENANT)).toEqual({
      eligible: false,
      reason: "WEBSITE_HIDDEN",
    });
  });
});

// ── TOURNAMENT_HOSTING_UNVERIFIED is part of the type contract ─────────────────

describe("TOURNAMENT_HOSTING_UNVERIFIED type contract", () => {
  it("TOURNAMENT_HOSTING_UNVERIFIED is a valid PublicationReason value", () => {
    // This is a compile-time assertion: if the type is removed, tsc fails.
    const reason: PublicationReason = "TOURNAMENT_HOSTING_UNVERIFIED";
    expect(reason).toBe("TOURNAMENT_HOSTING_UNVERIFIED");
  });
});

// ── All six channels are defined ───────────────────────────────────────────────

describe("PublicationChannel type has exactly six values", () => {
  const channels: PublicationChannel[] = [
    "INFOBOARD_SCREEN_1",
    "INFOBOARD_SCREEN_2",
    "WEBSITE_MATCHES",
    "WEBSITE_TRAININGS",
    "WEBSITE_TOURNAMENTS",
    "WEBSITE_CLUB_EVENTS",
  ];

  it("contains exactly six channels", () => {
    expect(channels).toHaveLength(6);
  });

  it("contains INFOBOARD_SCREEN_1", () => {
    expect(channels).toContain("INFOBOARD_SCREEN_1");
  });

  it("contains INFOBOARD_SCREEN_2", () => {
    expect(channels).toContain("INFOBOARD_SCREEN_2");
  });

  it("contains WEBSITE_MATCHES", () => {
    expect(channels).toContain("WEBSITE_MATCHES");
  });

  it("contains WEBSITE_TRAININGS", () => {
    expect(channels).toContain("WEBSITE_TRAININGS");
  });

  it("contains WEBSITE_TOURNAMENTS", () => {
    expect(channels).toContain("WEBSITE_TOURNAMENTS");
  });

  it("contains WEBSITE_CLUB_EVENTS", () => {
    expect(channels).toContain("WEBSITE_CLUB_EVENTS");
  });
});

// ── All ten decision reasons are reachable ─────────────────────────────────────

describe("all ten decision reasons are reachable (or statically present)", () => {
  it("ELIGIBLE is reachable", () => {
    const e = infoboardEvent({ type: "TRAINING" });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("ELIGIBLE");
  });

  it("TENANT_MISMATCH is reachable", () => {
    const e = infoboardEvent({ tenantId: "other-tenant" });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("TENANT_MISMATCH");
  });

  it("STATUS_NOT_PUBLISHABLE is reachable", () => {
    const e = infoboardEvent({ status: "DRAFT" });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("TYPE_MISMATCH is reachable", () => {
    const e = infoboardEvent({ type: "OTHER" });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("TYPE_MISMATCH");
  });

  it("INFOBOARD_HIDDEN is reachable", () => {
    const e = infoboardEvent({ infoboardVisible: false });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("INFOBOARD_HIDDEN");
  });

  it("WEBSITE_HIDDEN is reachable", () => {
    const e = websiteMatchEvent({ websiteVisible: false });
    expect(evaluatePublication(e, "WEBSITE_MATCHES", TENANT).reason).toBe<PublicationReason>("WEBSITE_HIDDEN");
  });

  it("TRAININGSPLAN_HIDDEN is reachable", () => {
    const e = websiteTrainingEvent({ trainingsplanVisible: false });
    expect(evaluatePublication(e, "WEBSITE_TRAININGS", TENANT).reason).toBe<PublicationReason>("TRAININGSPLAN_HIDDEN");
  });

  it("AWAY_MATCH is reachable", () => {
    const e = infoboardEvent({ type: "MATCH", homeAway: "AWAY" });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("AWAY_MATCH");
  });

  it("HOME_AWAY_UNKNOWN is reachable", () => {
    const e = infoboardEvent({ type: "MATCH", homeAway: null });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("HOME_AWAY_UNKNOWN");
  });

  it("TOURNAMENT_HOSTING_UNVERIFIED is statically present in the type", () => {
    const reason: PublicationReason = "TOURNAMENT_HOSTING_UNVERIFIED";
    expect(reason).toBe("TOURNAMENT_HOSTING_UNVERIFIED");
  });
});

// ── Evaluation order assertions ────────────────────────────────────────────────

describe("evaluation order: tenant > status > type > visibility > homeAway", () => {
  it("tenant mismatch beats status", () => {
    const e = infoboardEvent({ tenantId: "other", status: "DRAFT" });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("TENANT_MISMATCH");
  });

  it("status beats type", () => {
    const e = infoboardEvent({ status: "CANCELLED", type: "VACATION_PERIOD" });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("STATUS_NOT_PUBLISHABLE");
  });

  it("type beats visibility", () => {
    const e = infoboardEvent({ type: "OTHER", infoboardVisible: false });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("TYPE_MISMATCH");
  });

  it("visibility beats homeAway", () => {
    const e = infoboardEvent({ type: "MATCH", homeAway: "AWAY", infoboardVisible: false });
    expect(evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT).reason).toBe<PublicationReason>("INFOBOARD_HIDDEN");
  });
});

// ── evaluatePublication is the public evaluator ────────────────────────────────

describe("evaluatePublication is the public evaluator", () => {
  it("evaluatePublication returns a PublicationDecision", () => {
    const e = infoboardEvent();
    const result = evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT);
    expect(result).toHaveProperty("eligible");
    expect(result).toHaveProperty("reason");
  });

  it("evaluatePublication does not throw for ineligible events", () => {
    const e = infoboardEvent({ tenantId: "other" });
    expect(() => evaluatePublication(e, "INFOBOARD_SCREEN_1", TENANT)).not.toThrow();
  });
});
