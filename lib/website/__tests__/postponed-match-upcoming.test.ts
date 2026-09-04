/**
 * SCE-MATCH-POSTPONED-01 — postponed/rescheduled match upcoming semantics.
 *
 * Regression coverage for the canonical rule:
 * - past scheduled → not upcoming
 * - past postponed without replacement → not upcoming / not nextEvent
 * - postponed with future effective kickoff → upcoming
 * - rescheduled fixture uses new kickoff from Event.startAt
 * - chronological nextEvent selection
 * - public API exposes the correct effective kickoff
 */

import { describe, expect, it } from "vitest";

import type { TeamSeasonMatchItem } from "@/lib/teams/team-match-query-service";
import {
  filterPublicTeamNextMatches,
  mapPublicTeamMatch,
  type PublicTeamMatchIdentityContext,
} from "../public-team-matches-mapper";
import { resolvePublicTeamNextEvent } from "../public-team-next-event";

const NOW = new Date("2026-09-04T12:00:00.000Z");
const TEAM_ID = "team-c1";
const REFERENCE_KICKOFF = new Date("2026-08-02T12:00:00.000Z");
const RESCHEDULED_KICKOFF = new Date("2026-09-20T14:00:00.000Z");

const identityContext: PublicTeamMatchIdentityContext = {
  currentTeamId: TEAM_ID,
  tenantLogoUrl: "https://cdn.example.com/tenant.png",
  tenantClubName: "FC Allschwil",
  teamById: new Map([[TEAM_ID, { id: TEAM_ID, shortName: "C1" }]]),
  externalTeamById: new Map([
    [
      "ext-bubendorf",
      {
        id: "ext-bubendorf",
        shortName: "Bub",
        logoUrl: null,
        clubName: "FC Bubendorf",
      },
    ],
  ]),
};

function createReferenceMatchItem(
  overrides: Partial<TeamSeasonMatchItem> = {},
): TeamSeasonMatchItem {
  return {
    eventId: "cmrkh1s1p001404ju039v8p4a",
    tenantId: "tenant-fca",
    teamSeasonId: "team-season-c1",
    seasonId: "season-2026-2027",
    side: "HOME",
    startAt: REFERENCE_KICKOFF,
    endAt: null,
    status: "POSTPONED",
    lifecycle: "POSTPONED",
    lifecycleStage: "UPCOMING",
    home: {
      canonicalTeamId: TEAM_ID,
      canonicalExternalTeamId: null,
      displayName: "FC Allschwil Junioren C1",
      clubName: null,
      externalLogoUrl: null,
      providerTeamId: 100,
      providerTeamName: "FC Allschwil Junioren C1",
    },
    away: {
      canonicalTeamId: null,
      canonicalExternalTeamId: "ext-bubendorf",
      displayName: "FC Bubendorf",
      clubName: "FC Bubendorf",
      externalLogoUrl: null,
      providerTeamId: 200,
      providerTeamName: "FC Bubendorf",
    },
    opponent: {
      displayName: "FC Bubendorf",
      canonicalTeamId: null,
      canonicalExternalTeamId: "ext-bubendorf",
      providerTeamId: 200,
      providerTeamName: "FC Bubendorf",
    },
    competition: {
      eventCompetitionLabel: "Junioren C",
      providerLeagueId: null,
      providerLeagueName: null,
      providerDivisionId: null,
      providerDivisionName: null,
      providerRoundNumber: null,
      canonicalCompetitionId: null,
      canonicalCompetitionName: null,
      canonicalCompetitionShortName: null,
    },
    location: "Im Brüel",
    venueName: "Sportanlage Im Brüel",
    resultLabel: null,
    scoreHome: null,
    scoreAway: null,
    intermediateResultLabel: null,
    provider: {
      provider: "SFV",
      externalMatchId: 4344999,
      externalSeasonId: 2027,
      matchNumber: 42,
      providerMatchState: 2,
      providerMatchStateName: "verschoben",
    },
    ...overrides,
  };
}

describe("SCE-MATCH-POSTPONED-01 — postponed match upcoming semantics", () => {
  it("excludes past scheduled fixtures from nextMatches", () => {
    const items = [
      createReferenceMatchItem({
        eventId: "past-scheduled",
        status: "SCHEDULED",
        lifecycle: "UPCOMING",
        startAt: REFERENCE_KICKOFF,
      }),
    ];

    expect(filterPublicTeamNextMatches(items, NOW)).toEqual([]);
  });

  it("excludes past postponed fixtures without a replacement kickoff", () => {
    const items = [createReferenceMatchItem()];

    expect(filterPublicTeamNextMatches(items, NOW)).toEqual([]);
  });

  it("includes postponed fixtures when the effective kickoff is in the future", () => {
    const items = [
      createReferenceMatchItem({
        startAt: RESCHEDULED_KICKOFF,
      }),
    ];

    expect(filterPublicTeamNextMatches(items, NOW)).toHaveLength(1);
  });

  it("uses the rescheduled kickoff as the public effective startAt", () => {
    const mapped = mapPublicTeamMatch(
      createReferenceMatchItem({ startAt: RESCHEDULED_KICKOFF }),
      identityContext,
    );

    expect(mapped.startAt).toEqual(RESCHEDULED_KICKOFF);
    expect(mapped.status).toBe("POSTPONED");
  });

  it("selects the earliest chronological nextEvent after filtering stale postponed fixtures", () => {
    const items = [
      createReferenceMatchItem(),
      createReferenceMatchItem({
        eventId: "future-scheduled",
        status: "SCHEDULED",
        lifecycle: "UPCOMING",
        startAt: new Date("2026-09-10T10:00:00.000Z"),
        opponent: {
          displayName: "Next Opponent",
          canonicalTeamId: null,
          canonicalExternalTeamId: "ext-next",
          providerTeamId: 300,
          providerTeamName: "Next Opponent",
        },
      }),
      createReferenceMatchItem({
        eventId: "future-postponed",
        startAt: new Date("2026-09-25T10:00:00.000Z"),
      }),
    ];

    const nextMatches = filterPublicTeamNextMatches(items, NOW).map((item) =>
      mapPublicTeamMatch(item, identityContext),
    );

    expect(nextMatches.map((match) => match.id)).toEqual([
      "future-scheduled",
      "future-postponed",
    ]);

    const nextEvent = resolvePublicTeamNextEvent({
      publication: { showNextMatch: true, showNextTournament: false },
      nextMatch: nextMatches[0] ?? null,
      nextTournament: null,
    });

    expect(nextEvent).toEqual({
      type: "MATCH",
      match: expect.objectContaining({
        id: "future-scheduled",
        startAt: new Date("2026-09-10T10:00:00.000Z"),
      }),
    });
  });

  it("does not surface the reference postponed fixture as nextEvent when only stale postponed remains", () => {
    const nextMatches = filterPublicTeamNextMatches(
      [createReferenceMatchItem()],
      NOW,
    ).map((item) => mapPublicTeamMatch(item, identityContext));

    const nextEvent = resolvePublicTeamNextEvent({
      publication: { showNextMatch: true, showNextTournament: false },
      nextMatch: nextMatches[0] ?? null,
      nextTournament: null,
    });

    expect(nextMatches).toEqual([]);
    expect(nextEvent).toBeNull();
  });
});
