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
    seasonId: "season-2026-2027",
    teamId: "team-own",
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
      shortName: "E1",
      alternativeName: "Junioren E1",
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
        shortName: "E1",
        alternativeName: "Junioren E1",
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

  it("prefers the canonical Club Directory ExternalTeam name/logo over the raw provider name for an external opponent", async () => {
    const database = createDatabase({
      list: [
        createEvent({
          matchExternalMapping: {
            ...createEvent().matchExternalMapping,
            awayTeam: null,
            awayExternalTeam: {
              id: "ext-team-1",
              name: "SV Muttenz Erste Mannschaft",
              shortName: "1M",
              alternativeName: null,
              logoUrl: null,
              externalClub: { id: "ext-club-1", logoUrl: "https://cdn.example.com/crest.png" },
            },
          },
        }),
      ],
    });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    // Canonical ExternalTeam name wins over the raw providerTeamName ("Provider Away").
    expect(result[0].away).toEqual(
      expect.objectContaining({
        canonicalTeamId: null, // never conflated with the tenant Team identity
        canonicalExternalTeamId: "ext-team-1",
        canonicalExternalClubId: "ext-club-1",
        canonicalExternalTeamName: "SV Muttenz Erste Mannschaft",
        canonicalExternalTeamShortName: "1M",
        displayName: "SV Muttenz Erste Mannschaft",
        // Team-level logo unset — falls back to the parent club's crest.
        externalLogoUrl: "https://cdn.example.com/crest.png",
        isOwnTeam: false,
      }),
    );
  });

  it("CLUB-DIRECTORY-02B: resolves a SFV-enriched data: URI club crest the same as any other logoUrl value", async () => {
    // resolveProviderLogoDataUri (lib/integrations/sfv/sync/team-logo.ts)
    // persists SFV-discovered crests as `data:` URIs into
    // ExternalClub.logoUrl, since SFV has no stable logo URL to store
    // verbatim (see that module's doc comment). Matchcenter must resolve
    // this exactly like any other logoUrl string — no special-casing.
    const dataUriLogo = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    const database = createDatabase({
      list: [
        createEvent({
          matchExternalMapping: {
            ...createEvent().matchExternalMapping,
            awayTeam: null,
            awayExternalTeam: {
              id: "ext-team-1",
              name: "SV Muttenz Erste Mannschaft",
              shortName: "1M",
              alternativeName: null,
              logoUrl: null,
              externalClub: { id: "ext-club-1", logoUrl: dataUriLogo },
            },
          },
        }),
      ],
    });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result[0].away).toEqual(
      expect.objectContaining({
        canonicalExternalTeamId: "ext-team-1",
        canonicalExternalClubId: "ext-club-1",
        externalLogoUrl: dataUriLogo,
      }),
    );
  });

  it("falls back to the raw provider name when no canonical ExternalTeam is linked yet", async () => {
    const database = createDatabase({
      list: [createEvent()], // fixture's away side has no homeExternalTeam/awayExternalTeam
    });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result[0].away).toEqual(
      expect.objectContaining({
        canonicalExternalTeamId: null,
        canonicalExternalTeamName: null,
        externalLogoUrl: null,
        displayName: "Provider Away",
      }),
    );
  });

  it("never treats the resolved tenant own-team side as an external opponent", async () => {
    const database = createDatabase({ list: [createEvent()] });

    const result = await listMatchcenterMatches(database, {
      tenantId: "tenant-1",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result[0].home.isOwnTeam).toBe(true);
    expect(result[0].home.canonicalExternalTeamId).toBeNull();
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

  describe("TEAM-IDENTITY-01 canonical naming integration", () => {
    it("M. selects Team.shortName and Team.alternativeName from the database and exposes them on the resolved side", async () => {
      const database = createDatabase({ list: [createEvent()] });

      const result = await listMatchcenterMatches(database, {
        tenantId: "tenant-1",
        from: new Date("2026-08-01T00:00:00.000Z"),
        to: new Date("2026-09-01T00:00:00.000Z"),
      });

      expect(result[0].home.canonicalTeamShortName).toBe("E1");
      expect(result[0].home.canonicalTeamAlternativeName).toBe(
        "Junioren E1",
      );

      expect(database.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            team: expect.objectContaining({
              select: expect.objectContaining({
                shortName: true,
                alternativeName: true,
              }),
            }),
            matchExternalMapping: expect.objectContaining({
              include: expect.objectContaining({
                homeTeam: expect.objectContaining({
                  select: expect.objectContaining({
                    shortName: true,
                    alternativeName: true,
                  }),
                }),
              }),
            }),
          }),
        }),
      );
    });

    it("falls back to Team.alternativeName in the long resolver when Team.name is blank", async () => {
      const database = createDatabase({
        list: [
          createEvent({
            matchExternalMapping: {
              ...createEvent().matchExternalMapping,
              homeTeam: {
                id: "team-own",
                name: "   ",
                shortName: null,
                alternativeName: "Junioren E1",
              },
            },
          }),
        ],
      });

      const result = await listMatchcenterMatches(database, {
        tenantId: "tenant-1",
        from: new Date("2026-08-01T00:00:00.000Z"),
        to: new Date("2026-09-01T00:00:00.000Z"),
      });

      expect(result[0].home.displayName).toBe("Junioren E1");
    });

    it("does not overwrite the tenant-managed name with the provider name when both exist", async () => {
      const database = createDatabase({ list: [createEvent()] });

      const result = await listMatchcenterMatches(database, {
        tenantId: "tenant-1",
        from: new Date("2026-08-01T00:00:00.000Z"),
        to: new Date("2026-09-01T00:00:00.000Z"),
      });

      // homeTeam.name = "FC Allschwil E1", providerHomeTeamName = "Provider Home"
      expect(result[0].home.displayName).toBe("FC Allschwil E1");
    });
  });
});
