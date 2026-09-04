import { describe, expect, it } from "vitest";

import type { TeamSeasonMatchItem } from "@/lib/teams/team-match-query-service";
import {
  filterPublicTeamNextMatches,
  filterPublicTeamResults,
  isPublicTeamNextMatch,
  isPublicTeamResult,
  mapPublicTeamMatch,
  mapPublicTeamMatches,
  mapPublicTeamResults,
  PUBLIC_TEAM_NEXT_MATCHES_DEFAULT_LIMIT,
  PUBLIC_TEAM_RESULTS_DEFAULT_LIMIT,
  resolvePublicTeamResultPerspective,
  type PublicTeamMatchIdentityContext,
} from "../public-team-matches-mapper";

const NOW = new Date("2026-08-25T12:00:00.000Z");
const TEAM_ID = "team-own";
const TENANT_LOGO = "https://cdn.example.com/tenant.png";
const OPPONENT_LOGO = "https://cdn.example.com/opponent.png";

const identityContext: PublicTeamMatchIdentityContext = {
  currentTeamId: TEAM_ID,
  tenantLogoUrl: TENANT_LOGO,
  tenantClubName: "FC Example",
  teamById: new Map([
    [TEAM_ID, { id: TEAM_ID, shortName: "E1" }],
  ]),
  externalTeamById: new Map([
    [
      "ext-away-1",
      {
        id: "ext-away-1",
        shortName: "Opp",
        logoUrl: OPPONENT_LOGO,
        clubName: "Opponent Club",
      },
    ],
    [
      "ext-home-1",
      {
        id: "ext-home-1",
        shortName: null,
        logoUrl: OPPONENT_LOGO,
        clubName: "Host Club",
      },
    ],
  ]),
};

function createSide(
  overrides: Partial<TeamSeasonMatchItem["home"]> = {},
): TeamSeasonMatchItem["home"] {
  return {
    canonicalTeamId: TEAM_ID,
    canonicalExternalTeamId: null,
    displayName: "FC Example E1",
    clubName: null,
    externalLogoUrl: null,
    providerTeamId: null,
    providerTeamName: null,
    ...overrides,
  };
}

function createMatchItem(
  overrides: Partial<TeamSeasonMatchItem> = {},
): TeamSeasonMatchItem {
  const home = createSide();
  const away = createSide({
    canonicalTeamId: null,
    canonicalExternalTeamId: "ext-away-1",
    displayName: "Opponent FC",
  });

  return {
    eventId: "event-1",
    tenantId: "tenant-1",
    teamSeasonId: "team-season-1",
    seasonId: "season-1",
    side: "HOME",
    startAt: new Date("2026-09-01T18:00:00.000Z"),
    endAt: null,
    status: "SCHEDULED",
    lifecycle: "UPCOMING",
    lifecycleStage: "UPCOMING",
    home,
    away,
    opponent: {
      displayName: away.displayName,
      canonicalTeamId: null,
      canonicalExternalTeamId: "ext-away-1",
      providerTeamId: 200,
      providerTeamName: "Provider Away",
    },
    competition: {
      eventCompetitionLabel: "Junioren E",
      providerLeagueId: null,
      providerLeagueName: null,
      providerDivisionId: null,
      providerDivisionName: null,
      providerRoundNumber: null,
      canonicalCompetitionId: "competition-1",
      canonicalCompetitionName: "Junioren E",
      canonicalCompetitionShortName: "JE",
    },
    location: "Im Brüel",
    venueName: "Sportanlage Brüel",
    resultLabel: null,
    scoreHome: null,
    scoreAway: null,
    intermediateResultLabel: null,
    provider: {
      provider: "SFV",
      externalMatchId: 9001,
      externalSeasonId: 2027,
      matchNumber: 12345,
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
    },
    ...overrides,
  };
}

describe("public-team-matches-mapper", () => {
  describe("isPublicTeamNextMatch", () => {
    it("A. includes future SCHEDULED fixtures", () => {
      expect(isPublicTeamNextMatch(createMatchItem(), NOW)).toBe(true);
    });

    it("B. includes LIVE fixtures", () => {
      expect(
        isPublicTeamNextMatch(
          createMatchItem({ lifecycle: "LIVE", status: "LIVE" }),
          NOW,
        ),
      ).toBe(true);
    });

    it("C. includes POSTPONED fixtures with a future effective kickoff", () => {
      expect(
        isPublicTeamNextMatch(
          createMatchItem({
            lifecycle: "POSTPONED",
            status: "POSTPONED",
            startAt: new Date("2026-09-01T18:00:00.000Z"),
          }),
          NOW,
        ),
      ).toBe(true);
    });

    it("C2. excludes past POSTPONED fixtures without a replacement kickoff", () => {
      expect(
        isPublicTeamNextMatch(
          createMatchItem({
            lifecycle: "POSTPONED",
            status: "POSTPONED",
            startAt: new Date("2026-08-02T12:00:00.000Z"),
          }),
          NOW,
        ),
      ).toBe(false);
    });

    it("D. excludes COMPLETED fixtures", () => {
      expect(
        isPublicTeamNextMatch(
          createMatchItem({
            lifecycle: "COMPLETED",
            lifecycleStage: "COMPLETED",
            status: "COMPLETED",
          }),
          NOW,
        ),
      ).toBe(false);
    });

    it("E. excludes stale past SCHEDULED fixtures", () => {
      expect(
        isPublicTeamNextMatch(
          createMatchItem({
            startAt: new Date("2026-08-01T18:00:00.000Z"),
            lifecycle: "UPCOMING",
          }),
          NOW,
        ),
      ).toBe(false);
    });

    it("F. excludes CANCELLED fixtures", () => {
      expect(
        isPublicTeamNextMatch(
          createMatchItem({ lifecycle: "CANCELLED", status: "CANCELLED" }),
          NOW,
        ),
      ).toBe(false);
    });

    it("G. excludes NEEDS_RECONCILIATION fixtures", () => {
      expect(
        isPublicTeamNextMatch(
          createMatchItem({ lifecycle: "NEEDS_RECONCILIATION" }),
          NOW,
        ),
      ).toBe(false);
    });

    it("H. excludes DRAFT and ARCHIVED statuses", () => {
      expect(
        isPublicTeamNextMatch(createMatchItem({ status: "DRAFT" }), NOW),
      ).toBe(false);
      expect(
        isPublicTeamNextMatch(createMatchItem({ status: "ARCHIVED" }), NOW),
      ).toBe(false);
    });
  });

  describe("filterPublicTeamNextMatches", () => {
    it("C. returns upcoming fixtures ascending by startAt", () => {
      const items = [
        createMatchItem({
          eventId: "event-3",
          startAt: new Date("2026-10-01T18:00:00.000Z"),
        }),
        createMatchItem({
          eventId: "event-1",
          startAt: new Date("2026-09-01T18:00:00.000Z"),
        }),
        createMatchItem({
          eventId: "event-2",
          startAt: new Date("2026-09-15T18:00:00.000Z"),
        }),
      ];

      const filtered = filterPublicTeamNextMatches(items, NOW, 10);

      expect(filtered.map((item) => item.eventId)).toEqual([
        "event-1",
        "event-2",
        "event-3",
      ]);
    });

    it("D. limits to the first five chronological fixtures", () => {
      const items = Array.from({ length: 7 }, (_, index) =>
        createMatchItem({
          eventId: `event-${index + 1}`,
          startAt: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`),
        }),
      );

      const filtered = filterPublicTeamNextMatches(items, NOW);

      expect(filtered).toHaveLength(PUBLIC_TEAM_NEXT_MATCHES_DEFAULT_LIMIT);
      expect(filtered.map((item) => item.eventId)).toEqual([
        "event-1",
        "event-2",
        "event-3",
        "event-4",
        "event-5",
      ]);
    });
  });

  describe("mapPublicTeamMatch", () => {
    it("A. maps HOME perspective with opponent on away side", () => {
      const mapped = mapPublicTeamMatch(createMatchItem(), identityContext);

      expect(mapped.isHomeTeam).toBe(true);
      expect(mapped.isAwayTeam).toBe(false);
      expect(mapped.opponent.name).toBe("Opponent FC");
      expect(mapped.opponent.clubName).toBe("Opponent Club");
      expect(mapped.home.teamId).toBe(TEAM_ID);
      expect(mapped.away.teamId).toBeNull();
    });

    it("B. maps AWAY perspective with opponent on home side", () => {
      const mapped = mapPublicTeamMatch(
        createMatchItem({
          side: "AWAY",
          home: createSide({
            canonicalTeamId: null,
            canonicalExternalTeamId: "ext-home-1",
            displayName: "Host FC",
          }),
          away: createSide(),
          opponent: {
            displayName: "Host FC",
            canonicalTeamId: null,
            canonicalExternalTeamId: "ext-home-1",
            providerTeamId: 100,
            providerTeamName: "Provider Home",
          },
        }),
        identityContext,
      );

      expect(mapped.isHomeTeam).toBe(false);
      expect(mapped.isAwayTeam).toBe(true);
      expect(mapped.opponent.name).toBe("Host FC");
      expect(mapped.opponent.clubName).toBe("Host Club");
      expect(mapped.away.teamId).toBe(TEAM_ID);
    });

    it("M. maps known logos and tolerates missing logos", () => {
      const mapped = mapPublicTeamMatch(createMatchItem(), identityContext);

      expect(mapped.home.logoUrl).toBe(TENANT_LOGO);
      expect(mapped.away.logoUrl).toBe(OPPONENT_LOGO);
      expect(mapped.opponent.logoUrl).toBe(OPPONENT_LOGO);

      const withoutLogo = mapPublicTeamMatch(
        createMatchItem({
          away: createSide({
            canonicalTeamId: null,
            canonicalExternalTeamId: "missing-ext",
            displayName: "Unknown FC",
          }),
        }),
        identityContext,
      );

      expect(withoutLogo.away.logoUrl).toBeNull();
      expect(withoutLogo.opponent.logoUrl).toBeNull();
    });

    it("maps venue, competition, and canonical ISO kickoff", () => {
      const mapped = mapPublicTeamMatch(createMatchItem(), identityContext);

      expect(mapped.startAt).toEqual(new Date("2026-09-01T18:00:00.000Z"));
      expect(mapped.status).toBe("SCHEDULED");
      expect(mapped.venue).toEqual({
        name: "Sportanlage Brüel",
        address: "Im Brüel",
      });
      expect(mapped.competition).toEqual({ name: "Junioren E" });
      expect(mapped.id).toBe("event-1");
      expect(mapped.score).toBeNull();
      expect(mapped.resultPerspective).toBeNull();
    });

    it("does not expose provider metadata in the public DTO", () => {
      const mapped = mapPublicTeamMatches(
        [createMatchItem()],
        identityContext,
        NOW,
      )[0];

      expect(mapped).not.toHaveProperty("provider");
      expect(mapped).not.toHaveProperty("lifecycle");
      expect(mapped.home).not.toHaveProperty("canonicalExternalTeamId");
    });
  });

  describe("isPublicTeamResult", () => {
    function createCompletedItem(
      overrides: Partial<TeamSeasonMatchItem> = {},
    ): TeamSeasonMatchItem {
      return createMatchItem({
        status: "COMPLETED",
        lifecycle: "COMPLETED",
        lifecycleStage: "COMPLETED",
        startAt: new Date("2026-07-01T18:00:00.000Z"),
        scoreHome: 3,
        scoreAway: 1,
        ...overrides,
      });
    }

    it("H. includes COMPLETED fixtures", () => {
      expect(isPublicTeamResult(createCompletedItem())).toBe(true);
    });

    it("G. excludes SCHEDULED fixtures", () => {
      expect(isPublicTeamResult(createMatchItem())).toBe(false);
    });

    it("G. excludes LIVE fixtures", () => {
      expect(
        isPublicTeamResult(
          createCompletedItem({ lifecycle: "LIVE", status: "LIVE" }),
        ),
      ).toBe(false);
    });

    it("G. excludes POSTPONED fixtures", () => {
      expect(
        isPublicTeamResult(
          createCompletedItem({ lifecycle: "POSTPONED", status: "POSTPONED" }),
        ),
      ).toBe(false);
    });

    it("G. excludes CANCELLED fixtures", () => {
      expect(
        isPublicTeamResult(
          createCompletedItem({ lifecycle: "CANCELLED", status: "CANCELLED" }),
        ),
      ).toBe(false);
    });

    it("G. excludes DRAFT and ARCHIVED statuses", () => {
      expect(
        isPublicTeamResult(createCompletedItem({ status: "DRAFT" })),
      ).toBe(false);
      expect(
        isPublicTeamResult(createCompletedItem({ status: "ARCHIVED" })),
      ).toBe(false);
    });

    it("G. excludes NEEDS_RECONCILIATION fixtures", () => {
      expect(
        isPublicTeamResult(
          createCompletedItem({ lifecycle: "NEEDS_RECONCILIATION" }),
        ),
      ).toBe(false);
    });
  });

  describe("filterPublicTeamResults", () => {
    function createCompletedItem(
      overrides: Partial<TeamSeasonMatchItem> = {},
    ): TeamSeasonMatchItem {
      return createMatchItem({
        status: "COMPLETED",
        lifecycle: "COMPLETED",
        lifecycleStage: "COMPLETED",
        scoreHome: 2,
        scoreAway: 1,
        ...overrides,
      });
    }

    it("I. returns completed fixtures descending by startAt", () => {
      const items = [
        createCompletedItem({
          eventId: "event-older",
          startAt: new Date("2026-06-01T18:00:00.000Z"),
        }),
        createCompletedItem({
          eventId: "event-newer",
          startAt: new Date("2026-08-01T18:00:00.000Z"),
        }),
        createCompletedItem({
          eventId: "event-middle",
          startAt: new Date("2026-07-01T18:00:00.000Z"),
        }),
      ];

      const filtered = filterPublicTeamResults(items, 10);

      expect(filtered.map((item) => item.eventId)).toEqual([
        "event-newer",
        "event-middle",
        "event-older",
      ]);
    });

    it("J. limits to the five most recent results", () => {
      const items = Array.from({ length: 7 }, (_, index) =>
        createCompletedItem({
          eventId: `event-${index + 1}`,
          startAt: new Date(`2026-0${index + 1}-01T18:00:00.000Z`),
        }),
      );

      const filtered = filterPublicTeamResults(items);

      expect(filtered).toHaveLength(PUBLIC_TEAM_RESULTS_DEFAULT_LIMIT);
      expect(filtered.map((item) => item.eventId)).toEqual([
        "event-7",
        "event-6",
        "event-5",
        "event-4",
        "event-3",
      ]);
    });

    it("G. excludes non-completed fixtures from results", () => {
      const items = [
        createCompletedItem({ eventId: "event-completed" }),
        createMatchItem({ eventId: "event-scheduled" }),
      ];

      const filtered = filterPublicTeamResults(items, 10);

      expect(filtered.map((item) => item.eventId)).toEqual(["event-completed"]);
    });
  });

  describe("resolvePublicTeamResultPerspective", () => {
    function createCompletedItem(
      overrides: Partial<TeamSeasonMatchItem> = {},
    ): TeamSeasonMatchItem {
      return createMatchItem({
        status: "COMPLETED",
        lifecycle: "COMPLETED",
        lifecycleStage: "COMPLETED",
        ...overrides,
      });
    }

    it("A. HOME win 3-1 => WON", () => {
      expect(
        resolvePublicTeamResultPerspective(
          createCompletedItem({ side: "HOME", scoreHome: 3, scoreAway: 1 }),
        ),
      ).toBe("WON");
    });

    it("B. HOME loss 0-2 => LOST", () => {
      expect(
        resolvePublicTeamResultPerspective(
          createCompletedItem({ side: "HOME", scoreHome: 0, scoreAway: 2 }),
        ),
      ).toBe("LOST");
    });

    it("C. AWAY win (home 1, away 2) => WON", () => {
      expect(
        resolvePublicTeamResultPerspective(
          createCompletedItem({ side: "AWAY", scoreHome: 1, scoreAway: 2 }),
        ),
      ).toBe("WON");
    });

    it("D. AWAY loss (home 4, away 1) => LOST", () => {
      expect(
        resolvePublicTeamResultPerspective(
          createCompletedItem({ side: "AWAY", scoreHome: 4, scoreAway: 1 }),
        ),
      ).toBe("LOST");
    });

    it("E. DRAW 2-2 => DRAW", () => {
      expect(
        resolvePublicTeamResultPerspective(
          createCompletedItem({ side: "HOME", scoreHome: 2, scoreAway: 2 }),
        ),
      ).toBe("DRAW");
    });

    it("completed 0-0 remains a DRAW", () => {
      expect(
        resolvePublicTeamResultPerspective(
          createCompletedItem({ side: "AWAY", scoreHome: 0, scoreAway: 0 }),
        ),
      ).toBe("DRAW");
    });

    it("F. missing score => UNKNOWN", () => {
      expect(
        resolvePublicTeamResultPerspective(
          createCompletedItem({ scoreHome: null, scoreAway: null }),
        ),
      ).toBe("UNKNOWN");
      expect(
        resolvePublicTeamResultPerspective(
          createCompletedItem({ scoreHome: 1, scoreAway: null }),
        ),
      ).toBe("UNKNOWN");
    });
  });

  describe("mapPublicTeamResults", () => {
    function createCompletedItem(
      overrides: Partial<TeamSeasonMatchItem> = {},
    ): TeamSeasonMatchItem {
      return createMatchItem({
        status: "COMPLETED",
        lifecycle: "COMPLETED",
        lifecycleStage: "COMPLETED",
        startAt: new Date("2026-07-01T18:00:00.000Z"),
        scoreHome: 3,
        scoreAway: 1,
        ...overrides,
      });
    }

    it("maps score and resultPerspective for completed fixtures", () => {
      const mapped = mapPublicTeamResults(
        [createCompletedItem()],
        identityContext,
      )[0];

      expect(mapped?.score).toEqual({ home: 3, away: 1 });
      expect(mapped?.resultPerspective).toBe("WON");
      expect(mapped?.status).toBe("COMPLETED");
    });

    it("K. includes away completed fixtures", () => {
      const mapped = mapPublicTeamResults(
        [
          createCompletedItem({
            side: "AWAY",
            scoreHome: 1,
            scoreAway: 2,
            home: createSide({
              canonicalTeamId: null,
              canonicalExternalTeamId: "ext-home-1",
              displayName: "Host FC",
            }),
            away: createSide(),
            opponent: {
              displayName: "Host FC",
              canonicalTeamId: null,
              canonicalExternalTeamId: "ext-home-1",
              providerTeamId: 100,
              providerTeamName: "Provider Home",
            },
          }),
        ],
        identityContext,
      )[0];

      expect(mapped?.isAwayTeam).toBe(true);
      expect(mapped?.score).toEqual({ home: 1, away: 2 });
      expect(mapped?.resultPerspective).toBe("WON");
      expect(mapped?.opponent.name).toBe("Host FC");
    });

    it("includes a genuine completed 0-0 result as a draw", () => {
      const mapped = mapPublicTeamResults(
        [createCompletedItem({ scoreHome: 0, scoreAway: 0 })],
        identityContext,
      )[0];

      expect(mapped?.score).toEqual({ home: 0, away: 0 });
      expect(mapped?.resultPerspective).toBe("DRAW");
    });

    it("M. maps logos same as nextMatches", () => {
      const mapped = mapPublicTeamResults(
        [createCompletedItem()],
        identityContext,
      )[0];

      expect(mapped?.home.logoUrl).toBe(TENANT_LOGO);
      expect(mapped?.away.logoUrl).toBe(OPPONENT_LOGO);
      expect(mapped?.opponent.logoUrl).toBe(OPPONENT_LOGO);
    });

    it("does not expose provider metadata in result DTO", () => {
      const mapped = mapPublicTeamResults(
        [createCompletedItem()],
        identityContext,
      )[0];

      expect(mapped).not.toHaveProperty("provider");
      expect(mapped).not.toHaveProperty("lifecycle");
      expect(mapped?.home).not.toHaveProperty("canonicalExternalTeamId");
    });
  });
});
