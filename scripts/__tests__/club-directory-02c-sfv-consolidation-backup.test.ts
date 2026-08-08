/**
 * scripts/__tests__/club-directory-02c-sfv-consolidation-backup.test.ts
 *
 * CLUB-DIRECTORY-02C-EXEC — unit tests for `buildBackupSnapshot()`'s
 * ExternalClubProviderMapping coverage (FIX 1 of the C1 remediation).
 *
 * Before this change, the pre-mutation backup captured every affected
 * ExternalClub + ExternalTeam row but NOT the ExternalClubProviderMapping
 * rows consolidation also creates/re-points (see
 * lib/club-directory/consolidation-service.ts#ensureClubProviderMapping).
 * These tests prove the snapshot now also captures those mapping rows,
 * scoped to exactly the affected tenant/provider/providerClubIds, reflecting
 * their PRE-mutation values.
 *
 * Prisma is a plain stub (no real database).
 */

import { describe, expect, it, vi } from "vitest";
import type { TenantInventory } from "../club-directory-02c-sfv-consolidation";

const { buildBackupSnapshot } = await import("../club-directory-02c-sfv-consolidation");

const TENANT_A = {
  tenantId: "tenant-fc-allschwil-id",
  tenantKey: "fc-allschwil",
  clubId: 483,
  seasonId: 2027,
  organisationId: null,
};

function makeInventory(overrides: Partial<TenantInventory> = {}): TenantInventory {
  return {
    tenant: TENANT_A,
    resolvedTeamCount: 4,
    duplicateGroups: [
      { providerClubId: 700, distinctClubIds: ["club-a", "club-b"], teamCount: 2, providerTeamIds: [2001, 2002] },
      { providerClubId: 555, distinctClubIds: ["club-c", "club-d"], teamCount: 2, providerTeamIds: [3001, 3002] },
    ],
    ...overrides,
  };
}

function makePrismaStub(options: {
  clubs?: unknown[];
  teams?: unknown[];
  mappings?: unknown[];
} = {}) {
  const findManyClub = vi.fn().mockResolvedValue(options.clubs ?? []);
  const findManyTeam = vi.fn().mockResolvedValue(options.teams ?? []);
  const findManyMapping = vi.fn().mockResolvedValue(options.mappings ?? []);
  return {
    prisma: {
      externalClub: { findMany: findManyClub },
      externalTeam: { findMany: findManyTeam },
      externalClubProviderMapping: { findMany: findManyMapping },
    } as unknown as import("@prisma/client").PrismaClient,
    findManyClub,
    findManyTeam,
    findManyMapping,
  };
}

const PRE_MUTATION_MAPPINGS = [
  {
    id: "mapping-700",
    tenantId: TENANT_A.tenantId,
    externalClubId: "club-a",
    provider: "SFV",
    providerClubId: 700,
    providerClubName: "FC Allschwil (old)",
    providerLogoUrl: null,
    providerWebsite: null,
    providerIsActive: true,
    lastSyncedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "mapping-555",
    tenantId: TENANT_A.tenantId,
    externalClubId: "club-c",
    provider: "SFV",
    providerClubId: 555,
    providerClubName: "FC Allschwil II (old)",
    providerLogoUrl: null,
    providerWebsite: null,
    providerIsActive: true,
    lastSyncedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

describe("buildBackupSnapshot — ExternalClubProviderMapping coverage", () => {
  it("includes ExternalClubProviderMapping rows for every affected group's providerClubId", async () => {
    const { prisma, findManyMapping } = makePrismaStub({ mappings: PRE_MUTATION_MAPPINGS });

    const snapshot = (await buildBackupSnapshot(prisma, [makeInventory()])) as {
      tenants: Array<{ clubProviderMappings: unknown[] }>;
    };

    expect(findManyMapping).toHaveBeenCalledOnce();
    expect(snapshot.tenants).toHaveLength(1);
    expect(snapshot.tenants[0].clubProviderMappings).toEqual(PRE_MUTATION_MAPPINGS);
  });

  it("scopes the mapping query to this tenant, provider SFV, and exactly the affected providerClubIds", async () => {
    const { prisma, findManyMapping } = makePrismaStub({ mappings: PRE_MUTATION_MAPPINGS });

    await buildBackupSnapshot(prisma, [makeInventory()]);

    expect(findManyMapping).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_A.tenantId,
        provider: "SFV",
        providerClubId: { in: [700, 555] },
      },
    });
  });

  it("never queries mappings for a providerClubId outside the affected duplicate groups", async () => {
    const { prisma, findManyMapping } = makePrismaStub({ mappings: [] });

    await buildBackupSnapshot(
      prisma,
      [
        makeInventory({
          duplicateGroups: [
            { providerClubId: 700, distinctClubIds: ["club-a", "club-b"], teamCount: 2, providerTeamIds: [2001, 2002] },
          ],
        }),
      ],
    );

    const [args] = findManyMapping.mock.calls[0];
    expect(args.where.providerClubId.in).toEqual([700]);
    expect(args.where.providerClubId.in).not.toContain(555);
  });

  it("excludes another tenant's mappings even if it shares the same providerClubId (tenant-scoped query)", async () => {
    // The mock simulates real DB filtering: only rows matching the query's
    // own tenantId are ever returned, proving the call is tenant-scoped
    // rather than relying on client-side filtering.
    const otherTenantMapping = { ...PRE_MUTATION_MAPPINGS[0], tenantId: "some-other-tenant-id" };
    const findManyMapping = vi.fn(async (args: { where: { tenantId: string } }) =>
      [PRE_MUTATION_MAPPINGS[0], otherTenantMapping].filter((m) => m.tenantId === args.where.tenantId),
    );
    const prisma = {
      externalClub: { findMany: vi.fn().mockResolvedValue([]) },
      externalTeam: { findMany: vi.fn().mockResolvedValue([]) },
      externalClubProviderMapping: { findMany: findManyMapping },
    } as unknown as import("@prisma/client").PrismaClient;

    const snapshot = (await buildBackupSnapshot(prisma, [
      makeInventory({
        duplicateGroups: [
          { providerClubId: 700, distinctClubIds: ["club-a", "club-b"], teamCount: 2, providerTeamIds: [2001, 2002] },
        ],
      }),
    ])) as { tenants: Array<{ clubProviderMappings: unknown[] }> };

    expect(snapshot.tenants[0].clubProviderMappings).toEqual([PRE_MUTATION_MAPPINGS[0]]);
    expect(snapshot.tenants[0].clubProviderMappings).not.toContainEqual(otherTenantMapping);
  });

  it("reflects the PRE-mutation mapping state exactly as read (still pointing at the losing club, not yet re-pointed)", async () => {
    const { prisma } = makePrismaStub({ mappings: PRE_MUTATION_MAPPINGS });

    const snapshot = (await buildBackupSnapshot(prisma, [makeInventory()])) as {
      tenants: Array<{ clubProviderMappings: Array<{ providerClubId: number; externalClubId: string }> }>;
    };

    const mappingFor700 = snapshot.tenants[0].clubProviderMappings.find((m) => m.providerClubId === 700);
    // Pre-mutation: still pointing at "club-a" (a losing club in this
    // group), NOT the canonical club consolidation will later choose.
    expect(mappingFor700?.externalClubId).toBe("club-a");
  });

  it("yields zero mapping rows for a group with no pre-existing ExternalClubProviderMapping (nothing to restore)", async () => {
    const { prisma } = makePrismaStub({ mappings: [] });

    const snapshot = (await buildBackupSnapshot(prisma, [makeInventory()])) as {
      tenants: Array<{ clubProviderMappings: unknown[] }>;
    };

    expect(snapshot.tenants[0].clubProviderMappings).toEqual([]);
  });

  it("skips tenants with zero duplicate groups entirely (no club/team/mapping queries issued)", async () => {
    const { prisma, findManyClub, findManyTeam, findManyMapping } = makePrismaStub();

    const snapshot = (await buildBackupSnapshot(prisma, [makeInventory({ duplicateGroups: [] })])) as {
      tenants: unknown[];
    };

    expect(snapshot.tenants).toHaveLength(0);
    expect(findManyClub).not.toHaveBeenCalled();
    expect(findManyTeam).not.toHaveBeenCalled();
    expect(findManyMapping).not.toHaveBeenCalled();
  });

  it("still captures clubs and teams exactly as before (no regression to the original backup contents)", async () => {
    const clubs = [{ id: "club-a" }, { id: "club-b" }];
    const teams = [{ id: "team-1" }];
    const { prisma } = makePrismaStub({ clubs, teams, mappings: [] });

    const snapshot = (await buildBackupSnapshot(prisma, [
      makeInventory({
        duplicateGroups: [
          { providerClubId: 700, distinctClubIds: ["club-a", "club-b"], teamCount: 2, providerTeamIds: [2001, 2002] },
        ],
      }),
    ])) as { tenants: Array<{ clubs: unknown[]; teams: unknown[] }> };

    expect(snapshot.tenants[0].clubs).toEqual(clubs);
    expect(snapshot.tenants[0].teams).toEqual(teams);
  });
});
