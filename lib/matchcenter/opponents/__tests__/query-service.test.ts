import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getOpponentById,
  listOpponents,
  OPPONENT_DEFAULT_LIMIT,
  OPPONENT_MAX_LIMIT,
} from "../query-service";
import type {
  OpponentQueryDatabase,
} from "../query-service";

function createOpponent(overrides: Record<string, unknown> = {}) {
  return {
    id: "opponent-1",
    tenantId: "tenant-1",
    officialName: "FC Basel 1893",
    shortName: "FC Basel",
    websiteName: "Basel",
    infoboardName: "FCB",
    notes: null,
    archivedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
    externalMappings: [],
    ...overrides,
  };
}

function createMapping(overrides: Record<string, unknown> = {}) {
  return {
    id: "mapping-1",
    provider: "SFV",
    externalTeamId: 12345,
    externalSeasonId: 2027,
    providerTeamName: "FC Basel 1893",
    providerOrganisationId: 100,
    providerLogoUrl: "https://cdn.sfv.ch/logos/12345.png",
    providerIsActive: true,
    lastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
    ...overrides,
  };
}

function createDatabase(input?: {
  list?: ReturnType<typeof createOpponent>[];
  detail?: ReturnType<typeof createOpponent> | null;
}) {
  return {
    opponent: {
      findMany: vi.fn().mockResolvedValue(input?.list ?? []),
      findFirst: vi.fn().mockResolvedValue(input?.detail ?? null),
    },
  } satisfies OpponentQueryDatabase;
}

describe("Opponent query service", () => {
  describe("listOpponents", () => {
    it("creates a tenant-scoped bounded list query with the default limit", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
      });

      expect(database.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "tenant-1",
          }),
          take: OPPONENT_DEFAULT_LIMIT,
          skip: 0,
        }),
      );
    });

    it("passes explicit limit and skip to the database", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
        limit: 25,
        skip: 10,
      });

      expect(database.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 10,
        }),
      );
    });

    it("includes externalMappings in the query", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
      });

      expect(database.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            externalMappings: true,
          }),
        }),
      );
    });

    it("orders by officialName asc with id as deterministic tiebreaker", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
      });

      expect(database.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { officialName: "asc" },
            { id: "asc" },
          ],
        }),
      );
    });

    it("excludes archived opponents by default", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
      });

      expect(database.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archivedAt: null,
          }),
        }),
      );
    });

    it("includes archived opponents when includeArchived is true", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
        includeArchived: true,
      });

      const callArgs = database.opponent.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };

      expect(callArgs.where).not.toHaveProperty("archivedAt");
    });

    it("applies a case-insensitive search filter over officialName and shortName", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
        search: "  Basel  ",
      });

      expect(database.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                officialName: {
                  contains: "Basel",
                  mode: "insensitive",
                },
              },
              {
                shortName: {
                  contains: "Basel",
                  mode: "insensitive",
                },
              },
            ],
          }),
        }),
      );
    });

    it("does not apply a search filter when search is blank", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
        search: "   ",
      });

      const callArgs = database.opponent.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };

      expect(callArgs.where).not.toHaveProperty("OR");
    });

    it("applies a provider filter as a relation some clause, normalised to uppercase", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
        provider: "sfv",
      });

      expect(database.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            externalMappings: {
              some: { provider: "SFV" },
            },
          }),
        }),
      );
    });

    it("does not apply a provider filter when provider is blank", async () => {
      const database = createDatabase();

      await listOpponents(database, {
        tenantId: "tenant-1",
        provider: "   ",
      });

      const callArgs = database.opponent.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };

      expect(callArgs.where).not.toHaveProperty("externalMappings");
    });

    it("maps database records to OpponentDto with all fields", async () => {
      const mapping = createMapping();
      const opponent = createOpponent({
        externalMappings: [mapping],
      });
      const database = createDatabase({ list: [opponent] });

      const result = await listOpponents(database, {
        tenantId: "tenant-1",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "opponent-1",
        tenantId: "tenant-1",
        officialName: "FC Basel 1893",
        shortName: "FC Basel",
        websiteName: "Basel",
        infoboardName: "FCB",
        notes: null,
        archivedAt: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-02T00:00:00.000Z"),
        externalMappings: [
          {
            id: "mapping-1",
            provider: "SFV",
            externalTeamId: 12345,
            externalSeasonId: 2027,
            providerTeamName: "FC Basel 1893",
            providerOrganisationId: 100,
            providerLogoUrl: "https://cdn.sfv.ch/logos/12345.png",
            providerIsActive: true,
            lastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
          },
        ],
      });
    });

    it("returns an empty array when no opponents match", async () => {
      const database = createDatabase({ list: [] });

      const result = await listOpponents(database, {
        tenantId: "tenant-1",
        search: "Nonexistent Club",
      });

      expect(result).toEqual([]);
    });

    it("returns opponents with empty externalMappings arrays", async () => {
      const database = createDatabase({
        list: [createOpponent({ externalMappings: [] })],
      });

      const result = await listOpponents(database, {
        tenantId: "tenant-1",
      });

      expect(result[0]?.externalMappings).toEqual([]);
    });

    it("rejects an empty tenantId without querying the database", async () => {
      const database = createDatabase();

      await expect(
        listOpponents(database, { tenantId: "  " }),
      ).rejects.toThrow("tenantId is required.");

      expect(database.opponent.findMany).not.toHaveBeenCalled();
    });

    it("rejects a limit above the maximum", async () => {
      const database = createDatabase();

      await expect(
        listOpponents(database, {
          tenantId: "tenant-1",
          limit: OPPONENT_MAX_LIMIT + 1,
        }),
      ).rejects.toThrow(
        `Opponent limit must be between 1 and ${OPPONENT_MAX_LIMIT}.`,
      );

      expect(database.opponent.findMany).not.toHaveBeenCalled();
    });

    it("rejects a limit below 1", async () => {
      const database = createDatabase();

      await expect(
        listOpponents(database, {
          tenantId: "tenant-1",
          limit: 0,
        }),
      ).rejects.toThrow(
        `Opponent limit must be between 1 and ${OPPONENT_MAX_LIMIT}.`,
      );
    });

    it("rejects a non-integer limit", async () => {
      const database = createDatabase();

      await expect(
        listOpponents(database, {
          tenantId: "tenant-1",
          limit: 10.5,
        }),
      ).rejects.toThrow(
        `Opponent limit must be between 1 and ${OPPONENT_MAX_LIMIT}.`,
      );
    });

    it("rejects a negative skip", async () => {
      const database = createDatabase();

      await expect(
        listOpponents(database, {
          tenantId: "tenant-1",
          skip: -1,
        }),
      ).rejects.toThrow(
        "Opponent skip must be a non-negative integer.",
      );

      expect(database.opponent.findMany).not.toHaveBeenCalled();
    });

    it("rejects a non-integer skip", async () => {
      const database = createDatabase();

      await expect(
        listOpponents(database, {
          tenantId: "tenant-1",
          skip: 1.5,
        }),
      ).rejects.toThrow(
        "Opponent skip must be a non-negative integer.",
      );
    });

    it("does not mutate the database records", async () => {
      const opponent = createOpponent();
      const originalName = opponent.officialName;
      const database = createDatabase({ list: [opponent] });

      await listOpponents(database, {
        tenantId: "tenant-1",
      });

      expect(opponent.officialName).toBe(originalName);
    });
  });

  describe("getOpponentById", () => {
    it("queries with tenantId and id, including externalMappings", async () => {
      const database = createDatabase({
        detail: createOpponent(),
      });

      await getOpponentById(database, {
        tenantId: "tenant-1",
        id: "opponent-1",
      });

      expect(database.opponent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "opponent-1",
            tenantId: "tenant-1",
          },
          include: expect.objectContaining({
            externalMappings: true,
          }),
        }),
      );
    });

    it("returns null when the opponent is not found in the tenant", async () => {
      const database = createDatabase({ detail: null });

      await expect(
        getOpponentById(database, {
          tenantId: "tenant-2",
          id: "opponent-1",
        }),
      ).resolves.toBeNull();
    });

    it("maps the database record to an OpponentDto", async () => {
      const mapping = createMapping();
      const database = createDatabase({
        detail: createOpponent({ externalMappings: [mapping] }),
      });

      const result = await getOpponentById(database, {
        tenantId: "tenant-1",
        id: "opponent-1",
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("opponent-1");
      expect(result?.officialName).toBe("FC Basel 1893");
      expect(result?.externalMappings).toHaveLength(1);
      expect(result?.externalMappings[0]?.provider).toBe("SFV");
    });

    it("returns the opponent regardless of archived status", async () => {
      const database = createDatabase({
        detail: createOpponent({
          archivedAt: new Date("2026-06-01T00:00:00.000Z"),
        }),
      });

      const result = await getOpponentById(database, {
        tenantId: "tenant-1",
        id: "opponent-1",
      });

      expect(result?.archivedAt).toEqual(
        new Date("2026-06-01T00:00:00.000Z"),
      );
    });

    it("rejects an empty tenantId without querying the database", async () => {
      const database = createDatabase();

      await expect(
        getOpponentById(database, {
          tenantId: " ",
          id: "opponent-1",
        }),
      ).rejects.toThrow("tenantId is required.");

      expect(database.opponent.findFirst).not.toHaveBeenCalled();
    });

    it("rejects an empty id without querying the database", async () => {
      const database = createDatabase();

      await expect(
        getOpponentById(database, {
          tenantId: "tenant-1",
          id: "",
        }),
      ).rejects.toThrow("id is required.");

      expect(database.opponent.findFirst).not.toHaveBeenCalled();
    });
  });
});
