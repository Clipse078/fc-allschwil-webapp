/**
 * WOCHENPLAN-2.0-02H — public Wochenplan Garderobe contract regression tests.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type {
  WeekplannerMatchItem,
  WeekplannerResourceRef,
  WeekplannerTournamentItem,
  WeekplannerTrainingItem,
  WeekplannerWeek,
} from "@/lib/weekplanner/types";
import type { WochenplanPlanDto } from "../plan-types";
import { buildPublicCurrentWeekFeed } from "../public-feed";
import {
  buildPublicMatchIdentity,
  mapMatchDressingRooms,
  mapMatchToPublicEvent,
  mapTrainingDressingRooms,
  mapTrainingToPublicEvent,
  mapTournamentDressingRooms,
  resolveMatchTeamContext,
  resolveTrainingTeamContext,
} from "../public-feed-mapper";
import { buildCanonicalClubLogoIndex } from "@/lib/club-directory/canonical-logo-resolution";
import { evaluateWochenplanMatchPublication } from "../publication-policy";

const mocks = vi.hoisted(() => ({
  getActiveWochenplanPlan: vi.fn(),
  resolvePublicWeekplannerPlan: vi.fn(),
  getWeekplannerWeek: vi.fn(),
  getWochenplanPublication: vi.fn(),
  listTournamentsByIds: vi.fn(),
  eventFindMany: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  tenantFindFirst: vi.fn(),
}));

vi.mock("../plan-service", () => ({
  getActiveWochenplanPlan: mocks.getActiveWochenplanPlan,
}));

vi.mock("../public-plan-resolution", () => ({
  resolvePublicWeekplannerPlan: mocks.resolvePublicWeekplannerPlan,
}));

vi.mock("@/lib/weekplanner/queries", () => ({
  getWeekplannerWeek: mocks.getWeekplannerWeek,
}));

vi.mock("../publication-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../publication-queries")>();
  return {
    ...actual,
    getWochenplanPublication: mocks.getWochenplanPublication,
  };
});

vi.mock("@/lib/tournaments/tournament-service", () => ({
  listTournamentsByIds: mocks.listTournamentsByIds,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: mocks.eventFindMany },
    trainingSession: { findMany: mocks.trainingSessionFindMany },
    tenant: { findFirst: mocks.tenantFindFirst },
  },
}));

const TENANT_ID = "tenant-fca";
const TENANT_NAME = "FC Allschwil";
const NOW = new Date("2026-08-26T10:00:00.000Z");
const CANONICAL_LOGO = "https://example.test/fc-black-stars.png";

const ACTIVE_PLAN: WochenplanPlanDto = {
  id: "plan-active",
  tenantId: TENANT_ID,
  name: "Standardplan",
  description: null,
  isDefault: true,
  isActive: true,
  displayOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
};

function room(code: string, name: string): WeekplannerResourceRef {
  return {
    facilityResourceId: `res-${code}`,
    code,
    name,
    facilityName: "Garderobentrakt",
    occupancyBeforeMinutes: 0,
    occupancyAfterMinutes: 0,
  };
}

function trainingItem(overrides: Partial<WeekplannerTrainingItem> = {}): WeekplannerTrainingItem {
  return {
    id: "training:session-1",
    tenantId: TENANT_ID,
    type: "TRAINING",
    startAt: new Date("2026-08-26T17:15:00.000Z"),
    endAt: new Date("2026-08-26T18:45:00.000Z"),
    canonicalStartAt: new Date("2026-08-26T17:15:00.000Z"),
    canonicalEndAt: new Date("2026-08-26T18:45:00.000Z"),
    timeOverridden: false,
    title: "Juniorinnen E / FF-11 Training",
    teamNames: ["Juniorinnen E / FF-11"],
    pitchAllocations: [
      room("KR2A", "Kunstrasen 2 A"),
    ],
    dressingRoomAllocations: [],
    canonicalPitchAllocations: [],
    canonicalDressingRoomAllocations: [],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    conflicts: [],
    trainingSeriesId: "series-1",
    trainingSessionId: "session-1",
    ...overrides,
  };
}

function matchItem(overrides: Partial<WeekplannerMatchItem> = {}): WeekplannerMatchItem {
  return {
    id: "match:event-1",
    tenantId: TENANT_ID,
    type: "MATCH",
    startAt: new Date("2026-08-27T14:00:00.000Z"),
    endAt: new Date("2026-08-27T15:30:00.000Z"),
    canonicalStartAt: new Date("2026-08-27T14:00:00.000Z"),
    canonicalEndAt: new Date("2026-08-27T15:30:00.000Z"),
    timeOverridden: false,
    title: "FC Allschwil 1 - FC Gegner",
    teamNames: ["1. Mannschaft"],
    opponentName: "FC Gegner",
    homeAway: "HOME",
    eventId: "event-match-1",
    pitchAllocations: [room("KR2", "Kunstrasen 2")],
    dressingRoomAllocations: [],
    canonicalPitchAllocations: [],
    canonicalDressingRoomAllocations: [],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    awayDressingRoomAllocations: [],
    conflicts: [],
    ...overrides,
  };
}

function tournamentItem(overrides: Partial<WeekplannerTournamentItem> = {}): WeekplannerTournamentItem {
  return {
    id: "tournament:event-2",
    tenantId: TENANT_ID,
    type: "TOURNAMENT",
    startAt: new Date("2026-08-28T08:00:00.000Z"),
    endAt: new Date("2026-08-28T16:00:00.000Z"),
    canonicalStartAt: new Date("2026-08-28T08:00:00.000Z"),
    canonicalEndAt: new Date("2026-08-28T16:00:00.000Z"),
    timeOverridden: false,
    title: "FCA Turnier",
    teamNames: ["Junioren F2"],
    homeAway: "HOME",
    eventId: "event-tournament-1",
    pitchAllocations: [],
    dressingRoomAllocations: [],
    canonicalPitchAllocations: [],
    canonicalDressingRoomAllocations: [],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    participantAllocations: [],
    conflicts: [],
    ...overrides,
  };
}

function buildWeek(items: WeekplannerWeek["days"][number]["items"], dayKey = "2026-08-26"): WeekplannerWeek {
  const days = [
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
  ].map((key) => ({
    dayKey: key,
    items: key === dayKey ? items : [],
  }));

  return {
    days,
    weekNumberLabel: "KW 35",
    rangeLabel: "24. Aug – 30. Aug 2026",
    param: "2026-08-24",
    previousParam: "2026-08-17",
    nextParam: "2026-08-31",
  };
}

function setupDefaultMocks(items: WeekplannerWeek["days"][number]["items"] = [trainingItem()]) {
  mocks.tenantFindFirst.mockResolvedValue({
    logoUrl: "https://cdn.example/tenant.png",
    timezone: "Europe/Zurich",
  });
  mocks.getActiveWochenplanPlan.mockResolvedValue(ACTIVE_PLAN);
  mocks.resolvePublicWeekplannerPlan.mockResolvedValue({
    weekplannerPlanId: null,
    activeWochenplanPlan: ACTIVE_PLAN,
    usedStandardplanFallback: false,
  });
  mocks.getWeekplannerWeek.mockResolvedValue(buildWeek(items));
  mocks.getWochenplanPublication.mockResolvedValue({
    weekId: "2026-08-24",
    variantLabel: "Standardplan",
    isPublished: true,
    publishedAt: new Date("2026-08-24T08:00:00.000Z"),
  });
  mocks.listTournamentsByIds.mockResolvedValue([]);
  mocks.trainingSessionFindMany.mockResolvedValue([
    {
      id: "session-1",
      status: "SCHEDULED",
      teamSeason: {
        season: { key: "2026-27" },
        team: {
          id: "team-ff11",
          slug: "juniorinnen-e-ff11",
          name: "Juniorinnen E / FF-11",
          shortName: null,
          alternativeName: null,
          infoboardDisplayName: null,
          infoboardTrainingDisplayName: null,
          infoboardMatchDisplayName: null,
          infoboardTournamentDisplayName: null,
        },
      },
    },
  ]);
  mocks.eventFindMany.mockResolvedValue([]);
}

describe("WOCHENPLAN-2.0-02H public Garderobe contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("A. training with one canonical Garderobe exposes it in the public DTO", async () => {
    setupDefaultMocks([
      trainingItem({
        dressingRoomAllocations: [room("O1", "Garderobe O1")],
      }),
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });

    const training = feed.days.flatMap((day) => day.events).find((event) => event.kind === "TRAINING");
    expect(training?.dressingRooms).toEqual([
      {
        name: "Garderobe O1",
        facilityName: "Garderobentrakt",
        role: "TRAINING",
      },
    ]);
  });

  it("B. training without Garderobe returns null — no fabricated fallback", () => {
    expect(mapTrainingDressingRooms(trainingItem())).toBeNull();
    expect(
      mapTrainingToPublicEvent(
        trainingItem(),
        {
          id: "session-1",
          status: "SCHEDULED",
          teamSeason: {
            season: { key: "2026-27" },
            team: {
              id: "team-ff11",
              slug: "juniorinnen-e-ff11",
              name: "Juniorinnen E / FF-11",
              shortName: null,
              alternativeName: null,
              infoboardDisplayName: null,
              infoboardTrainingDisplayName: null,
              infoboardMatchDisplayName: null,
              infoboardTournamentDisplayName: null,
            },
          },
        },
        resolveTrainingTeamContext(undefined),
      ).dressingRooms,
    ).toBeNull();
  });

  it("C. match preserves HOME and AWAY Garderobe roles", () => {
    const rooms = mapMatchDressingRooms(
      matchItem({
        dressingRoomAllocations: [room("O2", "Garderobe O2")],
        awayDressingRoomAllocations: [room("E2", "Garderobe E2")],
      }),
    );

    expect(rooms).toEqual([
      { name: "Garderobe O2", facilityName: "Garderobentrakt", role: "HOME" },
      { name: "Garderobe E2", facilityName: "Garderobentrakt", role: "AWAY" },
    ]);
  });

  it("D. multiple legitimate allocations survive without duplication", () => {
    const rooms = mapMatchDressingRooms(
      matchItem({
        dressingRoomAllocations: [room("O2", "Garderobe O2"), room("O2", "Garderobe O2")],
        awayDressingRoomAllocations: [room("E2", "Garderobe E2")],
      }),
    );

    expect(rooms).toHaveLength(2);
    expect(rooms?.map((roomEntry) => roomEntry.role)).toEqual(["HOME", "AWAY"]);
  });

  it("E. existing pitch information remains unchanged", async () => {
    setupDefaultMocks([
      trainingItem({
        dressingRoomAllocations: [room("O1", "Garderobe O1")],
        pitchAllocations: [room("KR2A", "Kunstrasen 2 A")],
      }),
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });

    const training = feed.days.flatMap((day) => day.events).find((event) => event.kind === "TRAINING");
    expect(training?.pitch).toEqual({
      name: "Kunstrasen 2 A",
      facilityName: "Garderobentrakt",
    });
    expect(training?.location).toBeTruthy();
  });

  it("F. active Standardplan behavior remains unchanged", async () => {
    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });

    expect(feed.activePlan.name).toBe("Standardplan");
    expect(feed.activePlan.id).toBe("plan-active");
  });

  it("G. FC Black Stars D7a canonical logo remains populated", () => {
    const canonicalIndex = buildCanonicalClubLogoIndex([
      { providerClubId: 483, externalClub: { logoUrl: CANONICAL_LOGO } },
    ]);

    const identity = buildPublicMatchIdentity(
      {
        id: "event-match-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "HOME",
        organizerName: null,
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: {
          id: "team-d7-d1",
          slug: "junioren-d7-d1",
          name: "FC Allschwil Junioren D-7 D1",
          shortName: null,
          alternativeName: null,
          infoboardDisplayName: null,
          infoboardTrainingDisplayName: null,
          infoboardMatchDisplayName: null,
          infoboardTournamentDisplayName: null,
        },
        opponentExternalClub: null,
        matchExternalMapping: {
          homeTeam: {
            id: "team-d7-d1",
            slug: "junioren-d7-d1",
            name: "FC Allschwil Junioren D-7 D1",
            shortName: null,
            alternativeName: null,
            infoboardDisplayName: null,
            infoboardTrainingDisplayName: null,
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
          awayTeam: null,
          homeExternalTeam: null,
          awayExternalTeam: {
            name: "FC Black Stars D7A",
            shortName: null,
            alternativeName: null,
            logoUrl: null,
            externalClub: {
              name: "FC Black Stars D7A",
              shortName: null,
              logoUrl: null,
            },
            providerMappings: [{ providerClubId: 483 }],
          },
        },
      },
      matchItem({
        opponentName: "FC Black Stars D7A",
        dressingRoomAllocations: [room("O2", "Garderobe O2")],
        awayDressingRoomAllocations: [room("E2", "Garderobe E2")],
      }),
      TENANT_NAME,
      "https://cdn.example/tenant.png",
      canonicalIndex,
    );

    expect(identity.away.logoUrl).toBe(CANONICAL_LOGO);
  });

  it("H. FC Black Stars B canonical logo remains populated", () => {
    const canonicalIndex = buildCanonicalClubLogoIndex([
      { providerClubId: 483, externalClub: { logoUrl: CANONICAL_LOGO } },
    ]);

    const identity = buildPublicMatchIdentity(
      {
        id: "event-match-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "HOME",
        organizerName: null,
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: {
          id: "team-b2",
          slug: "junioren-b2",
          name: "FC Allschwil Junioren B2",
          shortName: null,
          alternativeName: null,
          infoboardDisplayName: null,
          infoboardTrainingDisplayName: null,
          infoboardMatchDisplayName: null,
          infoboardTournamentDisplayName: null,
        },
        opponentExternalClub: null,
        matchExternalMapping: {
          homeTeam: {
            id: "team-b2",
            slug: "junioren-b2",
            name: "FC Allschwil Junioren B2",
            shortName: null,
            alternativeName: null,
            infoboardDisplayName: null,
            infoboardTrainingDisplayName: null,
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
          awayTeam: null,
          homeExternalTeam: null,
          awayExternalTeam: {
            name: "FC Black Stars B",
            shortName: null,
            alternativeName: null,
            logoUrl: null,
            externalClub: {
              name: "FC Black Stars B",
              shortName: null,
              logoUrl: null,
            },
            providerMappings: [{ providerClubId: 483 }],
          },
        },
      },
      matchItem({ opponentName: "FC Black Stars B" }),
      TENANT_NAME,
      "https://cdn.example/tenant.png",
      canonicalIndex,
    );

    expect(identity.away.logoUrl).toBe(CANONICAL_LOGO);
  });

  it("I. normal opponent logo still resolves alongside Garderobe mapping", () => {
    const canonicalIndex = buildCanonicalClubLogoIndex([
      { providerClubId: 700, externalClub: { logoUrl: "https://example.test/other.png" } },
    ]);

    const mapped = mapMatchToPublicEvent(
      matchItem({
        dressingRoomAllocations: [room("O2", "Garderobe O2")],
        awayDressingRoomAllocations: [room("E2", "Garderobe E2")],
      }),
      {
        id: "event-match-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "HOME",
        organizerName: null,
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: {
          id: "team-1",
          slug: "aktive-1",
          name: "1. Mannschaft",
          shortName: null,
          alternativeName: null,
          infoboardDisplayName: null,
          infoboardTrainingDisplayName: null,
          infoboardMatchDisplayName: null,
          infoboardTournamentDisplayName: null,
        },
        opponentExternalClub: {
          name: "SV Muttenz B1",
          shortName: null,
          alternativeName: null,
          logoUrl: "https://example.test/other.png",
        },
        matchExternalMapping: {
          homeTeam: {
            id: "team-1",
            slug: "aktive-1",
            name: "1. Mannschaft",
            shortName: null,
            alternativeName: null,
            infoboardDisplayName: null,
            infoboardTrainingDisplayName: null,
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
          awayTeam: null,
          homeExternalTeam: null,
          awayExternalTeam: {
            name: "SV Muttenz B1",
            shortName: null,
            alternativeName: null,
            logoUrl: null,
            externalClub: {
              name: "SV Muttenz B1",
              shortName: null,
              logoUrl: null,
            },
            providerMappings: [{ providerClubId: 700 }],
          },
        },
      },
      resolveMatchTeamContext(undefined),
      TENANT_NAME,
      "https://cdn.example/tenant.png",
      canonicalIndex,
    );

    expect(mapped.matchIdentity?.away.logoUrl).toBe("https://example.test/other.png");
    expect(mapped.dressingRooms).toEqual([
      { name: "Garderobe O2", facilityName: "Garderobentrakt", role: "HOME" },
      { name: "Garderobe E2", facilityName: "Garderobentrakt", role: "AWAY" },
    ]);
  });

  it("J. public scope remains HOME / canonical facility only", () => {
    const awayDecision = evaluateWochenplanMatchPublication(
      {
        tenantId: TENANT_ID,
        type: "MATCH",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "AWAY",
      },
      TENANT_ID,
    );

    expect(awayDecision.eligible).toBe(false);
  });

  it("tournament participant Garderobe allocations are exposed with participant labels", () => {
    const rooms = mapTournamentDressingRooms(
      tournamentItem({
        participantAllocations: [
          {
            participantId: "p1",
            participantLabel: "Junioren F2",
            dressingRoomAllocations: [room("O1", "Garderobe O1")],
            canonicalDressingRoomAllocations: [],
            dressingRoomOverridden: false,
          },
          {
            participantId: "p2",
            participantLabel: "Gast Team",
            dressingRoomAllocations: [room("E1", "Garderobe E1")],
            canonicalDressingRoomAllocations: [],
            dressingRoomOverridden: false,
          },
        ],
      }),
    );

    expect(rooms).toEqual([
      {
        name: "Garderobe O1",
        facilityName: "Garderobentrakt",
        role: "TOURNAMENT_PARTICIPANT",
        participantLabel: "Junioren F2",
      },
      {
        name: "Garderobe E1",
        facilityName: "Garderobentrakt",
        role: "TOURNAMENT_PARTICIPANT",
        participantLabel: "Gast Team",
      },
    ]);
  });
});
