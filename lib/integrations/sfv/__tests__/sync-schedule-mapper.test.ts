/**
 * lib/integrations/sfv/__tests__/sync-schedule-mapper.test.ts
 *
 * Unit tests for the schedule mapper pure functions.
 * No mocks needed — all functions are pure and deterministic.
 */

import { describe, it, expect } from "vitest";
import {
  mapMatchStateToEventStatus,
  buildResultLabel,
  buildMappingFields,
  buildNewEventFields,
  detectChanges,
  classifyParticipant,
  resolvedTeamId,
  isUnresolvedLocal,
  isExternalOpponent,
  resolveEventTeamId,
  resolveOpponentNameFromClassification,
  isLocalTeamId,
  resolveOpponentName,
  mapSfvHomeAway,
  resolvePersistedEventStatus,
} from "../sync/schedule-mapper";
import type { ClubScheduleEntry } from "../client";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ClubScheduleEntry> = {}): ClubScheduleEntry {
  return {
    matchId: 99001,
    matchNumber: 1,
    matchDate: "2026-09-13T15:00:00",
    groupId: null,
    cupId: null,
    groupName: null,
    roundNbr: 3,
    playgroundId: 1001,
    stadiumPlaygroundName: "Testzentrum",
    isUnkownPlayground: false,
    leagueId: 17131,
    leagueNumber: 1,
    leagueName: "4. Liga",
    divisionId: 999,
    divisionName: "Gruppe 1",
    organisationId: 8,
    organisationName: "Testverband",
    matchType: 1,
    matchTypeName: "Meisterschaft",
    matchState: 0,
    matchStateName: "angesetzt",
    playDay: 3,
    playDayName: "3. Spieltag",
    seasonId: 2027,
    seasonName: "2026/2027",
    scoreTeamA: 0,
    scoreTeamB: 0,
    teamAId: 31927,
    teamNameA: "FC Local A",
    teamBId: 44001,
    teamNameB: "FC Opponent B",
    ...overrides,
  };
}

function makeContext() {
  return {
    tenantId: "tenant-test",
    clubId: 483,
    seasonId: 2027,
    organisationId: null,
    dateFrom: "2026-06-13",
    dateTo: "2026-10-11",
    syncedAt: new Date("2026-07-13T10:00:00.000Z"),
  };
}

// ── mapSfvHomeAway ────────────────────────────────────────────────────────────

describe("mapSfvHomeAway", () => {
  it("maps isHome=true to 'HOME'", () => {
    expect(mapSfvHomeAway(true)).toBe("HOME");
  });

  it("maps isHome=false to 'AWAY'", () => {
    expect(mapSfvHomeAway(false)).toBe("AWAY");
  });

  it("never returns 'H'", () => {
    expect(mapSfvHomeAway(true)).not.toBe("H");
    expect(mapSfvHomeAway(false)).not.toBe("H");
  });

  it("never returns 'A'", () => {
    expect(mapSfvHomeAway(true)).not.toBe("A");
    expect(mapSfvHomeAway(false)).not.toBe("A");
  });
});

// ── buildNewEventFields homeAway ──────────────────────────────────────────────

describe("buildNewEventFields homeAway", () => {
  it("home fixture maps homeAway to 'HOME'", () => {
    const fields = buildNewEventFields(makeEntry(), makeContext(), "local-team-1", "FC Opponent", true);
    expect(fields.homeAway).toBe("HOME");
  });

  it("away fixture maps homeAway to 'AWAY'", () => {
    const fields = buildNewEventFields(makeEntry(), makeContext(), null, "FC Local", false);
    expect(fields.homeAway).toBe("AWAY");
  });

  it("home fixture does not produce 'H'", () => {
    const fields = buildNewEventFields(makeEntry(), makeContext(), "local-team-1", "FC Opponent", true);
    expect(fields.homeAway).not.toBe("H");
  });

  it("away fixture does not produce 'A'", () => {
    const fields = buildNewEventFields(makeEntry(), makeContext(), null, "FC Local", false);
    expect(fields.homeAway).not.toBe("A");
  });

  it("does not mutate the input entry", () => {
    const entry = makeEntry();
    const original = JSON.stringify(entry);
    buildNewEventFields(entry, makeContext(), "local-team-1", "FC Opponent", true);
    expect(JSON.stringify(entry)).toBe(original);
  });
});

// ── mapMatchStateToEventStatus ────────────────────────────────────────────────

describe("mapMatchStateToEventStatus", () => {
  it("maps 'noch nicht ausgetragen' to SCHEDULED", () => {
    expect(mapMatchStateToEventStatus(0, "noch nicht ausgetragen")).toBe(
      "SCHEDULED",
    );
  });

  it("maps 'pas encore joué' to SCHEDULED", () => {
    expect(mapMatchStateToEventStatus(0, "pas encore joué")).toBe("SCHEDULED");
  });

  it("maps 'ausgetragen' to COMPLETED", () => {
    expect(mapMatchStateToEventStatus(1, "ausgetragen")).toBe("COMPLETED");
  });

  it("maps 'gespielt' to COMPLETED", () => {
    expect(mapMatchStateToEventStatus(1, "gespielt")).toBe("COMPLETED");
  });

  it("maps 'abgeschlossen' to COMPLETED", () => {
    expect(mapMatchStateToEventStatus(1, "abgeschlossen")).toBe("COMPLETED");
  });

  it("maps 'beendet' to COMPLETED", () => {
    expect(mapMatchStateToEventStatus(1, "beendet")).toBe("COMPLETED");
  });

  it("maps 'joué' to COMPLETED", () => {
    expect(mapMatchStateToEventStatus(1, "joué")).toBe("COMPLETED");
  });

  it("maps 'annulliert' to CANCELLED", () => {
    expect(mapMatchStateToEventStatus(3, "annulliert")).toBe("CANCELLED");
  });

  it("maps 'annulé' to CANCELLED", () => {
    expect(mapMatchStateToEventStatus(3, "annulé")).toBe("CANCELLED");
  });

  it("maps 'verschoben' to POSTPONED", () => {
    expect(mapMatchStateToEventStatus(2, "verschoben")).toBe("POSTPONED");
  });

  it("maps 'reporté' to POSTPONED", () => {
    expect(mapMatchStateToEventStatus(2, "reporté")).toBe("POSTPONED");
  });

  it("maps 'läuft' to LIVE", () => {
    expect(mapMatchStateToEventStatus(4, "läuft")).toBe("LIVE");
  });

  it("maps unknown state to SCHEDULED (safe default)", () => {
    expect(mapMatchStateToEventStatus(9999, "unbekannt")).toBe("SCHEDULED");
  });

  it("maps null matchStateName to SCHEDULED (safe default)", () => {
    expect(mapMatchStateToEventStatus(0, null)).toBe("SCHEDULED");
  });

  it("maps null matchState with null name to SCHEDULED", () => {
    expect(mapMatchStateToEventStatus(null, null)).toBe("SCHEDULED");
  });

  it("is case-insensitive — 'Gespielt' maps to COMPLETED", () => {
    expect(mapMatchStateToEventStatus(1, "Gespielt")).toBe("COMPLETED");
  });
});

// ── resolvePersistedEventStatus ─────────────────────────────────────────────

describe("resolvePersistedEventStatus", () => {
  it("keeps COMPLETED when incoming provider disposition is UNKNOWN", () => {
    expect(resolvePersistedEventStatus("COMPLETED", "SCHEDULED")).toBe(
      "COMPLETED",
    );
  });

  it("allows explicit provider NOT_PLAYED to heal COMPLETED to SCHEDULED", () => {
    expect(
      resolvePersistedEventStatus("COMPLETED", "SCHEDULED", "NOT_PLAYED"),
    ).toBe("SCHEDULED");
  });

  it("keeps COMPLETED when incoming provider payload is LIVE", () => {
    expect(resolvePersistedEventStatus("COMPLETED", "LIVE")).toBe("COMPLETED");
  });

  it("keeps CANCELLED when incoming provider payload is SCHEDULED", () => {
    expect(resolvePersistedEventStatus("CANCELLED", "SCHEDULED")).toBe(
      "CANCELLED",
    );
  });

  it("allows POSTPONED to return to SCHEDULED after reschedule", () => {
    expect(resolvePersistedEventStatus("POSTPONED", "SCHEDULED")).toBe(
      "SCHEDULED",
    );
  });

  it("allows SCHEDULED to advance to COMPLETED", () => {
    expect(resolvePersistedEventStatus("SCHEDULED", "COMPLETED")).toBe(
      "COMPLETED",
    );
  });
});

// ── buildResultLabel ──────────────────────────────────────────────────────────

describe("buildResultLabel", () => {
  it("returns 'X:Y' string for COMPLETED match", () => {
    expect(buildResultLabel(2, 1, "COMPLETED")).toBe("2:1");
  });

  it("returns null for SCHEDULED match (no score yet)", () => {
    expect(buildResultLabel(0, 0, "SCHEDULED")).toBeNull();
  });

  it("returns null for POSTPONED match", () => {
    expect(buildResultLabel(0, 0, "POSTPONED")).toBeNull();
  });

  it("returns null for CANCELLED match", () => {
    expect(buildResultLabel(0, 0, "CANCELLED")).toBeNull();
  });

  it("returns 'X:Y' for LIVE match", () => {
    expect(buildResultLabel(1, 0, "LIVE")).toBe("1:0");
  });

  it("returns null when scores are null", () => {
    expect(buildResultLabel(null, null, "COMPLETED")).toBeNull();
  });

  it("returns null when one score is null", () => {
    expect(buildResultLabel(2, null, "COMPLETED")).toBeNull();
  });

  it("returns '0:0' for COMPLETED match with 0:0 score", () => {
    expect(buildResultLabel(0, 0, "COMPLETED")).toBe("0:0");
  });
});

// ── buildMappingFields ────────────────────────────────────────────────────────

describe("buildMappingFields", () => {
  it("sets provider to 'SFV'", () => {
    const fields = buildMappingFields(makeEntry(), makeContext(), null, null);
    expect(fields.provider).toBe("SFV");
  });

  it("sets externalMatchId from entry.matchId", () => {
    const fields = buildMappingFields(makeEntry({ matchId: 99001 }), makeContext(), null, null);
    expect(fields.externalMatchId).toBe(99001);
  });

  it("matchNumber is stored but separate from externalMatchId", () => {
    const fields = buildMappingFields(makeEntry({ matchId: 99001, matchNumber: 5 }), makeContext(), null, null);
    expect(fields.externalMatchId).toBe(99001);
    expect(fields.matchNumber).toBe(5);
    // matchNumber != externalMatchId
    expect(fields.matchNumber).not.toBe(fields.externalMatchId);
  });

  it("sets homeTeamId and awayTeamId from resolved local teams", () => {
    const fields = buildMappingFields(makeEntry(), makeContext(), "local-team-1", "local-team-2");
    expect(fields.homeTeamId).toBe("local-team-1");
    expect(fields.awayTeamId).toBe("local-team-2");
  });

  it("homeTeamId is null when home team is external", () => {
    const fields = buildMappingFields(makeEntry(), makeContext(), null, null);
    expect(fields.homeTeamId).toBeNull();
  });

  it("scoreHome corresponds to teamA (home) score", () => {
    const fields = buildMappingFields(makeEntry({ scoreTeamA: 3, scoreTeamB: 1 }), makeContext(), null, null);
    expect(fields.scoreHome).toBe(3);
    expect(fields.scoreAway).toBe(1);
  });
});

// ── detectChanges ─────────────────────────────────────────────────────────────

describe("detectChanges", () => {
  function makeExistingMapping(overrides = {}) {
    return {
      providerMatchState: 0,
      providerMatchStateName: "angesetzt",
      scoreHome: 0,
      scoreAway: 0,
      providerLeagueId: 17131,
      providerLeagueName: "4. Liga",
      providerDivisionId: 999,
      providerDivisionName: "Gruppe 1",
      providerRoundNbr: 3,
      providerVenueName: "Testzentrum",
      providerHomeTeamName: "FC Local A",
      providerAwayTeamName: "FC Opponent B",
      homeTeamId: "team-1" as string | null,
      awayTeamId: null as string | null,
      ...overrides,
    };
  }

  function makeExistingEvent(overrides: Partial<{ startAt: Date; status: string; teamId: string | null; homeAway: string | null }> = {}) {
    return {
      startAt: new Date("2026-09-13T15:00:00.000Z"),
      status: "SCHEDULED",
      teamId: null as string | null,
      homeAway: "HOME" as string | null,
      ...overrides,
    };
  }

  it("returns hasAnyChange=false when nothing changed", () => {
    const mapping = makeExistingMapping();
    const event = makeExistingEvent({ teamId: "team-1", homeAway: "HOME" });
    const incoming = buildMappingFields(makeEntry(), makeContext(), "team-1", null);
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.hasAnyChange).toBe(false);
    expect(result.scoreChanged).toBe(false);
    expect(result.kickoffChanged).toBe(false);
    expect(result.statusChanged).toBe(false);
  });

  it("detects score change", () => {
    const mapping = makeExistingMapping({ scoreHome: 0, scoreAway: 0 });
    const event = makeExistingEvent({ teamId: "team-1", homeAway: "HOME" });
    const incoming = buildMappingFields(
      makeEntry({ scoreTeamA: 2, scoreTeamB: 1 }),
      makeContext(),
      "team-1",
      null,
    );
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.scoreChanged).toBe(true);
    expect(result.hasAnyChange).toBe(true);
  });

  it("detects kickoff change", () => {
    const mapping = makeExistingMapping();
    const event = makeExistingEvent({ startAt: new Date("2026-09-13T15:00:00.000Z"), teamId: "team-1", homeAway: "HOME" });
    const incoming = buildMappingFields(makeEntry(), makeContext(), "team-1", null);
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-20T18:00:00.000Z"), // changed kickoff
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.kickoffChanged).toBe(true);
    expect(result.hasAnyChange).toBe(true);
  });

  it("detects status change", () => {
    const mapping = makeExistingMapping();
    const event = makeExistingEvent({ status: "SCHEDULED", teamId: "team-1", homeAway: "HOME" });
    const incoming = buildMappingFields(makeEntry(), makeContext(), "team-1", null);
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-13T15:00:00.000Z"),
      "COMPLETED", // changed status
      "team-1",
      "HOME",
    );
    expect(result.statusChanged).toBe(true);
    expect(result.hasAnyChange).toBe(true);
  });

  it("detects teamId improvement (null → resolved) as a change", () => {
    const mapping = makeExistingMapping();
    const event = makeExistingEvent({ teamId: null, homeAway: "HOME" });
    const incoming = buildMappingFields(makeEntry(), makeContext(), "team-1", null);
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.hasAnyChange).toBe(true); // must fire update to repair teamId
  });

  it("detects homeAway 'H' → 'HOME' as a change (legacy correction)", () => {
    const mapping = makeExistingMapping();
    const event = makeExistingEvent({ teamId: "team-1", homeAway: "H" }); // legacy value
    const incoming = buildMappingFields(makeEntry(), makeContext(), "team-1", null);
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME", // canonical incoming
    );
    expect(result.hasAnyChange).toBe(true); // must trigger update
  });

  it("detects homeAway 'A' → 'AWAY' as a change (legacy correction)", () => {
    const mapping = makeExistingMapping();
    const event = makeExistingEvent({ teamId: null, homeAway: "A" }); // legacy value
    const incoming = buildMappingFields(makeEntry(), makeContext(), null, null);
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      null,
      "AWAY", // canonical incoming
    );
    expect(result.hasAnyChange).toBe(true); // must trigger update
  });

  it("homeAway 'HOME' → 'HOME' is idempotent (no change)", () => {
    const mapping = makeExistingMapping();
    const event = makeExistingEvent({ teamId: "team-1", homeAway: "HOME" });
    const incoming = buildMappingFields(makeEntry(), makeContext(), "team-1", null);
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.hasAnyChange).toBe(false);
  });

  it("homeAway 'AWAY' → 'AWAY' is idempotent (no change)", () => {
    const mapping = makeExistingMapping({ homeTeamId: null, awayTeamId: "team-1" });
    const event = makeExistingEvent({ teamId: "team-1", homeAway: "AWAY" });
    const incoming = buildMappingFields(makeEntry(), makeContext(), null, "team-1");
    const result = detectChanges(
      mapping,
      event,
      incoming,
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "AWAY",
    );
    expect(result.hasAnyChange).toBe(false);
  });
});

// ── classifyParticipant ───────────────────────────────────────────────────────

describe("classifyParticipant", () => {
  const ownedIds = new Set([31927, 31928]);
  const teamMappings = new Map([[31927, "canonical-team-1"]]);

  it("resolved: club-owned team with mapping", () => {
    const result = classifyParticipant(31927, ownedIds, teamMappings);
    expect(result.kind).toBe("resolved");
    expect(resolvedTeamId(result)).toBe("canonical-team-1");
  });

  it("unresolved_local: club-owned team with no mapping", () => {
    const result = classifyParticipant(31928, ownedIds, teamMappings); // 31928 not in mappings
    expect(result.kind).toBe("unresolved_local");
    expect(isUnresolvedLocal(result)).toBe(true);
    expect(isExternalOpponent(result)).toBe(false);
  });

  it("external_opponent: team not in clubOwnedIds", () => {
    const result = classifyParticipant(44001, ownedIds, teamMappings);
    expect(result.kind).toBe("external_opponent");
    expect(isExternalOpponent(result)).toBe(true);
    expect(isUnresolvedLocal(result)).toBe(false);
  });

  it("unknown: empty clubOwnedIds, team not in mappings", () => {
    const result = classifyParticipant(31927, new Set(), new Map());
    expect(result.kind).toBe("unknown");
  });

  it("resolved via fallback: empty clubOwnedIds but team in mappings", () => {
    const result = classifyParticipant(31927, new Set(), new Map([[31927, "canonical-1"]]));
    expect(result.kind).toBe("resolved");
  });
});

// ── resolveEventTeamId ────────────────────────────────────────────────────────

describe("resolveEventTeamId", () => {
  it("returns home canonical ID when home is resolved", () => {
    const home = { kind: "resolved" as const, canonicalTeamId: "home-1" };
    const away = { kind: "external_opponent" as const };
    expect(resolveEventTeamId(home, away)).toBe("home-1");
  });

  it("returns away canonical ID when home is external", () => {
    const home = { kind: "external_opponent" as const };
    const away = { kind: "resolved" as const, canonicalTeamId: "away-1" };
    expect(resolveEventTeamId(home, away)).toBe("away-1");
  });

  it("returns null when both are unresolved/external", () => {
    const home = { kind: "unresolved_local" as const };
    const away = { kind: "external_opponent" as const };
    expect(resolveEventTeamId(home, away)).toBeNull();
  });

  it("returns home canonical ID for derby (both resolved)", () => {
    const home = { kind: "resolved" as const, canonicalTeamId: "home-1" };
    const away = { kind: "resolved" as const, canonicalTeamId: "away-1" };
    expect(resolveEventTeamId(home, away)).toBe("home-1");
  });
});

// ── resolveOpponentNameFromClassification ─────────────────────────────────────

describe("resolveOpponentNameFromClassification", () => {
  it("returns away name when club is home (resolved)", () => {
    const entry = makeEntry({ teamNameA: "FC Us", teamNameB: "FC Them" });
    const home = { kind: "resolved" as const, canonicalTeamId: "us" };
    const away = { kind: "external_opponent" as const };
    expect(resolveOpponentNameFromClassification(entry, home, away)).toBe("FC Them");
  });

  it("returns home name when club is away (resolved)", () => {
    const entry = makeEntry({ teamNameA: "FC Them", teamNameB: "FC Us" });
    const home = { kind: "external_opponent" as const };
    const away = { kind: "resolved" as const, canonicalTeamId: "us" };
    expect(resolveOpponentNameFromClassification(entry, home, away)).toBe("FC Them");
  });

  it("returns null for derby (both club teams)", () => {
    const entry = makeEntry({ teamNameA: "FC A", teamNameB: "FC B" });
    const home = { kind: "resolved" as const, canonicalTeamId: "team-a" };
    const away = { kind: "resolved" as const, canonicalTeamId: "team-b" };
    expect(resolveOpponentNameFromClassification(entry, home, away)).toBeNull();
  });

  it("returns null when both external (unexpected)", () => {
    const entry = makeEntry({ teamNameA: "FC X", teamNameB: "FC Y" });
    const home = { kind: "external_opponent" as const };
    const away = { kind: "external_opponent" as const };
    expect(resolveOpponentNameFromClassification(entry, home, away)).toBeNull();
  });

  it("returns away name when home is unresolved_local (still our team)", () => {
    const entry = makeEntry({ teamNameA: "FC Us (unlinked)", teamNameB: "FC Them" });
    const home = { kind: "unresolved_local" as const };
    const away = { kind: "external_opponent" as const };
    expect(resolveOpponentNameFromClassification(entry, home, away)).toBe("FC Them");
  });
});

// ── isLocalTeamId (legacy) ────────────────────────────────────────────────────

describe("isLocalTeamId", () => {
  it("returns true when teamId is in the local set", () => {
    const localIds = new Set([31927, 31928]);
    expect(isLocalTeamId(31927, localIds)).toBe(true);
  });

  it("returns false when teamId is not in the local set", () => {
    const localIds = new Set([31927]);
    expect(isLocalTeamId(44001, localIds)).toBe(false);
  });

  it("returns false for empty set", () => {
    expect(isLocalTeamId(31927, new Set())).toBe(false);
  });
});

// ── resolveOpponentName (legacy) ─────────────────────────────────────────────

describe("resolveOpponentName", () => {
  it("returns teamNameB when our team is home", () => {
    const entry = makeEntry({ teamNameA: "FC Us", teamNameB: "FC Them" });
    expect(resolveOpponentName(entry, true)).toBe("FC Them");
  });

  it("returns teamNameA when our team is away", () => {
    const entry = makeEntry({ teamNameA: "FC Them", teamNameB: "FC Us" });
    expect(resolveOpponentName(entry, false)).toBe("FC Them");
  });

  it("returns null when opponent name is null", () => {
    const entry = makeEntry({ teamNameB: null });
    expect(resolveOpponentName(entry, true)).toBeNull();
  });
});
