/**
 * lib/club-directory/__tests__/discovery-service-club-identity.integration.test.ts
 *
 * CLUB-DIRECTORY-02C — integration tests against a REAL, disposable, local
 * PostgreSQL database (never STAGE, never any remote database), proving the
 * NEW club-identity (providerClubId) consolidation and race-safety behaviour
 * added to discoverExternalTeamFromProvider — the forward-looking half of
 * this slice (the backfill/consolidation half is covered independently in
 * consolidation-service.integration.test.ts).
 *
 * TEST COVERAGE MAP:
 *   1. Two different SFV opponent teams sharing a resolved providerClubId,
 *      discovered across two sequential (real DB) calls, land on the SAME
 *      canonical ExternalClub.
 *   2. Ten genuinely concurrent discovery calls (single connection pool)
 *      for TWO different brand-new teamIds sharing the SAME brand-new
 *      providerClubId resolve to exactly one canonical ExternalClub, with
 *      zero errors and zero duplicate ExternalClub/ExternalClubProviderMapping
 *      rows.
 *   3. Eight repeated trials, each racing two fully independent
 *      PrismaClient + Pool instances (simulating two overlapping sync
 *      processes) discovering two different brand-new teams sharing the
 *      same brand-new providerClubId — every trial produces exactly one
 *      ExternalClub for that clubNumber.
 *   4. A team with no resolvable providerClubId never joins a club it has
 *      no identity evidence for.
 *   5. Tenant isolation: the same providerClubId under two tenants never
 *      cross-merges (real DB).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { createClubDirectoryMutationDatabase } from "../prisma-mutation-adapter";
import { discoverExternalTeamFromProvider } from "../discovery-service";

const TEST_DATABASE_URL = process.env.CLUB_DIRECTORY_02C_TEST_DATABASE_URL;

function isSafeLocalTestUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

const canRun = Boolean(TEST_DATABASE_URL) && isSafeLocalTestUrl(TEST_DATABASE_URL ?? "");

const PROVIDER = "SFV";

function createIndependentClient(): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

describe.skipIf(!canRun)(
  "CLUB-DIRECTORY-02C discoverExternalTeamFromProvider — club identity (real disposable Postgres)",
  () => {
    let adminPrisma: PrismaClient;
    let adminPool: Pool;
    let tenantId: string;
    let tenantBId: string;

    const RUN_ID = `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const TENANT_KEY = `club-directory-02c-identity-${RUN_ID}`;
    const TENANT_B_KEY = `club-directory-02c-identity-b-${RUN_ID}`;

    beforeAll(async () => {
      if (!TEST_DATABASE_URL) return;

      const { prisma, pool } = createIndependentClient();
      adminPrisma = prisma;
      adminPool = pool;

      const [tenant, tenantB] = await Promise.all([
        adminPrisma.tenant.create({ data: { key: TENANT_KEY, name: "CLUB-DIRECTORY-02C Identity Test Tenant" } }),
        adminPrisma.tenant.create({ data: { key: TENANT_B_KEY, name: "CLUB-DIRECTORY-02C Identity Test Tenant B" } }),
      ]);
      tenantId = tenant.id;
      tenantBId = tenantB.id;
    });

    afterAll(async () => {
      if (!TEST_DATABASE_URL) return;

      for (const id of [tenantId, tenantBId]) {
        await adminPrisma.externalTeamProviderMapping.deleteMany({ where: { tenantId: id } });
        await adminPrisma.externalClubProviderMapping.deleteMany({ where: { tenantId: id } });
        await adminPrisma.externalTeam.deleteMany({ where: { tenantId: id } });
        await adminPrisma.externalClub.deleteMany({ where: { tenantId: id } });
      }
      await adminPrisma.tenant.deleteMany({ where: { id: { in: [tenantId, tenantBId] } } });

      await adminPrisma.$disconnect();
      await adminPool.end();
    });

    it("1 — two different opponent teams sharing a resolved providerClubId land on the same canonical club (sequential, real DB)", async () => {
      const database = createClubDirectoryMutationDatabase(adminPrisma);

      const first = await discoverExternalTeamFromProvider(database, {
        tenantId,
        provider: PROVIDER,
        providerTeamId: 800001,
        providerTeamName: "FC Therwil 1",
        providerClubId: 900,
      });
      const second = await discoverExternalTeamFromProvider(database, {
        tenantId,
        provider: PROVIDER,
        providerTeamId: 800002,
        providerTeamName: "FC Therwil B1",
        providerClubId: 900,
      });

      expect(first.club.id).toBe(second.club.id);

      const clubCount = await adminPrisma.externalClub.count({
        where: { tenantId, providerMappings: { some: { provider: PROVIDER, providerClubId: 900 } } },
      });
      expect(clubCount).toBe(1);

      const teamCount = await adminPrisma.externalTeam.count({ where: { externalClubId: first.club.id } });
      expect(teamCount).toBe(2);
    });

    it("2 — ten genuinely concurrent discovery calls for two teams sharing a brand-new providerClubId produce exactly one canonical club", async () => {
      const database = createClubDirectoryMutationDatabase(adminPrisma);
      const providerClubId = 910;

      const calls = Array.from({ length: 10 }, (_, i) =>
        discoverExternalTeamFromProvider(database, {
          tenantId,
          provider: PROVIDER,
          // Alternate between two different brand-new teamIds, both
          // claiming the SAME brand-new clubNumber for the first time.
          providerTeamId: i % 2 === 0 ? 800101 : 800102,
          providerTeamName: i % 2 === 0 ? "FC Race 1" : "FC Race B1",
          providerClubId,
        }),
      );

      const results = await Promise.all(calls);

      const distinctClubIds = new Set(results.map((r) => r.club.id));
      expect(distinctClubIds.size).toBe(1);

      const clubCount = await adminPrisma.externalClub.count({
        where: { tenantId, providerMappings: { some: { provider: PROVIDER, providerClubId } } },
      });
      expect(clubCount).toBe(1);

      const clubMappingCount = await adminPrisma.externalClubProviderMapping.count({
        where: { tenantId, provider: PROVIDER, providerClubId },
      });
      expect(clubMappingCount).toBe(1);

      const teams = await adminPrisma.externalTeam.findMany({
        where: { tenantId, externalClubId: [...distinctClubIds][0] },
      });
      expect(teams).toHaveLength(2);
    });

    it("3 — eight repeated trials racing two independent processes never produce two clubs for the same brand-new clubNumber", async () => {
      for (let trial = 0; trial < 8; trial++) {
        const providerClubId = 920000 + trial;
        const teamAId = 800200 + trial * 2;
        const teamBId = 800201 + trial * 2;

        const clientA = createIndependentClient();
        const clientB = createIndependentClient();

        try {
          const databaseA = createClubDirectoryMutationDatabase(clientA.prisma);
          const databaseB = createClubDirectoryMutationDatabase(clientB.prisma);

          const [resultA, resultB] = await Promise.all([
            discoverExternalTeamFromProvider(databaseA, {
              tenantId,
              provider: PROVIDER,
              providerTeamId: teamAId,
              providerTeamName: `FC Trial ${trial} 1`,
              providerClubId,
            }),
            discoverExternalTeamFromProvider(databaseB, {
              tenantId,
              provider: PROVIDER,
              providerTeamId: teamBId,
              providerTeamName: `FC Trial ${trial} B1`,
              providerClubId,
            }),
          ]);

          expect(resultA.club.id).toBe(resultB.club.id);

          const clubCount = await adminPrisma.externalClub.count({
            where: { tenantId, providerMappings: { some: { provider: PROVIDER, providerClubId } } },
          });
          expect(clubCount).toBe(1);
        } finally {
          await clientA.prisma.$disconnect();
          await clientA.pool.end();
          await clientB.prisma.$disconnect();
          await clientB.pool.end();
        }
      }
    });

    it("4 — a team with no resolvable providerClubId never joins a club it has no identity evidence for", async () => {
      const database = createClubDirectoryMutationDatabase(adminPrisma);

      const known = await discoverExternalTeamFromProvider(database, {
        tenantId,
        provider: PROVIDER,
        providerTeamId: 800301,
        providerTeamName: "FC Known Club 1",
        providerClubId: 930,
      });

      const unknown = await discoverExternalTeamFromProvider(database, {
        tenantId,
        provider: PROVIDER,
        providerTeamId: 800302,
        providerTeamName: "FC Cup Opponent (no ranking coverage)",
        providerClubId: null,
      });

      expect(unknown.club.id).not.toBe(known.club.id);
      expect(unknown.club.name).toBe("FC Cup Opponent (no ranking coverage)");
    });

    it("5 — tenant isolation: the same providerClubId under two tenants never cross-merges (real DB)", async () => {
      const database = createClubDirectoryMutationDatabase(adminPrisma);

      const tenantAResult = await discoverExternalTeamFromProvider(database, {
        tenantId,
        provider: PROVIDER,
        providerTeamId: 800401,
        providerTeamName: "FC Cross Tenant 1",
        providerClubId: 940,
      });
      const tenantBResult = await discoverExternalTeamFromProvider(database, {
        tenantId: tenantBId,
        provider: PROVIDER,
        providerTeamId: 800402,
        providerTeamName: "FC Cross Tenant 1",
        providerClubId: 940,
      });

      expect(tenantAResult.club.id).not.toBe(tenantBResult.club.id);

      const tenantAClub = await adminPrisma.externalClub.findUniqueOrThrow({ where: { id: tenantAResult.club.id } });
      const tenantBClub = await adminPrisma.externalClub.findUniqueOrThrow({ where: { id: tenantBResult.club.id } });
      expect(tenantAClub.tenantId).toBe(tenantId);
      expect(tenantBClub.tenantId).toBe(tenantBId);
    });
  },
);
