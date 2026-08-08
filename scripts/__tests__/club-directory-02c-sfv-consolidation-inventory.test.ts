/**
 * scripts/__tests__/club-directory-02c-sfv-consolidation-inventory.test.ts
 *
 * CLUB-DIRECTORY-02C-EXEC — unit tests for the `loadTenantInventory()`
 * decomposition (`resolveProviderClubIdIndex` + `loadTenantInventoryFromIndex`)
 * introduced so the temporary execute endpoint
 * (app/api/ops/club-directory-02c-sfv-consolidation-execute/route.ts) can
 * regenerate a plan and execute the mutation against the EXACT SAME
 * already-fetched SFV identity index, without a second SFV fetch (TOCTOU
 * avoidance — see that route's module doc).
 *
 * `@/lib/integrations/sfv/client` and the Prisma client are mocked — no
 * real network/database access. These tests prove:
 *   - `resolveProviderClubIdIndex` performs exactly one `fetchTeamList` +
 *     one `fetchClubRanking` call and nothing else.
 *   - `loadTenantInventoryFromIndex` performs ZERO SFV calls — only a
 *     Prisma query — and reproduces `findDuplicateGroups`'s result.
 *   - `loadTenantInventory` (still exported, still behaviourally identical
 *     to before the refactor) is exactly `resolveProviderClubIdIndex`
 *     followed by `loadTenantInventoryFromIndex` — one SFV fetch total.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchTeamList = vi.fn();
const mockFetchClubRanking = vi.fn();

vi.mock("@/lib/integrations/sfv/client", () => ({
  fetchTeamList: mockFetchTeamList,
  fetchClubRanking: mockFetchClubRanking,
}));

const {
  resolveProviderClubIdIndex,
  loadTenantInventoryFromIndex,
  loadTenantInventory,
} = await import("../club-directory-02c-sfv-consolidation");

const TENANT = {
  tenantId: "tenant-fc-allschwil-id",
  tenantKey: "fc-allschwil",
  clubId: 483,
  seasonId: 2027,
  organisationId: null,
};

function makePrismaStub(mappingRows: Array<{ providerTeamId: number; externalTeam: { externalClubId: string } }>) {
  return {
    externalTeamProviderMapping: {
      findMany: vi.fn().mockResolvedValue(mappingRows),
    },
  } as unknown as import("@prisma/client").PrismaClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchTeamList.mockResolvedValue([
    { teamId: 2001, clubNumber: 700 },
    { teamId: 2002, clubNumber: 700 },
  ]);
  mockFetchClubRanking.mockResolvedValue([]);
});

describe("resolveProviderClubIdIndex", () => {
  it("fetches team list and club ranking exactly once each", async () => {
    await resolveProviderClubIdIndex(TENANT);

    expect(mockFetchTeamList).toHaveBeenCalledOnce();
    expect(mockFetchClubRanking).toHaveBeenCalledOnce();
  });

  it("calls fetchTeamList/fetchClubRanking with the tenant's SeasonId/ClubId", async () => {
    await resolveProviderClubIdIndex(TENANT);

    expect(mockFetchTeamList).toHaveBeenCalledWith({ SeasonId: 2027, ClubId: 483 });
    expect(mockFetchClubRanking).toHaveBeenCalledWith({ SeasonId: 2027, ClubId: 483 });
  });

  it("includes OrganisationId when the tenant has one configured", async () => {
    await resolveProviderClubIdIndex({ ...TENANT, organisationId: 55 });

    expect(mockFetchTeamList).toHaveBeenCalledWith({ SeasonId: 2027, ClubId: 483, OrganisationId: 55 });
  });

  it("returns a providerTeamId -> providerClubId index built from both sources", async () => {
    const { indexByTeamId } = await resolveProviderClubIdIndex(TENANT);

    expect(indexByTeamId.get(2001)).toBe(700);
    expect(indexByTeamId.get(2002)).toBe(700);
  });
});

describe("loadTenantInventoryFromIndex", () => {
  it("performs zero SFV calls — only queries Prisma with the given index", async () => {
    const prisma = makePrismaStub([
      { providerTeamId: 2001, externalTeam: { externalClubId: "club-a" } },
      { providerTeamId: 2002, externalTeam: { externalClubId: "club-b" } },
    ]);
    const index = new Map([[2001, 700], [2002, 700]]);

    const inventory = await loadTenantInventoryFromIndex(prisma, TENANT, index);

    expect(mockFetchTeamList).not.toHaveBeenCalled();
    expect(mockFetchClubRanking).not.toHaveBeenCalled();
    expect(inventory.resolvedTeamCount).toBe(2);
    expect(inventory.duplicateGroups).toEqual([
      {
        providerClubId: 700,
        distinctClubIds: ["club-a", "club-b"],
        teamCount: 2,
        providerTeamIds: [2001, 2002],
      },
    ]);
  });

  it("queries Prisma scoped to this tenant/provider/providerTeamIds", async () => {
    const prisma = makePrismaStub([]);
    const index = new Map([[2001, 700]]);

    await loadTenantInventoryFromIndex(prisma, TENANT, index);

    expect(prisma.externalTeamProviderMapping.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT.tenantId, provider: "SFV", providerTeamId: { in: [2001] } },
      select: { providerTeamId: true, externalTeam: { select: { externalClubId: true } } },
    });
  });
});

describe("loadTenantInventory — still exactly one SFV fetch total", () => {
  it("is resolveProviderClubIdIndex + loadTenantInventoryFromIndex composed — one fetch, correct result", async () => {
    const prisma = makePrismaStub([
      { providerTeamId: 2001, externalTeam: { externalClubId: "club-a" } },
      { providerTeamId: 2002, externalTeam: { externalClubId: "club-b" } },
    ]);

    const inventory = await loadTenantInventory(prisma, TENANT);

    expect(mockFetchTeamList).toHaveBeenCalledOnce();
    expect(mockFetchClubRanking).toHaveBeenCalledOnce();
    expect(inventory.resolvedTeamCount).toBe(2);
    expect(inventory.duplicateGroups).toHaveLength(1);
    expect(inventory.duplicateGroups[0].providerClubId).toBe(700);
  });
});
