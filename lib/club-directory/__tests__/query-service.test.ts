import { describe, expect, it, vi } from "vitest";

import {
  CLUB_DIRECTORY_DEFAULT_LIMIT,
  CLUB_DIRECTORY_MAX_LIMIT,
  findExternalClubByProviderClubId,
  findExternalTeamByProviderIdentity,
  getExternalClubById,
  getExternalTeamById,
  listExternalClubs,
  listExternalTeams,
} from "../query-service";
import type { ClubDirectoryQueryDatabase } from "../query-service";

function createClubListRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "club-1",
    tenantId: "tenant-1",
    name: "SV Muttenz",
    shortName: "Muttenz",
    alternativeName: null,
    logoUrl: null,
    logoContrastMode: "NORMAL",
    source: "MANUAL",
    archivedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
    _count: { externalTeams: 0, providerMappings: 0 },
    ...overrides,
  };
}

function createClubDetailRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...createClubListRecord(),
    website: null,
    location: null,
    notes: null,
    providerMappings: [],
    externalTeams: [],
    ...overrides,
  };
}

function createTeamListRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    tenantId: "tenant-1",
    externalClubId: "club-1",
    name: "SV Muttenz B1",
    shortName: "B1",
    alternativeName: null,
    categoryLabel: null,
    logoUrl: null,
    source: "MANUAL",
    archivedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
    providerMappings: [],
    ...overrides,
  };
}

function createTeamDetailRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...createTeamListRecord(),
    externalClub: {
      id: "club-1",
      name: "SV Muttenz",
      shortName: "Muttenz",
      logoUrl: null,
      archivedAt: null,
    },
    ...overrides,
  };
}

function createDatabase(input?: {
  clubList?: ReturnType<typeof createClubListRecord>[];
  clubDetail?: ReturnType<typeof createClubDetailRecord> | null;
  teamList?: ReturnType<typeof createTeamListRecord>[];
  teamDetail?: ReturnType<typeof createTeamDetailRecord> | null;
}) {
  return {
    externalClub: {
      findMany: vi.fn().mockResolvedValue(input?.clubList ?? []),
      findFirst: vi.fn().mockResolvedValue(input?.clubDetail ?? null),
    },
    externalTeam: {
      findMany: vi.fn().mockResolvedValue(input?.teamList ?? []),
      findFirst: vi.fn().mockResolvedValue(input?.teamDetail ?? null),
    },
  } satisfies ClubDirectoryQueryDatabase;
}

describe("listExternalClubs", () => {
  it("scopes by tenantId, excludes archived by default, and orders by name", async () => {
    const database = createDatabase();
    await listExternalClubs(database, { tenantId: "tenant-1" });

    expect(database.externalClub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1", archivedAt: null }),
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: CLUB_DIRECTORY_DEFAULT_LIMIT,
        skip: 0,
      }),
    );
  });

  it("includes archived clubs when includeArchived is true", async () => {
    const database = createDatabase();
    await listExternalClubs(database, { tenantId: "tenant-1", includeArchived: true });

    const args = database.externalClub.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).not.toHaveProperty("archivedAt");
  });

  it("applies a case-insensitive search across name / shortName / alternativeName", async () => {
    const database = createDatabase();
    await listExternalClubs(database, { tenantId: "tenant-1", search: "  Muttenz  " });

    expect(database.externalClub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "Muttenz", mode: "insensitive" } },
            { shortName: { contains: "Muttenz", mode: "insensitive" } },
            { alternativeName: { contains: "Muttenz", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("maps teamCount and hasProviderMapping from _count", async () => {
    const database = createDatabase({
      clubList: [createClubListRecord({ _count: { externalTeams: 3, providerMappings: 1 } })],
    });
    const [club] = await listExternalClubs(database, { tenantId: "tenant-1" });
    expect(club.teamCount).toBe(3);
    expect(club.hasProviderMapping).toBe(true);
  });

  it("hasProviderMapping is false when there is no provider mapping (manual-only club)", async () => {
    const database = createDatabase({
      clubList: [createClubListRecord({ _count: { externalTeams: 0, providerMappings: 0 } })],
    });
    const [club] = await listExternalClubs(database, { tenantId: "tenant-1" });
    expect(club.hasProviderMapping).toBe(false);
  });

  it("rejects an empty tenantId without querying the database", async () => {
    const database = createDatabase();
    await expect(listExternalClubs(database, { tenantId: " " })).rejects.toThrow(
      "tenantId is required.",
    );
    expect(database.externalClub.findMany).not.toHaveBeenCalled();
  });

  it("rejects a limit above the maximum", async () => {
    const database = createDatabase();
    await expect(
      listExternalClubs(database, { tenantId: "tenant-1", limit: CLUB_DIRECTORY_MAX_LIMIT + 1 }),
    ).rejects.toThrow(`Club directory limit must be between 1 and ${CLUB_DIRECTORY_MAX_LIMIT}.`);
  });

  // MASTERDATA-SELECTOR-CONSISTENCY-03 (BUG 2) — TournamentCenter external
  // club picker root-cause tests. The underlying query itself was already
  // correct (queries ExternalClub directly, never via ExternalTeam); the
  // defect was a client that always fetched with the un-searched default
  // limit. These tests pin the query-service behavior the search-driven
  // picker now relies on.

  // 10. club with zero ExternalTeams is searchable
  it("10. a club with zero ExternalTeams is still returned (never derived from/gated by ExternalTeam rows)", async () => {
    const database = createDatabase({
      clubList: [createClubListRecord({ id: "club-no-teams", _count: { externalTeams: 0, providerMappings: 0 } })],
    });

    const clubs = await listExternalClubs(database, { tenantId: "tenant-1", search: "Muttenz" });

    expect(clubs).toHaveLength(1);
    expect(clubs[0].id).toBe("club-no-teams");
    expect(clubs[0].teamCount).toBe(0);
  });

  // 11. club with multiple ExternalTeams appears once
  it("11. a club with multiple ExternalTeams still appears exactly once", async () => {
    const database = createDatabase({
      clubList: [createClubListRecord({ id: "club-many-teams", _count: { externalTeams: 12, providerMappings: 1 } })],
    });

    const clubs = await listExternalClubs(database, { tenantId: "tenant-1" });

    expect(clubs).toHaveLength(1);
    expect(clubs[0].id).toBe("club-many-teams");
  });

  // 9 / 14. eligible club beyond the previous 50-item default cap is
  // retrievable, and passing an explicit higher (but still bounded) limit
  // never throws or silently truncates further than requested.
  it("9/14. an explicit limit up to the maximum retrieves clubs beyond the old un-searched default (50)", async () => {
    const database = createDatabase();
    await listExternalClubs(database, { tenantId: "tenant-1", limit: CLUB_DIRECTORY_MAX_LIMIT, skip: 0 });

    expect(database.externalClub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: CLUB_DIRECTORY_MAX_LIMIT, skip: 0 }),
    );
  });

  // 15. tenant isolation
  it("15. only queries the requesting tenant — cross-tenant clubs cannot leak into search results", async () => {
    const database = createDatabase();
    await listExternalClubs(database, { tenantId: "tenant-a", search: "ro" });

    const args = database.externalClub.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where.tenantId).toBe("tenant-a");
  });

  // 16. archived/ineligible club excluded
  it("16. archived clubs are excluded from search results by default (same eligibility as /dashboard/vereine)", async () => {
    const database = createDatabase();
    await listExternalClubs(database, { tenantId: "tenant-1", search: "ro" });

    const args = database.externalClub.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where.archivedAt).toBeNull();
  });

  it("orders results alphabetically by name (sensible alphabetical order for the picker)", async () => {
    const database = createDatabase();
    await listExternalClubs(database, { tenantId: "tenant-1", search: "ro" });

    expect(database.externalClub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ name: "asc" }, { id: "asc" }] }),
    );
  });
});

describe("getExternalClubById — tenant isolation", () => {
  it("queries scoped by both id and tenantId", async () => {
    const database = createDatabase({ clubDetail: createClubDetailRecord() });
    await getExternalClubById(database, { tenantId: "tenant-1", id: "club-1" });

    expect(database.externalClub.findFirst).toHaveBeenCalledWith({
      where: { id: "club-1", tenantId: "tenant-1" },
    });
  });

  it("returns null when the club belongs to a different tenant (findFirst scoped query returns null)", async () => {
    const database = createDatabase({ clubDetail: null });
    const result = await getExternalClubById(database, { tenantId: "tenant-2", id: "club-1" });
    expect(result).toBeNull();
  });

  it("maps nested externalTeams to teams[] with their own provider mappings", async () => {
    const database = createDatabase({
      clubDetail: createClubDetailRecord({
        externalTeams: [
          createTeamListRecord({
            providerMappings: [
              {
                id: "map-1",
                provider: "SFV",
                providerTeamId: 999,
                providerSeasonId: 0,
                providerTeamName: "SV Muttenz B1",
                providerClubId: 483,
                providerOrganisationId: null,
                providerLogoUrl: null,
                providerLeagueName: null,
                providerGroupName: null,
                providerIsActive: true,
                lastSyncedAt: null,
              },
            ],
          }),
        ],
      }),
    });

    const club = await getExternalClubById(database, { tenantId: "tenant-1", id: "club-1" });
    expect(club?.teams).toHaveLength(1);
    expect(club?.teams[0]?.providerMappings[0]?.provider).toBe("SFV");
  });

  it("serializes logoContrastMode and normalizes unknown persisted values to NORMAL", async () => {
    const database = createDatabase({
      clubDetail: createClubDetailRecord({ logoContrastMode: "INVERT_ON_DARK" }),
    });
    const inverted = await getExternalClubById(database, { tenantId: "tenant-1", id: "club-1" });
    expect(inverted?.logoContrastMode).toBe("INVERT_ON_DARK");

    const unknownDatabase = createDatabase({
      clubDetail: createClubDetailRecord({ logoContrastMode: "legacy" }),
    });
    const normalized = await getExternalClubById(unknownDatabase, {
      tenantId: "tenant-1",
      id: "club-1",
    });
    expect(normalized?.logoContrastMode).toBe("NORMAL");
  });

  it("CLUB-DIRECTORY-04: distinguishes multiple identically-named teams under one club by real sporting context", async () => {
    const database = createDatabase({
      clubDetail: createClubDetailRecord({
        name: "AC Rossoneri",
        externalTeams: [
          createTeamListRecord({
            id: "team-1",
            name: "AC Rossoneri",
            providerMappings: [
              {
                id: "map-1",
                provider: "SFV",
                providerTeamId: 4001,
                providerSeasonId: 0,
                providerTeamName: "AC Rossoneri",
                providerClubId: 111,
                providerOrganisationId: null,
                providerLogoUrl: null,
                providerLeagueName: "3. Liga",
                providerGroupName: "Gruppe 1",
                providerIsActive: true,
                lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
              },
            ],
          }),
          createTeamListRecord({
            id: "team-2",
            name: "AC Rossoneri",
            providerMappings: [
              {
                id: "map-2",
                provider: "SFV",
                providerTeamId: 4002,
                providerSeasonId: 0,
                providerTeamName: "AC Rossoneri",
                providerClubId: 111,
                providerOrganisationId: null,
                providerLogoUrl: null,
                providerLeagueName: "Senioren 30+",
                providerGroupName: "Gruppe 2",
                providerIsActive: true,
                lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
              },
            ],
          }),
          createTeamListRecord({
            id: "team-3",
            name: "AC Rossoneri",
            providerMappings: [
              {
                id: "map-3",
                provider: "SFV",
                providerTeamId: 4003,
                providerSeasonId: 0,
                providerTeamName: "AC Rossoneri",
                providerClubId: 111,
                providerOrganisationId: null,
                providerLogoUrl: null,
                providerLeagueName: null,
                providerGroupName: null,
                providerIsActive: true,
                lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
              },
            ],
          }),
        ],
      }),
    });

    const club = await getExternalClubById(database, { tenantId: "tenant-1", id: "club-1" });
    expect(club?.teams.map((t) => t.name)).toEqual([
      "AC Rossoneri",
      "AC Rossoneri",
      "AC Rossoneri",
    ]);

    expect(club?.teams[0]?.competitionContext).toEqual({
      leagueName: "3. Liga",
      groupName: "Gruppe 1",
    });
    expect(club?.teams[1]?.competitionContext).toEqual({
      leagueName: "Senioren 30+",
      groupName: "Gruppe 2",
    });
    // Team 3 has a provider mapping but no reported sporting context yet —
    // graceful "no context" rather than any fabricated or technical-id value.
    expect(club?.teams[2]?.competitionContext).toEqual({ leagueName: null, groupName: null });

    // Every distinguishable team's context is genuinely distinct, and the
    // raw provider Team-ID is present only inside providerMappings (for
    // internal identity/sync use) — never inside competitionContext.
    const contexts = club?.teams.map((t) => JSON.stringify(t.competitionContext)) ?? [];
    expect(new Set(contexts.filter((c) => c !== JSON.stringify({ leagueName: null, groupName: null }))).size).toBe(2);
    for (const team of club?.teams ?? []) {
      expect(JSON.stringify(team.competitionContext)).not.toContain("4001");
      expect(JSON.stringify(team.competitionContext)).not.toContain("4002");
      expect(JSON.stringify(team.competitionContext)).not.toContain("4003");
    }
  });
});

describe("listExternalTeams", () => {
  it("filters by externalClubId when provided — team belongs to correct club", async () => {
    const database = createDatabase();
    await listExternalTeams(database, { tenantId: "tenant-1", externalClubId: "club-1" });

    expect(database.externalTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1", externalClubId: "club-1" }),
      }),
    );
  });

  it("excludes archived teams by default", async () => {
    const database = createDatabase();
    await listExternalTeams(database, { tenantId: "tenant-1" });

    expect(database.externalTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ archivedAt: null }) }),
    );
  });
});

describe("getExternalTeamById", () => {
  it("returns the team with its externalClub reference", async () => {
    const database = createDatabase({ teamDetail: createTeamDetailRecord() });
    const team = await getExternalTeamById(database, { tenantId: "tenant-1", id: "team-1" });

    expect(team?.externalClub.id).toBe("club-1");
    expect(team?.externalClubId).toBe("club-1");
  });

  it("CLUB-DIRECTORY-04: includes the resolved competitionContext from its provider mapping", async () => {
    const database = createDatabase({
      teamDetail: createTeamDetailRecord({
        providerMappings: [
          {
            id: "map-1",
            provider: "SFV",
            providerTeamId: 51234,
            providerSeasonId: 0,
            providerTeamName: "AC Rossoneri",
            providerClubId: 111,
            providerOrganisationId: null,
            providerLogoUrl: null,
            providerLeagueName: "3. Liga",
            providerGroupName: "Gruppe 1",
            providerIsActive: true,
            lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      }),
    });

    const team = await getExternalTeamById(database, { tenantId: "tenant-1", id: "team-1" });
    expect(team?.competitionContext).toEqual({ leagueName: "3. Liga", groupName: "Gruppe 1" });
  });

  it("CLUB-DIRECTORY-04: returns an all-null competitionContext when there is no provider mapping (manual team)", async () => {
    const database = createDatabase({ teamDetail: createTeamDetailRecord({ providerMappings: [] }) });

    const team = await getExternalTeamById(database, { tenantId: "tenant-1", id: "team-1" });
    expect(team?.competitionContext).toEqual({ leagueName: null, groupName: null });
  });
});

describe("findExternalTeamByProviderIdentity — Matchcenter/TournamentCenter forward hook", () => {
  it("resolves via provider + providerTeamId, uppercasing the provider", async () => {
    const database = createDatabase({ teamDetail: createTeamDetailRecord() });

    await findExternalTeamByProviderIdentity(database, {
      tenantId: "tenant-1",
      provider: "sfv",
      providerTeamId: 51234,
    });

    expect(database.externalTeam.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        providerMappings: { some: { provider: "SFV", providerTeamId: 51234 } },
      },
    });
  });

  it("returns null when no ExternalTeam is linked to that provider identity — provider-only opponent display keeps working", async () => {
    const database = createDatabase({ teamDetail: null });

    const result = await findExternalTeamByProviderIdentity(database, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 999999,
    });

    expect(result).toBeNull();
  });

  it("rejects a non-positive providerTeamId", async () => {
    const database = createDatabase();
    await expect(
      findExternalTeamByProviderIdentity(database, {
        tenantId: "tenant-1",
        provider: "SFV",
        providerTeamId: 0,
      }),
    ).rejects.toThrow("providerTeamId must be a positive integer.");
  });
});

describe("findExternalClubByProviderClubId — CLUB-DIRECTORY-02C logo-completeness hook", () => {
  it("resolves via provider + providerClubId, uppercasing the provider", async () => {
    const database = createDatabase({
      clubDetail: createClubDetailRecord({ id: "club-1", logoUrl: null, externalTeams: [] }),
    });

    await findExternalClubByProviderClubId(database, {
      tenantId: "tenant-1",
      provider: "sfv",
      providerClubId: 700,
    });

    expect(database.externalClub.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        providerMappings: { some: { provider: "SFV", providerClubId: 700 } },
      },
    });
  });

  it("returns null when no ExternalClub has this provider club identity yet", async () => {
    const database = createDatabase({ clubDetail: null });

    const result = await findExternalClubByProviderClubId(database, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerClubId: 700,
    });

    expect(result).toBeNull();
  });

  it("collects distinct provider teamIds across every ExternalTeam under the club, sorted ascending", async () => {
    const database = createDatabase({
      clubDetail: createClubDetailRecord({
        id: "club-1",
        logoUrl: null,
        externalTeams: [
          createTeamListRecord({
            id: "team-1",
            providerMappings: [{ provider: "SFV", providerTeamId: 2002 }],
          }),
          createTeamListRecord({
            id: "team-2",
            providerMappings: [
              { provider: "SFV", providerTeamId: 2001 },
              // Duplicate providerTeamId across seasons — must be deduplicated.
              { provider: "SFV", providerTeamId: 2001 },
            ],
          }),
          // A different provider's mapping must never be mixed in.
          createTeamListRecord({
            id: "team-3",
            providerMappings: [{ provider: "OTHERPROVIDER", providerTeamId: 999 }],
          }),
        ],
      }),
    });

    const result = await findExternalClubByProviderClubId(database, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerClubId: 700,
    });

    expect(result?.linkedProviderTeamIds).toEqual([2001, 2002]);
  });

  it("returns the club's current logoUrl and archivedAt", async () => {
    const database = createDatabase({
      clubDetail: createClubDetailRecord({
        id: "club-1",
        logoUrl: "https://cdn.example.com/crest.png",
        archivedAt: null,
        externalTeams: [],
      }),
    });

    const result = await findExternalClubByProviderClubId(database, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerClubId: 700,
    });

    expect(result).toMatchObject({
      id: "club-1",
      logoUrl: "https://cdn.example.com/crest.png",
      archivedAt: null,
    });
  });

  it("rejects a non-positive providerClubId", async () => {
    const database = createDatabase();
    await expect(
      findExternalClubByProviderClubId(database, {
        tenantId: "tenant-1",
        provider: "SFV",
        providerClubId: 0,
      }),
    ).rejects.toThrow("providerClubId must be a positive integer.");
  });
});
