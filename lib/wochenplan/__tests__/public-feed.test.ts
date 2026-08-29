/**
 * WOCHENPLAN-2.0-01C — public current-week feed tests.
 *
 * Covers the 23 acceptance cases from the engineering spec via unit tests
 * against buildPublicCurrentWeekFeed and mapper helpers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  WeekplannerMatchItem,
  WeekplannerTournamentItem,
  WeekplannerTrainingItem,
  WeekplannerWeek,
} from "@/lib/weekplanner/types";
import type { WochenplanPlanDto } from "../plan-types";

const mocks = vi.hoisted(() => ({
  getActiveWochenplanPlan: vi.fn(),
  resolvePublicWeekplannerPlan: vi.fn(),
  getWeekplannerWeek: vi.fn(),
  getWochenplanPublication: vi.fn(),
  listTournamentsByIds: vi.fn(),
  eventFindMany: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  tenantFindFirst: vi.fn(),
  weekplannerPlanFindFirst: vi.fn(),
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
    weekplannerPlan: { findFirst: mocks.weekplannerPlanFindFirst },
  },
}));

import { buildPublicCurrentWeekFeed } from "../public-feed";
import {
  buildPublicMatchIdentity,
  mapMatchToPublicEvent,
  mapTournamentToPublicEvent,
  mapTrainingToPublicEvent,
  matchesTeamSlug,
  resolveMatchTeamContext,
  resolveTrainingTeamContext,
  resolveTournamentTeamContext,
} from "../public-feed-mapper";
import { evaluatePublication } from "@/lib/publishing/policy/publication-policy";

const TENANT_ID = "tenant-fca";
const TENANT_NAME = "FC Allschwil";
const NOW = new Date("2026-08-26T10:00:00.000Z");

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

const INACTIVE_PLAN: WochenplanPlanDto = {
  ...ACTIVE_PLAN,
  id: "plan-inactive",
  name: "Schlechtwetterplan",
  isActive: false,
};

function trainingItem(overrides: Partial<WeekplannerTrainingItem> = {}): WeekplannerTrainingItem {
  return {
    id: "training:session-1",
    tenantId: TENANT_ID,
    type: "TRAINING",
    startAt: new Date("2026-08-26T17:00:00.000Z"),
    endAt: new Date("2026-08-26T18:30:00.000Z"),
    canonicalStartAt: new Date("2026-08-26T17:00:00.000Z"),
    canonicalEndAt: new Date("2026-08-26T18:30:00.000Z"),
    timeOverridden: false,
    title: "Junioren F2 Training",
    teamNames: ["Junioren F2"],
    pitchAllocations: [{ facilityResourceId: "r1", code: "KR2", name: "Kunstrasen 2", facilityName: "Im Brüel" }],
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
    pitchAllocations: [],
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
          id: "team-f2",
          slug: "junioren-f2",
          name: "Junioren F2",
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

describe("buildPublicCurrentWeekFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("1. exposes active plan name and id publicly", async () => {
    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(feed.activePlan.name).toBe("Standardplan");
    expect(feed.activePlan.id).toBe("plan-active");
    expect(feed.publication?.activePlanName).toBe("Standardplan");
    expect(feed.publication?.activePlanId).toBe("plan-active");
  });

  it("2. inactive plan is not exposed as active", async () => {
    mocks.getActiveWochenplanPlan.mockResolvedValue(ACTIVE_PLAN);
    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(feed.activePlan.id).toBe("plan-active");
    expect(feed.activePlan.name).not.toBe(INACTIVE_PLAN.name);
  });

  it("3. tenant-defined plan names work", async () => {
    const winterPlan = { ...ACTIVE_PLAN, name: "Winterplan" };
    mocks.getActiveWochenplanPlan.mockResolvedValue(winterPlan);
    mocks.resolvePublicWeekplannerPlan.mockResolvedValue({
      weekplannerPlanId: "wp-winter",
      activeWochenplanPlan: winterPlan,
      usedStandardplanFallback: false,
    });
    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(feed.activePlan.name).toBe("Winterplan");
  });

  it("4. resolves current week boundaries", async () => {
    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(feed.currentWeek.weekId).toBe("2026-08-24");
    expect(feed.days).toHaveLength(7);
  });

  it("5. respects tenant timezone for week boundaries", async () => {
    mocks.tenantFindFirst.mockResolvedValue({
      logoUrl: null,
      timezone: "America/Los_Angeles",
    });
    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: new Date("2026-01-05T07:30:00.000Z"),
    });
    expect(feed.currentWeek.timeZone).toBe("America/Los_Angeles");
  });

  it("6. includes current-week training", async () => {
    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    const events = feed.days.flatMap((day) => day.events);
    expect(events.some((event) => event.kind === "TRAINING")).toBe(true);
  });

  it("7. excludes previous/future week items via weekplanner window", async () => {
    await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    const windowArg = mocks.getWeekplannerWeek.mock.calls[0][1];
    expect(windowArg.days[0]).toBe("2026-08-24");
    expect(windowArg.days[6]).toBe("2026-08-30");
    expect(windowArg.from.getTime()).toBeLessThan(new Date("2026-08-26T10:00:00.000Z").getTime());
  });

  it("8. includes home match when websiteVisible", async () => {
    setupDefaultMocks([matchItem()], "2026-08-27");
    mocks.eventFindMany.mockResolvedValue([
      {
        id: "event-match-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "HOME",
        organizerName: null,
        competitionLabel: "Meisterschaft",
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: { id: "team-1", slug: "aktive-1", name: "1. Mannschaft", shortName: null, alternativeName: null, infoboardDisplayName: null, infoboardTrainingDisplayName: null, infoboardMatchDisplayName: null, infoboardTournamentDisplayName: null },
        opponentExternalClub: { name: "FC Gegner", shortName: null, alternativeName: null, logoUrl: "https://cdn.example/opp.png" },
        matchExternalMapping: null,
      },
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    const matches = feed.days.flatMap((day) => day.events).filter((e) => e.kind === "MATCH");
    expect(matches).toHaveLength(1);
  });

  it("9. excludes away match via publication policy", async () => {
    setupDefaultMocks([matchItem()], "2026-08-27");
    mocks.eventFindMany.mockResolvedValue([
      {
        id: "event-match-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "AWAY",
        organizerName: null,
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: { id: "team-1", slug: "aktive-1", name: "1. Mannschaft", shortName: null, alternativeName: null, infoboardDisplayName: null, infoboardTrainingDisplayName: null, infoboardMatchDisplayName: null, infoboardTournamentDisplayName: null },
        opponentExternalClub: null,
        matchExternalMapping: null,
      },
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(feed.days.flatMap((day) => day.events).filter((e) => e.kind === "MATCH")).toHaveLength(0);
  });

  it("10. includes home-facility tournament", async () => {
    setupDefaultMocks([tournamentItem()], "2026-08-28");
    mocks.eventFindMany.mockResolvedValue([
      {
        id: "event-tournament-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "HOME",
        organizerName: "FC Allschwil",
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: null,
        opponentExternalClub: null,
        matchExternalMapping: null,
      },
    ]);
    mocks.listTournamentsByIds.mockResolvedValue([
      {
        id: "event-tournament-1",
        organizerName: "FC Allschwil",
        organizerLogoUrl: "https://cdn.example/org.png",
        organizerExternalClubId: null,
        participants: [
          {
            id: "p1",
            displayName: "Junioren F2",
            logoUrl: "https://cdn.example/tenant.png",
            kind: "TEAM",
            team: { id: "team-f2", slug: "junioren-f2", name: "Junioren F2" },
            externalClub: null,
          },
        ],
      },
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(feed.summary.tournamentCount).toBe(1);
  });

  it("11. excludes external/away tournament", async () => {
    setupDefaultMocks([tournamentItem()], "2026-08-28");
    mocks.eventFindMany.mockResolvedValue([
      {
        id: "event-tournament-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "AWAY",
        organizerName: "External",
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: null,
        opponentExternalClub: null,
        matchExternalMapping: null,
      },
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(feed.summary.tournamentCount).toBe(0);
  });

  it("16–18. team filter includes matching training/match/tournament", async () => {
    setupDefaultMocks([trainingItem()]);
    const week = buildWeek([trainingItem()], "2026-08-26");
    week.days = week.days.map((day) =>
      day.dayKey === "2026-08-27" ? { ...day, items: [matchItem()] } : day,
    );
    mocks.getWeekplannerWeek.mockResolvedValue(week);
    mocks.eventFindMany.mockResolvedValue([
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
        team: { id: "team-1", slug: "junioren-f2", name: "Junioren F2", shortName: null, alternativeName: null, infoboardDisplayName: null, infoboardTrainingDisplayName: null, infoboardMatchDisplayName: null, infoboardTournamentDisplayName: null },
        opponentExternalClub: null,
        matchExternalMapping: null,
      },
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      teamSlug: "junioren-f2",
      now: NOW,
    });
    const kinds = feed.days.flatMap((day) => day.events).map((e) => e.kind);
    expect(kinds).toContain("TRAINING");
    expect(kinds).toContain("MATCH");
    expect(feed.summary.teamLabel).toBe("Junioren F2");
  });

  it("19. team filter does not leak away match", async () => {
    setupDefaultMocks([matchItem()]);
    mocks.eventFindMany.mockResolvedValue([
      {
        id: "event-match-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "AWAY",
        organizerName: null,
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: { id: "team-f2", slug: "junioren-f2", name: "Junioren F2", shortName: null, alternativeName: null, infoboardDisplayName: null, infoboardTrainingDisplayName: null, infoboardMatchDisplayName: null, infoboardTournamentDisplayName: null },
        opponentExternalClub: null,
        matchExternalMapping: null,
      },
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      teamSlug: "junioren-f2",
      now: NOW,
    });
    expect(feed.days.flatMap((day) => day.events).filter((e) => e.kind === "MATCH")).toHaveLength(0);
  });

  it("20. team filter does not leak external tournament", async () => {
    setupDefaultMocks([tournamentItem()], "2026-08-28");
    mocks.eventFindMany.mockResolvedValue([
      {
        id: "event-tournament-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "AWAY",
        organizerName: "External",
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: null,
        opponentExternalClub: null,
        matchExternalMapping: null,
      },
    ]);
    mocks.listTournamentsByIds.mockResolvedValue([
      {
        id: "event-tournament-1",
        organizerName: "External",
        organizerLogoUrl: null,
        organizerExternalClubId: null,
        participants: [
          {
            id: "p1",
            displayName: "Junioren F2",
            logoUrl: null,
            kind: "TEAM",
            team: { id: "team-f2", slug: "junioren-f2", name: "Junioren F2" },
            externalClub: null,
          },
        ],
      },
    ]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      teamSlug: "junioren-f2",
      now: NOW,
    });
    expect(feed.summary.tournamentCount).toBe(0);
  });

  it("21. tenant isolation on weekplanner call", async () => {
    await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(mocks.getWeekplannerWeek.mock.calls[0][0]).toBe(TENANT_ID);
  });

  it("22. passes linked weekplannerPlanId to getWeekplannerWeek for alternative plans", async () => {
    const altPlan = { ...ACTIVE_PLAN, id: "plan-alt", name: "Schlechtwetterplan", isDefault: false };
    mocks.getActiveWochenplanPlan.mockResolvedValue(altPlan);
    mocks.resolvePublicWeekplannerPlan.mockResolvedValue({
      weekplannerPlanId: "wp-alt-linked",
      activeWochenplanPlan: altPlan,
      usedStandardplanFallback: false,
    });

    await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });

    expect(mocks.getWeekplannerWeek.mock.calls[0][2]).toBe("wp-alt-linked");
  });

  it("23. weekplanner time and allocation overrides flow through to public events", async () => {
    const overriddenTraining = trainingItem({
      startAt: new Date("2026-08-26T18:00:00.000Z"),
      endAt: new Date("2026-08-26T19:00:00.000Z"),
      timeOverridden: true,
      pitchOverridden: true,
      pitchAllocations: [
        { facilityResourceId: "r-alt", code: "KR1", name: "Kunstrasen 1", facilityName: "Im Brüel" },
      ],
    });
    setupDefaultMocks([overriddenTraining]);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      now: NOW,
    });

    const training = feed.days
      .flatMap((day) => day.events)
      .find((event) => event.kind === "TRAINING");
    expect(training?.startAt).toEqual(new Date("2026-08-26T18:00:00.000Z"));
    expect(training?.pitch?.name).toBe("Kunstrasen 1");
  });
});

describe("public-feed-mapper sporting identity", () => {
  it("12. match canonical club identity/logo survives mapping", () => {
    const policy = {
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
      team: { id: "team-1", slug: "aktive-1", name: "1. Mannschaft", shortName: null, alternativeName: null, infoboardDisplayName: null, infoboardTrainingDisplayName: null, infoboardMatchDisplayName: null, infoboardTournamentDisplayName: null },
      opponentExternalClub: { name: "FC Gegner", shortName: null, alternativeName: null, logoUrl: "https://cdn.example/opp.png" },
      matchExternalMapping: null,
    };

    const identity = buildPublicMatchIdentity(policy, matchItem(), TENANT_NAME, "https://cdn.example/tenant.png");
    expect(identity.home.logoUrl).toBe("https://cdn.example/tenant.png");
    expect(identity.away.logoUrl).toBe("https://cdn.example/opp.png");
  });

  it("13–14. tournament organizer and participant logos survive mapping", () => {
    const mapped = mapTournamentToPublicEvent(
      tournamentItem(),
      {
        id: "event-tournament-1",
        status: "SCHEDULED",
        infoboardVisible: true,
        websiteVisible: true,
        trainingsplanVisible: false,
        homeAway: "HOME",
        organizerName: "FC Allschwil",
        competitionLabel: null,
        meetingTime: null,
        resultLabel: null,
        intermediateResultLabel: null,
        season: { key: "2026-27" },
        team: null,
        opponentExternalClub: null,
        matchExternalMapping: null,
      },
      {
        id: "event-tournament-1",
        organizerName: "FC Allschwil",
        organizerLogoUrl: "https://cdn.example/org.png",
        organizerExternalClubId: null,
        participants: [
          {
            id: "p1",
            displayName: "Junioren F2",
            logoUrl: "https://cdn.example/part.png",
            kind: "TEAM",
            team: { id: "team-f2", slug: "junioren-f2", name: "Junioren F2" },
            externalClub: null,
          },
        ],
      } as never,
      resolveTournamentTeamContext({
        id: "event-tournament-1",
        participants: [
          {
            id: "p1",
            displayName: "Junioren F2",
            logoUrl: "https://cdn.example/part.png",
            kind: "TEAM",
            team: { id: "team-f2", slug: "junioren-f2", name: "Junioren F2" },
          },
        ],
      } as never),
    );

    expect(mapped.organizer?.logoUrl).toBe("https://cdn.example/org.png");
    expect(mapped.participants?.[0]?.logoUrl).toBe("https://cdn.example/part.png");
  });

  it("15. canonical team identity exposed", () => {
    const mapped = mapTrainingToPublicEvent(
      trainingItem(),
      {
        id: "session-1",
        status: "SCHEDULED",
        teamSeason: {
          season: { key: "2026-27" },
          team: {
            id: "team-f2",
            slug: "junioren-f2",
            name: "Junioren F2",
            shortName: null,
            alternativeName: null,
            infoboardDisplayName: null,
            infoboardTrainingDisplayName: null,
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
        },
      },
      resolveTrainingTeamContext({
        id: "session-1",
        status: "SCHEDULED",
        teamSeason: {
          season: { key: "2026-27" },
          team: {
            id: "team-f2",
            slug: "junioren-f2",
            name: "Junioren F2",
            shortName: null,
            alternativeName: null,
            infoboardDisplayName: null,
            infoboardTrainingDisplayName: null,
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
        },
      }),
    );

    expect(mapped.team?.slug).toBe("junioren-f2");
    expect(mapped.team?.id).toBe("team-f2");
  });
});

describe("Infoboard shared HOME-match semantics unchanged", () => {
  it("24. Infoboard HOME match policy still matches shared helper", () => {
    const event = {
      tenantId: TENANT_ID,
      type: "MATCH",
      status: "SCHEDULED",
      infoboardVisible: true,
      websiteVisible: true,
      trainingsplanVisible: false,
      homeAway: "HOME",
    };
    const infoboard = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT_ID);
    const shared = evaluatePublication(
      { ...event, infoboardVisible: true },
      "INFOBOARD_SCREEN_1",
      TENANT_ID,
    );
    expect(infoboard).toEqual(shared);
    expect(infoboard.eligible).toBe(true);
  });
});

describe("matchesTeamSlug", () => {
  it("returns true when no filter is set", () => {
    expect(matchesTeamSlug({ primaryTeam: null, allTeams: [] }, null)).toBe(true);
  });

  it("matches canonical team slug", () => {
    const context = resolveMatchTeamContext({
      id: "e1",
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
      team: { id: "t1", slug: "junioren-f2", name: "F2", shortName: null, alternativeName: null, infoboardDisplayName: null, infoboardTrainingDisplayName: null, infoboardMatchDisplayName: null, infoboardTournamentDisplayName: null },
      opponentExternalClub: null,
      matchExternalMapping: null,
    });
    expect(matchesTeamSlug(context, "junioren-f2")).toBe(true);
    expect(matchesTeamSlug(context, "other")).toBe(false);
  });
});
