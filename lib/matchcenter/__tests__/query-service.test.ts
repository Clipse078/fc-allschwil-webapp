import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getMatchcenterMatchDetail,
  listMatchcenterMatches,
  MATCHCENTER_DEFAULT_LIMIT,
} from "../query-service";
import type {
  MatchcenterQueryDatabase,
} from "../query-service";

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    tenantId: "tenant-1",
    type: "MATCH",
    source: "SFV",
    status: "SCHEDULED",
    reviewStage: "DRAFT",
    reviewRequestedAt: null,
    reviewedAt: null,
    publishedAt: null,
    reviewNotes: null,
    title: "FC Allschwil - Opponent",
    description: null,
    location: "Im Brüel",
    startAt: new Date("2026-08-20T18:00:00.000Z"),
    endAt: null,
    externalSource: "SFV",
    externalSourceId: "9001",
    lastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
    opponentName: "Opponent FC",
    organizerName: null,
    competitionLabel: "Junioren E",
    homeAway: "HOME",
    resultLabel: null,
    intermediateResultLabel: null,
    meetingTime: new Date("2026-08-20T17:00:00.000Z"),
    websiteVisible: true,
    infoboardVisible: false,
    homepageVisible: false,
    wochenplanVisible: true,
    trainingsplanVisible: false,
    teamPageVisible: true,
    remarks: "Bring match balls",
    pitchCode: "KR2",
    homeDressingRoomCode: "G1",
    awayDressingRoomCode: "G2",
    team: {
      id: "team-own",
      name: "FC Allschwil E1",
    },
    matchExternalMapping: {
      provider: "SFV",
      externalMatchId: 9001,
      externalSeasonId: 2027,
      matchNumber: 12345,
      providerHomeTeamId: 100,
      providerAwayTeamId: 200,
      providerHomeTeamName: "Provider Home",
      providerAwayTeamName: "Provider Away",
      homeTeamId: "team-own",
      awayTeamId: null,
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
      scoreHome: null,
      scoreAway: null,
      providerLeagueId: 10,
      providerLeagueName: "League",
      providerDivisionId: 20,
      providerDivisionName: "Division",
      providerRoundNbr: 3,
      providerOrganisationId: 30,
      providerPlaygroundId: 40,
      providerVenueName: "Im Brüel",
      providerSeasonName: "2026/2027",
      lastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
      detailSyncedAt: new Date("2026-07-20T10:05:00.000Z"),
      homeTeam: {
        id: "team-own",
        name: "FC Allschwil E1",
      },
      awayTeam: null,
    },
    ...overrides,
  };
}

function createDatabase(input?: {
  list?: ReturnType<typeof createEvent>[];
  detail?: ReturnType<typeof createEvent> | null;
}) {
  return {
    event: {
      findMany: vi.fn().mockResolvedValue(input?.list ?? []),
      findFirst: vi.fn().mockResolvedValue(input?.detail ?? null),
    },
  } satisfies MatchcenterQueryDatabase;
}

describe("Matchcenter query service", () => {
  it("creates a tenant-scoped, match-only, bounded list query", async () => {
    const database = createDatabase();

    await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      now: new Date("2026-07-22T12:00:00.000Z"),
    });

    expect(database.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          type: "MATCH",
          startAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
        orderBy: [
          {
            startAt: "asc",
          },
          {
            id: "asc",
          },
        ],
        take: MATCHCENTER_DEFAULT_LIMIT,
      }),
    );
  });

  it("passes an explicit date window and limit to Prisma", async () => {
    const database = createDatabase();
    const from = new Date("2026-08-01T00:00:00.000Z");
    const to = new Date("2026-09-01T00:00:00.000Z");

    await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from,
      to,
      limit: 25,
    });

    expect(database.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startAt: {
            gte: from,
            lte: to,
          },
        }),
        take: 25,
      }),
    );
  });

  it("prefers the canonical Team name over the provider name", async () => {
    const database = createDatabase({
      list: [createEvent()],
    });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result[0].home).toEqual(
      expect.objectContaining({
        canonicalTeamId: "team-own",
        canonicalTeamName: "FC Allschwil E1",
        displayName: "FC Allschwil E1",
        resolution: "RESOLVED",
        isOwnTeam: true,
      }),
    );
  });

  it("uses the provider team name when no canonical Team is resolved", async () => {
    const database = createDatabase({
      list: [createEvent()],
    });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result[0].away).toEqual(
      expect.objectContaining({
        canonicalTeamId: null,
        providerTeamName: "Provider Away",
        displayName: "Provider Away",
        resolution: "UNRESOLVED",
        isOwnTeam: false,
      }),
    );
  });

  it("handles a missing external mapping safely", async () => {
    const database = createDatabase({
      list: [
        createEvent({
          matchExternalMapping: null,
        }),
      ],
    });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result[0].source.provider).toBeNull();
    expect(result[0].home.displayName).toBe("FC Allschwil E1");
    expect(result[0].away.displayName).toBe("Opponent FC");
  });

  it("returns operational fields without modification", async () => {
    const database = createDatabase({
      list: [createEvent()],
    });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result[0].operational).toEqual({
      pitchCode: "KR2",
      homeDressingRoomCode: "G1",
      awayDressingRoomCode: "G2",
      meetingTime: new Date("2026-08-20T17:00:00.000Z"),
      remarks: "Bring match balls",
    });
  });

  it("returns synchronization fields from Event and mapping", async () => {
    const database = createDatabase({
      list: [createEvent()],
    });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result[0].synchronization).toEqual({
      eventLastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
      mappingLastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
      detailSyncedAt: new Date("2026-07-20T10:05:00.000Z"),
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
    });
  });

  it("uses tenantId, eventId and MATCH in the detail query", async () => {
    const database = createDatabase({
      detail: createEvent(),
    });

    await getMatchcenterMatchDetail(database, {
      tenantId: "tenant-1",
      eventId: "event-1",
    });

    expect(database.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "event-1",
          tenantId: "tenant-1",
          type: "MATCH",
        },
      }),
    );
  });

  it("returns null when the detail query cannot access the event", async () => {
    const database = createDatabase({
      detail: null,
    });

    await expect(
      getMatchcenterMatchDetail(database, {
        tenantId: "tenant-2",
        eventId: "event-1",
      }),
    ).resolves.toBeNull();
  });

  it("rejects an excessive date window", async () => {
    const database = createDatabase();

    await expect(
      listMatchcenterMatches(database, {
        tenantId: "tenant-1",
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2027-02-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow(
      "Matchcenter date range cannot exceed 366 days.",
    );

    expect(database.event.findMany).not.toHaveBeenCalled();
  });

  it("rejects empty tenant and event identifiers", async () => {
    const database = createDatabase();

    await expect(
      listMatchcenterMatches(database, {
        tenantId: " ",
      }),
    ).rejects.toThrow("tenantId is required.");

    await expect(
      getMatchcenterMatchDetail(database, {
        tenantId: "tenant-1",
        eventId: "",
      }),
    ).rejects.toThrow("eventId is required.");
  });

  it("does not mutate returned database records", async () => {
    const event = createEvent();
    const originalTitle = event.title;
    const originalProviderName =
      event.matchExternalMapping.providerAwayTeamName;

    const database = createDatabase({
      list: [event],
    });

    await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(event.title).toBe(originalTitle);
    expect(
      event.matchExternalMapping.providerAwayTeamName,
    ).toBe(originalProviderName);
  });
});
