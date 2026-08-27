import { describe, expect, it } from "vitest";

import type { TeamSeasonMatchItem } from "@/lib/teams/team-match-query-service";
import {
  filterPublicTeamNextMatches,
  isPublicTeamNextMatch,
  mapPublicTeamMatch,
  mapPublicTeamMatches,
  PUBLIC_TEAM_NEXT_MATCHES_DEFAULT_LIMIT,
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

    it("C. includes POSTPONED unresolved fixtures", () => {
      expect(
        isPublicTeamNextMatch(
          createMatchItem({ lifecycle: "POSTPONED", status: "POSTPONED" }),
          NOW,
        ),
      ).toBe(true);
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
});
