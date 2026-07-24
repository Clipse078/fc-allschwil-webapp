import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createOpponentQueryDatabase } from "../prisma-query-adapter";

function makeOpponentRow(overrides: Record<string, unknown> = {}) {
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

function makePrismaClient() {
  return {
    opponent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
}

describe("createOpponentQueryDatabase", () => {
  let client: ReturnType<typeof makePrismaClient>;

  beforeEach(() => {
    client = makePrismaClient();
  });

  it("returns an object with an opponent property", () => {
    const db = createOpponentQueryDatabase(client);
    expect(db).toHaveProperty("opponent");
  });

  it("exposes only findMany and findFirst on the opponent property", () => {
    const db = createOpponentQueryDatabase(client);
    const keys = Object.keys(db.opponent);
    expect(keys).toHaveLength(2);
    expect(keys).toContain("findMany");
    expect(keys).toContain("findFirst");
  });

  describe("findMany", () => {
    it("delegates to prisma.opponent.findMany with the provided args", async () => {
      const rows = [makeOpponentRow()];
      client.opponent.findMany.mockResolvedValue(rows);

      const db = createOpponentQueryDatabase(client);
      const args = { where: { tenantId: "tenant-1" }, take: 10, skip: 0 };
      const result = await db.opponent.findMany(args);

      expect(client.opponent.findMany).toHaveBeenCalledOnce();
      expect(result).toBe(rows);
    });

    it("always forces include: { externalMappings: true }", async () => {
      client.opponent.findMany.mockResolvedValue([]);

      const db = createOpponentQueryDatabase(client);
      await db.opponent.findMany({ where: { tenantId: "tenant-1" } });

      expect(client.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ externalMappings: true }),
        }),
      );
    });

    it("preserves where and pagination args passed from the caller", async () => {
      client.opponent.findMany.mockResolvedValue([]);

      const db = createOpponentQueryDatabase(client);
      await db.opponent.findMany({
        where: { tenantId: "tenant-99" },
        take: 25,
        skip: 5,
      });

      expect(client.opponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: "tenant-99" }),
          take: 25,
          skip: 5,
        }),
      );
    });

    it("returns the Prisma result unchanged", async () => {
      const rows = [makeOpponentRow({ id: "x" }), makeOpponentRow({ id: "y" })];
      client.opponent.findMany.mockResolvedValue(rows);

      const db = createOpponentQueryDatabase(client);
      const result = await db.opponent.findMany({});

      expect(result).toBe(rows);
    });

    it("propagates errors from Prisma unchanged", async () => {
      const error = new Error("DB connection lost");
      client.opponent.findMany.mockRejectedValue(error);

      const db = createOpponentQueryDatabase(client);

      await expect(db.opponent.findMany({})).rejects.toThrow("DB connection lost");
    });
  });

  describe("findFirst", () => {
    it("delegates to prisma.opponent.findFirst with the provided args", async () => {
      const row = makeOpponentRow();
      client.opponent.findFirst.mockResolvedValue(row);

      const db = createOpponentQueryDatabase(client);
      const args = { where: { id: "opponent-1", tenantId: "tenant-1" } };
      const result = await db.opponent.findFirst(args);

      expect(client.opponent.findFirst).toHaveBeenCalledOnce();
      expect(result).toBe(row);
    });

    it("always forces include: { externalMappings: true }", async () => {
      client.opponent.findFirst.mockResolvedValue(null);

      const db = createOpponentQueryDatabase(client);
      await db.opponent.findFirst({ where: { id: "x", tenantId: "t" } });

      expect(client.opponent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ externalMappings: true }),
        }),
      );
    });

    it("preserves where args passed from the caller", async () => {
      client.opponent.findFirst.mockResolvedValue(null);

      const db = createOpponentQueryDatabase(client);
      await db.opponent.findFirst({ where: { id: "opp-42", tenantId: "tenant-7" } });

      expect(client.opponent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "opp-42", tenantId: "tenant-7" }),
        }),
      );
    });

    it("returns null when Prisma returns null", async () => {
      client.opponent.findFirst.mockResolvedValue(null);

      const db = createOpponentQueryDatabase(client);
      const result = await db.opponent.findFirst({ where: { id: "x", tenantId: "t" } });

      expect(result).toBeNull();
    });

    it("returns the Prisma result unchanged when a record is found", async () => {
      const row = makeOpponentRow({ id: "found-1" });
      client.opponent.findFirst.mockResolvedValue(row);

      const db = createOpponentQueryDatabase(client);
      const result = await db.opponent.findFirst({});

      expect(result).toBe(row);
    });

    it("propagates errors from Prisma unchanged", async () => {
      const error = new Error("timeout");
      client.opponent.findFirst.mockRejectedValue(error);

      const db = createOpponentQueryDatabase(client);

      await expect(db.opponent.findFirst({})).rejects.toThrow("timeout");
    });
  });
});
