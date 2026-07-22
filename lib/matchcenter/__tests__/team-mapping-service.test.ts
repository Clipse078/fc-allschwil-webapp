import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  assignMatchcenterTeamMapping,
  MatchcenterTeamMappingNotFoundError,
  MatchcenterTeamMappingValidationError,
  type MatchcenterTeamMappingDatabase,
} from "../team-mapping-service";

function createDatabase(input?: {
  team?: {
    id: string;
    tenantId: string | null;
    isActive: boolean;
  } | null;
  existing?: {
    id: string;
    teamId: string;
  } | null;
}) {
  const record = {
    id: "mapping-1",
    tenantId: "tenant-1",
    teamId: "team-1",
    provider: "SFV",
    externalTeamId: 31927,
    externalSeasonId: 2027,
    providerTeamName: "FC Allschwil E1",
    providerIsActive: true,
    lastSyncedAt: new Date(
      "2026-07-22T18:00:00.000Z",
    ),
  };

  return {
    team: {
      findFirst: vi.fn().mockResolvedValue(
        input?.team === undefined
          ? {
              id: "team-1",
              tenantId: "tenant-1",
              isActive: true,
            }
          : input.team,
      ),
    },
    teamExternalMapping: {
      findUnique: vi.fn().mockResolvedValue(
        input?.existing ?? null,
      ),
      create: vi.fn().mockResolvedValue(record),
      update: vi.fn().mockResolvedValue(record),
    },
  } satisfies MatchcenterTeamMappingDatabase;
}

describe("Matchcenter team mapping service", () => {
  it("creates a tenant-scoped mapping", async () => {
    const database = createDatabase();
    const now = new Date("2026-07-22T18:00:00.000Z");

    await assignMatchcenterTeamMapping(
      database,
      {
        tenantId: "tenant-1",
        provider: "sfv",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
        providerTeamName: "FC Allschwil E1",
      },
      now,
    );

    expect(database.team.findFirst).toHaveBeenCalledWith({
      where: {
        id: "team-1",
        tenantId: "tenant-1",
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        isActive: true,
      },
    });

    expect(
      database.teamExternalMapping.create,
    ).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
        providerTeamName: "FC Allschwil E1",
        providerIsActive: true,
        lastSyncedAt: now,
      },
    });

    expect(
      database.teamExternalMapping.update,
    ).not.toHaveBeenCalled();
  });

  it("updates an existing provider mapping", async () => {
    const database = createDatabase({
      existing: {
        id: "mapping-existing",
        teamId: "team-old",
      },
    });

    await assignMatchcenterTeamMapping(database, {
      tenantId: "tenant-1",
      provider: "SFV",
      externalTeamId: 31927,
      externalSeasonId: 2027,
      teamId: "team-1",
      providerTeamName: "FC Allschwil E1",
    });

    expect(
      database.teamExternalMapping.update,
    ).toHaveBeenCalledWith({
      where: {
        id: "mapping-existing",
      },
      data: expect.objectContaining({
        teamId: "team-1",
        providerTeamName: "FC Allschwil E1",
        providerIsActive: true,
        lastSyncedAt: expect.any(Date),
      }),
    });

    expect(
      database.teamExternalMapping.create,
    ).not.toHaveBeenCalled();
  });

  it("rejects a team outside the tenant", async () => {
    const database = createDatabase({
      team: null,
    });

    await expect(
      assignMatchcenterTeamMapping(database, {
        tenantId: "tenant-1",
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-other-tenant",
      }),
    ).rejects.toBeInstanceOf(
      MatchcenterTeamMappingNotFoundError,
    );

    expect(
      database.teamExternalMapping.findUnique,
    ).not.toHaveBeenCalled();
  });

  it("rejects empty identifiers", async () => {
    const database = createDatabase();

    await expect(
      assignMatchcenterTeamMapping(database, {
        tenantId: " ",
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    ).rejects.toBeInstanceOf(
      MatchcenterTeamMappingValidationError,
    );
  });

  it("rejects invalid provider identifiers", async () => {
    const database = createDatabase();

    await expect(
      assignMatchcenterTeamMapping(database, {
        tenantId: "tenant-1",
        provider: "",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    ).rejects.toThrow("provider is required.");
  });

  it("rejects invalid external numeric identifiers", async () => {
    const database = createDatabase();

    await expect(
      assignMatchcenterTeamMapping(database, {
        tenantId: "tenant-1",
        provider: "SFV",
        externalTeamId: 0,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    ).rejects.toThrow(
      "externalTeamId must be a positive integer.",
    );

    await expect(
      assignMatchcenterTeamMapping(database, {
        tenantId: "tenant-1",
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027.5,
        teamId: "team-1",
      }),
    ).rejects.toThrow(
      "externalSeasonId must be a positive integer.",
    );
  });

  it("does not allow inactive tenant teams", async () => {
    const database = createDatabase({
      team: null,
    });

    await expect(
      assignMatchcenterTeamMapping(database, {
        tenantId: "tenant-1",
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "inactive-team",
      }),
    ).rejects.toThrow("Active tenant team not found.");
  });
});