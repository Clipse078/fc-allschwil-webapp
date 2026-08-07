/**
 * lib/integrations/sfv/__tests__/club-directory-02-schedule-wiring.test.ts
 *
 * CLUB-DIRECTORY-02 — focused tests proving processScheduleEntry
 * (schedule-persistence.ts) correctly wires external-opponent discovery:
 *
 *   - The external-team resolver is invoked ONLY for sides classified as
 *     "external_opponent" — never for club-owned (resolved/unresolved_local)
 *     sides, and never for a derby (both sides club-owned).
 *   - A resolved canonical ExternalTeam id is persisted on
 *     MatchExternalMapping.homeExternalTeamId / awayExternalTeamId on both
 *     the create and update paths.
 *   - A resolver that returns null (e.g. discovery failed) never blocks
 *     match persistence — the match is still created/updated exactly as
 *     before CLUB-DIRECTORY-02, just without a canonical external identity.
 *   - Re-processing the same entry with an unchanged resolved external id is
 *     idempotent (no update fires).
 *   - A newly-resolved external id (previously null) is treated as a change
 *     worth updating, so Matchcenter can pick up a later-discovered identity.
 *
 * lib/club-directory/__tests__/discovery-service.test.ts covers the
 * discovery/resolution business rules themselves (idempotency, ownership,
 * tenant isolation) against the real discoverExternalTeamFromProvider — this
 * file only proves the SFV integration boundary calls it correctly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubScheduleEntry } from "../client";
import { parseSfvMatchDateTime } from "../sync/provider-time";

// ── Mock Prisma (same pattern as sync-schedule-persistence.test.ts) ──────────

const mockEventCreate = vi.fn();
const mockEventUpdate = vi.fn();
const mockMappingCreate = vi.fn();
const mockMappingUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

const { processScheduleEntry } = await import("../sync/schedule-persistence");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWN_TEAM_SFV_ID = 31927;
const OPPONENT_SFV_ID = 44001;

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
    teamAId: OWN_TEAM_SFV_ID,
    teamNameA: "FC Allschwil A",
    teamBId: OPPONENT_SFV_ID,
    teamNameB: "SV Muttenz B1",
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

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      event: { create: mockEventCreate, update: mockEventUpdate },
      matchExternalMapping: { create: mockMappingCreate, update: mockMappingUpdate },
    };
    mockEventCreate.mockResolvedValue({ id: "new-event-id" });
    mockEventUpdate.mockResolvedValue({});
    mockMappingCreate.mockResolvedValue({});
    mockMappingUpdate.mockResolvedValue({});
    return fn(tx);
  });
});

// ── Resolver invocation scope ────────────────────────────────────────────────

describe("processScheduleEntry — external opponent resolver invocation scope", () => {
  it("calls the resolver for the external side only, not the club-owned side", async () => {
    const resolveExternalTeamId = vi.fn().mockResolvedValue("ext-team-1");

    await processScheduleEntry(
      makeEntry(),
      makeContext(),
      "season-1",
      new Map(),
      new Map([[OWN_TEAM_SFV_ID, "team-local-1"]]),
      new Set([OWN_TEAM_SFV_ID]),
      resolveExternalTeamId,
    );

    expect(resolveExternalTeamId).toHaveBeenCalledOnce();
    expect(resolveExternalTeamId).toHaveBeenCalledWith(OPPONENT_SFV_ID, "SV Muttenz B1");
  });

  it("never calls the resolver for a derby (both sides club-owned)", async () => {
    const resolveExternalTeamId = vi.fn().mockResolvedValue("ext-team-1");

    await processScheduleEntry(
      makeEntry({ teamAId: 31927, teamBId: 31928 }),
      makeContext(),
      "season-1",
      new Map(),
      new Map([
        [31927, "team-local-1"],
        [31928, "team-local-2"],
      ]),
      new Set([31927, 31928]),
      resolveExternalTeamId,
    );

    expect(resolveExternalTeamId).not.toHaveBeenCalled();
  });

  it("never calls the resolver for an unresolved-local club-owned side", async () => {
    const resolveExternalTeamId = vi.fn().mockResolvedValue("ext-team-1");

    await processScheduleEntry(
      makeEntry(),
      makeContext(),
      "season-1",
      new Map(),
      new Map(), // no TeamExternalMapping yet — home side is unresolved_local
      new Set([OWN_TEAM_SFV_ID]),
      resolveExternalTeamId,
    );

    // Only the away (external) side triggers a resolver call.
    expect(resolveExternalTeamId).toHaveBeenCalledOnce();
    expect(resolveExternalTeamId).toHaveBeenCalledWith(OPPONENT_SFV_ID, "SV Muttenz B1");
  });

  it("defaults to a no-op resolver when none is supplied (backward compatible)", async () => {
    const result = await processScheduleEntry(
      makeEntry(),
      makeContext(),
      "season-1",
      new Map(),
      new Map([[OWN_TEAM_SFV_ID, "team-local-1"]]),
      new Set([OWN_TEAM_SFV_ID]),
    );

    expect(result.outcome.status).toBe("created");
    const createData = mockMappingCreate.mock.calls[0][0].data;
    expect(createData.awayExternalTeamId).toBeNull();
  });
});

// ── Persistence of the resolved canonical identity ───────────────────────────

describe("processScheduleEntry — persists resolved canonical ExternalTeam id", () => {
  it("create path: writes the resolved externalTeamId onto the new mapping", async () => {
    const resolveExternalTeamId = vi.fn().mockResolvedValue("ext-team-1");

    const result = await processScheduleEntry(
      makeEntry(),
      makeContext(),
      "season-1",
      new Map(),
      new Map([[OWN_TEAM_SFV_ID, "team-local-1"]]),
      new Set([OWN_TEAM_SFV_ID]),
      resolveExternalTeamId,
    );

    expect(result.outcome.status).toBe("created");
    const createData = mockMappingCreate.mock.calls[0][0].data;
    expect(createData.homeExternalTeamId).toBeNull(); // home is club-owned
    expect(createData.awayExternalTeamId).toBe("ext-team-1");
  });

  it("update path: writes the resolved externalTeamId onto the existing mapping", async () => {
    const resolveExternalTeamId = vi.fn().mockResolvedValue("ext-team-1");

    const existingMappings = new Map([
      [
        99001,
        {
          id: "mapping-1",
          eventId: "event-1",
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
          providerHomeTeamName: "FC Allschwil A",
          providerAwayTeamName: "SV Muttenz B1",
          homeTeamId: "team-local-1",
          awayTeamId: null,
          homeExternalTeamId: null, // not yet discovered on a prior run
          awayExternalTeamId: null,
          event: {
            startAt: parseSfvMatchDateTime(makeEntry().matchDate),
            status: "SCHEDULED",
            teamId: "team-local-1",
            homeAway: "HOME",
          },
        },
      ],
    ]);

    const result = await processScheduleEntry(
      makeEntry(),
      makeContext(),
      "season-1",
      existingMappings,
      new Map([[OWN_TEAM_SFV_ID, "team-local-1"]]),
      new Set([OWN_TEAM_SFV_ID]),
      resolveExternalTeamId,
    );

    // A previously-null awayExternalTeamId becoming resolved counts as a
    // change worth persisting, so Matchcenter picks up the newly-discovered
    // canonical identity without waiting for an unrelated field to change.
    expect(result.outcome.status).toBe("updated");
    const updateData = mockMappingUpdate.mock.calls[0][0].data;
    expect(updateData.awayExternalTeamId).toBe("ext-team-1");
  });

  it("re-processing with the same already-resolved externalTeamId is idempotent (no update)", async () => {
    const resolveExternalTeamId = vi.fn().mockResolvedValue("ext-team-1");

    const existingMappings = new Map([
      [
        99001,
        {
          id: "mapping-1",
          eventId: "event-1",
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
          providerHomeTeamName: "FC Allschwil A",
          providerAwayTeamName: "SV Muttenz B1",
          homeTeamId: "team-local-1",
          awayTeamId: null,
          homeExternalTeamId: null,
          awayExternalTeamId: "ext-team-1", // already discovered on a prior run
          event: {
            startAt: parseSfvMatchDateTime(makeEntry().matchDate),
            status: "SCHEDULED",
            teamId: "team-local-1",
            homeAway: "HOME",
          },
        },
      ],
    ]);

    const result = await processScheduleEntry(
      makeEntry(),
      makeContext(),
      "season-1",
      existingMappings,
      new Map([[OWN_TEAM_SFV_ID, "team-local-1"]]),
      new Set([OWN_TEAM_SFV_ID]),
      resolveExternalTeamId,
    );

    expect(result.outcome.status).toBe("unchanged");
    expect(mockMappingUpdate).not.toHaveBeenCalled();
  });

  it("a resolver failure (returns null) never blocks match creation", async () => {
    const resolveExternalTeamId = vi.fn().mockResolvedValue(null);

    const result = await processScheduleEntry(
      makeEntry(),
      makeContext(),
      "season-1",
      new Map(),
      new Map([[OWN_TEAM_SFV_ID, "team-local-1"]]),
      new Set([OWN_TEAM_SFV_ID]),
      resolveExternalTeamId,
    );

    expect(result.outcome.status).toBe("created");
    const createData = mockMappingCreate.mock.calls[0][0].data;
    expect(createData.awayExternalTeamId).toBeNull();
    // Provider display name fallback (pre-existing behaviour) is unaffected.
    expect(createData.providerAwayTeamName).toBe("SV Muttenz B1");
  });
});
