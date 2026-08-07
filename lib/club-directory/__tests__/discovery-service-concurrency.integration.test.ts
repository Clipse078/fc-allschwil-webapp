/**
 * lib/club-directory/__tests__/discovery-service-concurrency.integration.test.ts
 *
 * CLUB-DIRECTORY-02 concurrency fix — integration tests against a REAL,
 * disposable, local PostgreSQL database (never STAGE, never any remote
 * database). Proves that two genuinely concurrent, independent database
 * connections discovering the SAME brand-new opponent can never both
 * commit an ExternalClub/ExternalTeam pair — the exact defect an
 * independent verifier reproduced in 8/8 trials against real Postgres
 * before this fix (findFirst → ExternalClub.create → ExternalTeam.create →
 * provider mapping, performed as separate, unguarded round-trips).
 *
 * Follows the same safety pattern as
 * scripts/__tests__/team-sfv-mapping-04-stale-match-reconciliation.integration.test.ts:
 *
 * SAFETY:
 *   - This suite ONLY runs when `CLUB_DIRECTORY_02_TEST_DATABASE_URL` is
 *     set. When unset (the default in any environment without a disposable
 *     local Postgres instance, including STAGE/CI runners that don't
 *     provision one), the entire suite is skipped — never touches any real
 *     database.
 *   - The URL must resolve to a local host (localhost/127.0.0.1/::1) — a
 *     defensive check refuses to run against anything else.
 *   - All rows are created under a randomly-generated, per-run tenant key
 *     so repeated runs never collide, and everything is deleted in
 *     `afterAll`.
 *
 * Local setup used to produce this file's evidence:
 *   sudo pg_ctlcluster 16 main start
 *   sudo -u postgres psql -c "CREATE DATABASE club_directory_02_test;"
 *   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/club_directory_02_test npx prisma db push --accept-data-loss
 *   CLUB_DIRECTORY_02_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/club_directory_02_test npx vitest run lib/club-directory/__tests__/discovery-service-concurrency.integration.test.ts
 *
 * TEST COVERAGE MAP:
 *   1. Ten truly concurrent discovery calls (single connection pool) for
 *      the same brand-new opponent resolve to exactly one canonical
 *      ExternalTeam/ExternalClub/provider mapping, with zero errors.
 *   2. Eight repeated trials, each racing TWO fully independent
 *      PrismaClient + Pool instances (simulating two separate processes —
 *      e.g. a manual sync overlapping an automatic cron sync, which the
 *      existing SFV-MATCH-SYNC-HOTFIX-01 lock does NOT prevent since it is
 *      never checked by the manual sync route) — every trial produces
 *      exactly one club/team/mapping and both callers resolve the SAME
 *      canonical ExternalTeam id.
 *   3. Sequential re-discovery after a race still reuses the single
 *      canonical record (no drift introduced by the fix).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { createClubDirectoryMutationDatabase } from "../prisma-mutation-adapter";
import { discoverExternalTeamFromProvider } from "../discovery-service";

const TEST_DATABASE_URL = process.env.CLUB_DIRECTORY_02_TEST_DATABASE_URL;

function isSafeLocalTestUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

const canRun = Boolean(TEST_DATABASE_URL) && isSafeLocalTestUrl(TEST_DATABASE_URL ?? "");

function createIndependentClient(): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

describe.skipIf(!canRun)(
  "CLUB-DIRECTORY-02 discoverExternalTeamFromProvider — concurrency fix (real disposable Postgres)",
  () => {
    let adminPrisma: PrismaClient;
    let adminPool: Pool;
    let tenantId: string;

    const RUN_ID = `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const TENANT_KEY = `club-directory-02-concurrency-${RUN_ID}`;
    const PROVIDER = "SFV";

    beforeAll(async () => {
      if (!TEST_DATABASE_URL) return;

      const { prisma, pool } = createIndependentClient();
      adminPrisma = prisma;
      adminPool = pool;

      const tenant = await adminPrisma.tenant.create({
        data: { key: TENANT_KEY, name: "CLUB-DIRECTORY-02 Concurrency Test Tenant" },
        select: { id: true },
      });
      tenantId = tenant.id;
    });

    afterAll(async () => {
      if (!TEST_DATABASE_URL) return;

      await adminPrisma.externalTeamProviderMapping.deleteMany({ where: { tenantId } });
      await adminPrisma.externalClubProviderMapping.deleteMany({ where: { tenantId } });
      await adminPrisma.externalTeam.deleteMany({ where: { tenantId } });
      await adminPrisma.externalClub.deleteMany({ where: { tenantId } });
      await adminPrisma.tenant.deleteMany({ where: { id: tenantId } });

      await adminPrisma.$disconnect();
      await adminPool.end();
    });

    it("1 — ten truly concurrent discovery calls for the same brand-new opponent produce exactly one canonical record", async () => {
      const providerTeamId = 700001;
      const database = createClubDirectoryMutationDatabase(adminPrisma);

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          discoverExternalTeamFromProvider(database, {
            tenantId,
            provider: PROVIDER,
            providerTeamId,
            providerTeamName: "SV Concurrency Test",
          }),
        ),
      );

      // Every call must succeed (no ClubDirectoryConflictError, no orphan
      // creation, no unhandled rejection) and every call must resolve to
      // the SAME canonical ExternalTeam/ExternalClub.
      const distinctTeamIds = new Set(results.map((r) => r.team.id));
      const distinctClubIds = new Set(results.map((r) => r.club.id));
      expect(distinctTeamIds.size).toBe(1);
      expect(distinctClubIds.size).toBe(1);

      const [teamCount, clubCount, mappingCount] = await Promise.all([
        adminPrisma.externalTeam.count({ where: { tenantId, name: "SV Concurrency Test" } }),
        adminPrisma.externalClub.count({ where: { tenantId, name: "SV Concurrency Test" } }),
        adminPrisma.externalTeamProviderMapping.count({
          where: { tenantId, provider: PROVIDER, providerTeamId },
        }),
      ]);

      expect(teamCount).toBe(1);
      expect(clubCount).toBe(1);
      expect(mappingCount).toBe(1);
    });

    it("2 — eight repeated trials racing two fully independent Prisma connections never produce a duplicate", async () => {
      let totalDuplicateTeams = 0;
      let totalDuplicateClubs = 0;
      let totalDuplicateMappings = 0;
      let totalErrors = 0;

      for (let trial = 0; trial < 8; trial++) {
        const providerTeamId = 700100 + trial;
        const teamName = `Race Team ${providerTeamId}`;

        const clientA = createIndependentClient();
        const clientB = createIndependentClient();
        const dbA = createClubDirectoryMutationDatabase(clientA.prisma);
        const dbB = createClubDirectoryMutationDatabase(clientB.prisma);

        const settled = await Promise.allSettled([
          discoverExternalTeamFromProvider(dbA, {
            tenantId,
            provider: PROVIDER,
            providerTeamId,
            providerTeamName: teamName,
          }),
          discoverExternalTeamFromProvider(dbB, {
            tenantId,
            provider: PROVIDER,
            providerTeamId,
            providerTeamName: teamName,
          }),
        ]);

        await clientA.prisma.$disconnect();
        await clientA.pool.end();
        await clientB.prisma.$disconnect();
        await clientB.pool.end();

        const rejections = settled.filter(
          (s): s is PromiseRejectedResult => s.status === "rejected",
        );
        totalErrors += rejections.length;

        const fulfilled = settled.filter(
          (s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof discoverExternalTeamFromProvider>>> =>
            s.status === "fulfilled",
        );

        if (fulfilled.length === 2) {
          expect(fulfilled[0].value.team.id).toBe(fulfilled[1].value.team.id);
          expect(fulfilled[0].value.club.id).toBe(fulfilled[1].value.club.id);
        }

        const [teamCount, clubCount, mappingCount] = await Promise.all([
          adminPrisma.externalTeam.count({ where: { tenantId, name: teamName } }),
          adminPrisma.externalClub.count({ where: { tenantId, name: teamName } }),
          adminPrisma.externalTeamProviderMapping.count({
            where: { tenantId, provider: PROVIDER, providerTeamId },
          }),
        ]);

        if (teamCount !== 1) totalDuplicateTeams++;
        if (clubCount !== 1) totalDuplicateClubs++;
        if (mappingCount !== 1) totalDuplicateMappings++;

        // Always exactly one canonical record, regardless of trial outcome.
        expect(teamCount).toBe(1);
        expect(clubCount).toBe(1);
        expect(mappingCount).toBe(1);
      }

      expect(totalErrors).toBe(0);
      expect(totalDuplicateTeams).toBe(0);
      expect(totalDuplicateClubs).toBe(0);
      expect(totalDuplicateMappings).toBe(0);
    });

    it("3 — a sequential re-discovery after a race still resolves to the single canonical record", async () => {
      const providerTeamId = 700200;
      const teamName = "Sequential After Race";

      const clientA = createIndependentClient();
      const clientB = createIndependentClient();
      const dbA = createClubDirectoryMutationDatabase(clientA.prisma);
      const dbB = createClubDirectoryMutationDatabase(clientB.prisma);

      const [raceA, raceB] = await Promise.all([
        discoverExternalTeamFromProvider(dbA, {
          tenantId,
          provider: PROVIDER,
          providerTeamId,
          providerTeamName: teamName,
        }),
        discoverExternalTeamFromProvider(dbB, {
          tenantId,
          provider: PROVIDER,
          providerTeamId,
          providerTeamName: teamName,
        }),
      ]);

      await clientA.prisma.$disconnect();
      await clientA.pool.end();
      await clientB.prisma.$disconnect();
      await clientB.pool.end();

      expect(raceA.team.id).toBe(raceB.team.id);

      const database = createClubDirectoryMutationDatabase(adminPrisma);
      const followUp = await discoverExternalTeamFromProvider(database, {
        tenantId,
        provider: PROVIDER,
        providerTeamId,
        providerTeamName: teamName,
      });

      expect(followUp.discovered).toBe(false);
      expect(followUp.team.id).toBe(raceA.team.id);

      const mappingCount = await adminPrisma.externalTeamProviderMapping.count({
        where: { tenantId, provider: PROVIDER, providerTeamId },
      });
      expect(mappingCount).toBe(1);
    });
  },
);
