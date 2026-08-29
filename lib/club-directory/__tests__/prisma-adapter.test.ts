import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClubDirectoryQueryDatabase } from "../prisma-adapter";

function makePrismaClient() {
  return {
    externalClub: { findMany: vi.fn(), findFirst: vi.fn() },
    externalTeam: { findMany: vi.fn(), findFirst: vi.fn() },
  };
}

describe("createClubDirectoryQueryDatabase", () => {
  let client: ReturnType<typeof makePrismaClient>;

  beforeEach(() => {
    client = makePrismaClient();
  });

  it("exposes externalClub and externalTeam delegates", () => {
    const db = createClubDirectoryQueryDatabase(client);
    expect(db).toHaveProperty("externalClub");
    expect(db).toHaveProperty("externalTeam");
  });

  it("externalClub.findMany forces a select shape including _count", async () => {
    client.externalClub.findMany.mockResolvedValue([]);
    const db = createClubDirectoryQueryDatabase(client);

    await db.externalClub.findMany({ where: { tenantId: "tenant-1" } });

    expect(client.externalClub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1" }),
        select: expect.objectContaining({
          logoContrastMode: true,
          _count: { select: { externalTeams: true, providerMappings: true } },
        }),
      }),
    );
  });

  it("externalClub.findFirst forces include of providerMappings and externalTeams", async () => {
    client.externalClub.findFirst.mockResolvedValue(null);
    const db = createClubDirectoryQueryDatabase(client);

    await db.externalClub.findFirst({ where: { id: "club-1", tenantId: "tenant-1" } });

    expect(client.externalClub.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          providerMappings: true,
          externalTeams: { include: { providerMappings: true } },
        }),
      }),
    );
  });

  it("externalTeam.findMany forces include of providerMappings", async () => {
    client.externalTeam.findMany.mockResolvedValue([]);
    const db = createClubDirectoryQueryDatabase(client);

    await db.externalTeam.findMany({ where: { externalClubId: "club-1" } });

    expect(client.externalTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { providerMappings: true } }),
    );
  });

  it("externalTeam.findFirst forces include of providerMappings and externalClub", async () => {
    client.externalTeam.findFirst.mockResolvedValue(null);
    const db = createClubDirectoryQueryDatabase(client);

    await db.externalTeam.findFirst({ where: { id: "team-1" } });

    expect(client.externalTeam.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          providerMappings: true,
          externalClub: expect.objectContaining({
            select: { id: true, name: true, shortName: true, logoUrl: true, archivedAt: true },
          }),
        }),
      }),
    );
  });

  it("propagates errors from Prisma unchanged", async () => {
    client.externalClub.findMany.mockRejectedValue(new Error("DB down"));
    const db = createClubDirectoryQueryDatabase(client);
    await expect(db.externalClub.findMany({})).rejects.toThrow("DB down");
  });
});
