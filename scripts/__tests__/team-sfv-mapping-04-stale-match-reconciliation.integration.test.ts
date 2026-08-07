/**
 * scripts/__tests__/team-sfv-mapping-04-stale-match-reconciliation.integration.test.ts
 *
 * TEAM-SFV-MAPPING-04 — Integration tests for stale-match reconciliation
 * against a REAL, disposable, local PostgreSQL database (never STAGE, never
 * any remote database). This exercises the full stack — real Prisma client,
 * real SQL, real unique constraints — for the scenarios that matter most for
 * safety: tenant scoping, season scoping, active-flag scoping, conflicts,
 * and idempotency.
 *
 * SAFETY:
 *   - This suite ONLY runs when `SFV_MAPPING_04_TEST_DATABASE_URL` is set.
 *     When unset (the default in any environment without a disposable local
 *     Postgres instance, including STAGE/CI runners that don't provision
 *     one), the entire suite is skipped — never touches any real database.
 *   - The URL must never be STAGE_DB_URL / STAGE_DIRECT_URL / DATABASE_URL.
 *     A defensive check refuses to run against anything that looks like a
 *     non-local host.
 *   - All rows are created under a randomly-generated, per-run tenant key so
 *     repeated runs never collide, and everything is deleted in `afterAll`.
 *
 * Local setup used to produce this file's evidence (see PR description):
 *   sudo pg_ctlcluster 16 main start
 *   sudo -u postgres psql -c "CREATE DATABASE sfv_mapping04_test;"
 *   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sfv_mapping04_test npx prisma db push --accept-data-loss
 *   SFV_MAPPING_04_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sfv_mapping04_test npx vitest run scripts/__tests__/team-sfv-mapping-04-stale-match-reconciliation.integration.test.ts
 *
 * TEST COVERAGE MAP:
 *   1.  Stale HOME reference is repaired when exactly one active
 *       current-season mapping exists.
 *   2.  Stale AWAY reference is repaired when exactly one active
 *       current-season mapping exists.
 *   3.  An already-correct (non-null, matching) reference is left unchanged.
 *   4.  An opponent side with no tenant mapping is left untouched (external
 *       opponent — normal, not an error).
 *   5.  A TeamExternalMapping belonging to a DIFFERENT tenant cannot be used
 *       to repair this tenant's match (tenant scoping).
 *   6.  A TeamExternalMapping for a DIFFERENT externalSeasonId cannot be used
 *       (season scoping).
 *   7.  An INACTIVE (providerIsActive=false) mapping cannot be used.
 *   8.  A non-null existing value that disagrees with the mapping is reported
 *       as "ambiguous" (conflict) and left unmodified.
 *   9.  Repeated execution is idempotent — the second run repairs nothing
 *       further and reports the previously-repaired rows as already_correct.
 *   10. No Team row is created, merged, or deleted by planning or executing.
 *   11. No TeamExternalMapping row is created, updated, or deleted.
 *   12. planStaleMatchReconciliation (dry-run) performs zero writes even
 *       when repairable/ambiguous rows are present.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import {
  planStaleMatchReconciliation,
  executeStaleMatchReconciliation,
} from "../../lib/integrations/sfv/sync/stale-match-reconciliation";

const TEST_DATABASE_URL = process.env.SFV_MAPPING_04_TEST_DATABASE_URL;

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

describe.skipIf(!canRun)(
  "TEAM-SFV-MAPPING-04 stale-match reconciliation (real disposable Postgres)",
  () => {
    let prisma: PrismaClient;
    let pool: Pool;

    const RUN_ID = `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const TENANT_A_KEY = `sfv-m04-tenant-a-${RUN_ID}`;
    const TENANT_B_KEY = `sfv-m04-tenant-b-${RUN_ID}`;
    const SEASON_KEY = `sfv-m04-season-${RUN_ID}`;

    const PROVIDER = "SFV";
    const CURRENT_SEASON_ID = 2027;
    const OTHER_SEASON_ID = 2026;

    let tenantAId: string;
    let tenantBId: string;
    let seasonId: string;
    let canonicalHomeTeamId: string;
    let canonicalAwayClubTeamId: string;
    let conflictTeamId: string;

    const PROVIDER_HOME_TEAM_ID = 31924;
    const PROVIDER_AWAY_CLUB_TEAM_ID = 31925;
    const PROVIDER_EXTERNAL_OPPONENT_ID = 44001;
    const PROVIDER_TENANT_B_ONLY_TEAM_ID = 31926;
    const PROVIDER_OTHER_SEASON_ONLY_TEAM_ID = 31927;
    const PROVIDER_INACTIVE_TEAM_ID = 31928;
    const PROVIDER_CONFLICT_TEAM_ID = 31929;

    async function createEventAndMapping(input: {
      externalMatchId: number;
      homeTeamId: string | null;
      awayTeamId: string | null;
      providerHomeTeamId: number;
      providerAwayTeamId: number;
    }): Promise<string> {
      const event = await prisma.event.create({
        data: {
          seasonId,
          tenantId: tenantAId,
          type: "MATCH",
          source: "SFV",
          status: "SCHEDULED",
          title: `Test match ${input.externalMatchId}`,
          startAt: new Date("2027-09-01T18:00:00.000Z"),
        },
        select: { id: true },
      });

      const mapping = await prisma.matchExternalMapping.create({
        data: {
          tenantId: tenantAId,
          eventId: event.id,
          provider: PROVIDER,
          externalMatchId: input.externalMatchId,
          externalSeasonId: CURRENT_SEASON_ID,
          providerHomeTeamId: input.providerHomeTeamId,
          providerAwayTeamId: input.providerAwayTeamId,
          homeTeamId: input.homeTeamId,
          awayTeamId: input.awayTeamId,
          lastSyncedAt: new Date("2027-08-01T00:00:00.000Z"),
        },
        select: { id: true },
      });

      return mapping.id;
    }

    beforeAll(async () => {
      if (!TEST_DATABASE_URL) return;

      pool = new Pool({ connectionString: TEST_DATABASE_URL });
      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter });

      const tenantA = await prisma.tenant.create({
        data: { key: TENANT_A_KEY, name: "SFV Mapping 04 Test Tenant A" },
        select: { id: true },
      });
      tenantAId = tenantA.id;

      const tenantB = await prisma.tenant.create({
        data: { key: TENANT_B_KEY, name: "SFV Mapping 04 Test Tenant B" },
        select: { id: true },
      });
      tenantBId = tenantB.id;

      const season = await prisma.season.create({
        data: {
          key: SEASON_KEY,
          name: "2026/2027 (test)",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2027-06-30T00:00:00.000Z"),
          isActive: true,
        },
        select: { id: true },
      });
      seasonId = season.id;

      const homeTeam = await prisma.team.create({
        data: {
          name: "FC Testclub 1",
          slug: `sfv-m04-home-${RUN_ID}`,
          category: "AKTIVE",
          tenantId: tenantAId,
        },
        select: { id: true },
      });
      canonicalHomeTeamId = homeTeam.id;

      const awayClubTeam = await prisma.team.create({
        data: {
          name: "FC Testclub 2",
          slug: `sfv-m04-away-${RUN_ID}`,
          category: "AKTIVE",
          tenantId: tenantAId,
        },
        select: { id: true },
      });
      canonicalAwayClubTeamId = awayClubTeam.id;

      const conflictTeam = await prisma.team.create({
        data: {
          name: "FC Testclub Conflict",
          slug: `sfv-m04-conflict-${RUN_ID}`,
          category: "AKTIVE",
          tenantId: tenantAId,
        },
        select: { id: true },
      });
      conflictTeamId = conflictTeam.id;

      // Valid, active, current-season mapping for tenant A — the "authority"
      // used to repair PROVIDER_HOME_TEAM_ID / PROVIDER_AWAY_CLUB_TEAM_ID.
      await prisma.teamExternalMapping.create({
        data: {
          tenantId: tenantAId,
          teamId: canonicalHomeTeamId,
          provider: PROVIDER,
          externalTeamId: PROVIDER_HOME_TEAM_ID,
          externalSeasonId: CURRENT_SEASON_ID,
          providerIsActive: true,
          lastSyncedAt: new Date("2027-08-01T00:00:00.000Z"),
        },
      });
      await prisma.teamExternalMapping.create({
        data: {
          tenantId: tenantAId,
          teamId: canonicalAwayClubTeamId,
          provider: PROVIDER,
          externalTeamId: PROVIDER_AWAY_CLUB_TEAM_ID,
          externalSeasonId: CURRENT_SEASON_ID,
          providerIsActive: true,
          lastSyncedAt: new Date("2027-08-01T00:00:00.000Z"),
        },
      });

      // A mapping that exists, but ONLY for tenant B — must never resolve a
      // tenant-A match (test 5).
      await prisma.teamExternalMapping.create({
        data: {
          tenantId: tenantBId,
          teamId: canonicalHomeTeamId, // arbitrary — tenant scoping is what's under test
          provider: PROVIDER,
          externalTeamId: PROVIDER_TENANT_B_ONLY_TEAM_ID,
          externalSeasonId: CURRENT_SEASON_ID,
          providerIsActive: true,
          lastSyncedAt: new Date("2027-08-01T00:00:00.000Z"),
        },
      });

      // A mapping that exists for tenant A, but ONLY for a DIFFERENT season —
      // must never resolve a current-season match (test 6).
      await prisma.teamExternalMapping.create({
        data: {
          tenantId: tenantAId,
          teamId: canonicalHomeTeamId,
          provider: PROVIDER,
          externalTeamId: PROVIDER_OTHER_SEASON_ONLY_TEAM_ID,
          externalSeasonId: OTHER_SEASON_ID,
          providerIsActive: true,
          lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      });

      // A mapping that exists for tenant A + current season, but is INACTIVE —
      // must never resolve (test 7).
      await prisma.teamExternalMapping.create({
        data: {
          tenantId: tenantAId,
          teamId: canonicalHomeTeamId,
          provider: PROVIDER,
          externalTeamId: PROVIDER_INACTIVE_TEAM_ID,
          externalSeasonId: CURRENT_SEASON_ID,
          providerIsActive: false,
          lastSyncedAt: new Date("2027-08-01T00:00:00.000Z"),
        },
      });

      // A valid, active, current-season mapping used to create a genuine
      // conflict: the match's existing homeTeamId will deliberately disagree
      // with what this mapping resolves to (test 8).
      await prisma.teamExternalMapping.create({
        data: {
          tenantId: tenantAId,
          teamId: conflictTeamId,
          provider: PROVIDER,
          externalTeamId: PROVIDER_CONFLICT_TEAM_ID,
          externalSeasonId: CURRENT_SEASON_ID,
          providerIsActive: true,
          lastSyncedAt: new Date("2027-08-01T00:00:00.000Z"),
        },
      });
    });

    afterAll(async () => {
      if (!TEST_DATABASE_URL) return;

      await prisma.matchExternalMapping.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.event.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.teamExternalMapping.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.team.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.season.deleteMany({ where: { id: seasonId } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

      await prisma.$disconnect();
      await pool.end();
    });

    it("1/2/3/4 — repairs stale HOME and AWAY sides, leaves already-correct and external-opponent sides untouched", async () => {
      const staleHomeMappingId = await createEventAndMapping({
        externalMatchId: 900001,
        homeTeamId: null, // stale — repairable via PROVIDER_HOME_TEAM_ID
        awayTeamId: null, // external opponent — no mapping exists for this id — stays null
        providerHomeTeamId: PROVIDER_HOME_TEAM_ID,
        providerAwayTeamId: PROVIDER_EXTERNAL_OPPONENT_ID,
      });

      const staleAwayMappingId = await createEventAndMapping({
        externalMatchId: 900002,
        homeTeamId: canonicalHomeTeamId, // already correct, non-null, matches the mapping
        awayTeamId: null, // stale — repairable via PROVIDER_AWAY_CLUB_TEAM_ID
        providerHomeTeamId: PROVIDER_HOME_TEAM_ID,
        providerAwayTeamId: PROVIDER_AWAY_CLUB_TEAM_ID,
      });

      const result = await executeStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);

      expect(result.sidesRepaired).toBe(2);
      expect(result.rowsRepaired).toBe(2);
      expect(result.applied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            mappingId: staleHomeMappingId,
            side: "home",
            newTeamId: canonicalHomeTeamId,
          }),
          expect.objectContaining({
            mappingId: staleAwayMappingId,
            side: "away",
            newTeamId: canonicalAwayClubTeamId,
          }),
        ]),
      );

      const [row1, row2] = await Promise.all([
        prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: staleHomeMappingId } }),
        prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: staleAwayMappingId } }),
      ]);

      // 1 — stale HOME repaired
      expect(row1.homeTeamId).toBe(canonicalHomeTeamId);
      // 4 — external opponent side (no mapping exists) stays untouched
      expect(row1.awayTeamId).toBeNull();

      // 2 — stale AWAY repaired
      expect(row2.awayTeamId).toBe(canonicalAwayClubTeamId);
      // 3 — already-correct HOME side is unchanged
      expect(row2.homeTeamId).toBe(canonicalHomeTeamId);
    });

    it("5 — a TeamExternalMapping belonging to a different tenant cannot repair this tenant's match", async () => {
      const mappingId = await createEventAndMapping({
        externalMatchId: 900010,
        homeTeamId: null,
        awayTeamId: canonicalAwayClubTeamId,
        providerHomeTeamId: PROVIDER_TENANT_B_ONLY_TEAM_ID, // mapping exists only under tenant B
        providerAwayTeamId: PROVIDER_AWAY_CLUB_TEAM_ID,
      });

      const plan = await planStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      const entry = plan.entries.find((e) => e.mappingId === mappingId);

      expect(entry?.home.status).toBe("unmapped");

      await executeStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      const row = await prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: mappingId } });
      expect(row.homeTeamId).toBeNull();
    });

    it("6 — a TeamExternalMapping for a different externalSeasonId cannot repair the current season's match", async () => {
      const mappingId = await createEventAndMapping({
        externalMatchId: 900011,
        homeTeamId: null,
        awayTeamId: canonicalAwayClubTeamId,
        providerHomeTeamId: PROVIDER_OTHER_SEASON_ONLY_TEAM_ID, // mapping exists only for OTHER_SEASON_ID
        providerAwayTeamId: PROVIDER_AWAY_CLUB_TEAM_ID,
      });

      const plan = await planStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      const entry = plan.entries.find((e) => e.mappingId === mappingId);

      expect(entry?.home.status).toBe("unmapped");

      await executeStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      const row = await prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: mappingId } });
      expect(row.homeTeamId).toBeNull();
    });

    it("7 — an inactive (providerIsActive=false) mapping cannot repair a match", async () => {
      const mappingId = await createEventAndMapping({
        externalMatchId: 900012,
        homeTeamId: null,
        awayTeamId: canonicalAwayClubTeamId,
        providerHomeTeamId: PROVIDER_INACTIVE_TEAM_ID,
        providerAwayTeamId: PROVIDER_AWAY_CLUB_TEAM_ID,
      });

      const plan = await planStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      const entry = plan.entries.find((e) => e.mappingId === mappingId);

      expect(entry?.home.status).toBe("unmapped");

      await executeStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      const row = await prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: mappingId } });
      expect(row.homeTeamId).toBeNull();
    });

    it("8 — a non-null value disagreeing with the mapping is reported ambiguous and left unmodified", async () => {
      const mappingId = await createEventAndMapping({
        externalMatchId: 900013,
        // Deliberately WRONG: homeTeamId is set to canonicalAwayClubTeamId,
        // but PROVIDER_CONFLICT_TEAM_ID's active mapping resolves to conflictTeamId.
        homeTeamId: canonicalAwayClubTeamId,
        awayTeamId: canonicalHomeTeamId,
        providerHomeTeamId: PROVIDER_CONFLICT_TEAM_ID,
        providerAwayTeamId: PROVIDER_HOME_TEAM_ID,
      });

      const plan = await planStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      const entry = plan.entries.find((e) => e.mappingId === mappingId);

      expect(entry?.classification).toBe("ambiguous");
      expect(entry?.home.status).toBe("conflict");
      if (entry?.home.status === "conflict") {
        expect(entry.home.existingTeamId).toBe(canonicalAwayClubTeamId);
        expect(entry.home.candidateTeamId).toBe(conflictTeamId);
      }

      const execResult = await executeStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      expect(execResult.applied.some((a) => a.mappingId === mappingId)).toBe(false);
      expect(execResult.skippedAmbiguousRows).toBeGreaterThanOrEqual(1);

      const row = await prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: mappingId } });
      // Never overwritten — value is exactly what it was before.
      expect(row.homeTeamId).toBe(canonicalAwayClubTeamId);
    });

    it("9 — repeated execution is idempotent", async () => {
      const mappingId = await createEventAndMapping({
        externalMatchId: 900020,
        homeTeamId: null,
        awayTeamId: canonicalAwayClubTeamId,
        providerHomeTeamId: PROVIDER_HOME_TEAM_ID,
        providerAwayTeamId: PROVIDER_AWAY_CLUB_TEAM_ID,
      });

      const first = await executeStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      expect(first.applied.some((a) => a.mappingId === mappingId)).toBe(true);

      const rowAfterFirst = await prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: mappingId } });
      expect(rowAfterFirst.homeTeamId).toBe(canonicalHomeTeamId);

      const second = await executeStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      expect(second.applied.some((a) => a.mappingId === mappingId)).toBe(false);

      const rowAfterSecond = await prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: mappingId } });
      expect(rowAfterSecond.homeTeamId).toBe(rowAfterFirst.homeTeamId);
      expect(rowAfterSecond.updatedAt.getTime()).toBe(rowAfterFirst.updatedAt.getTime());

      const secondPlan = await planStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      const entry = secondPlan.entries.find((e) => e.mappingId === mappingId);
      expect(entry?.classification).toBe("already_correct");
    });

    it("10/11 — no Team or TeamExternalMapping row is created, updated, or deleted by plan or execute", async () => {
      await createEventAndMapping({
        externalMatchId: 900030,
        homeTeamId: null,
        awayTeamId: canonicalAwayClubTeamId,
        providerHomeTeamId: PROVIDER_HOME_TEAM_ID,
        providerAwayTeamId: PROVIDER_AWAY_CLUB_TEAM_ID,
      });

      const [teamsBefore, mappingsBefore] = await Promise.all([
        prisma.team.findMany({ where: { tenantId: tenantAId }, orderBy: { id: "asc" } }),
        prisma.teamExternalMapping.findMany({ where: { tenantId: tenantAId }, orderBy: { id: "asc" } }),
      ]);

      await planStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      await executeStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);

      const [teamsAfter, mappingsAfter] = await Promise.all([
        prisma.team.findMany({ where: { tenantId: tenantAId }, orderBy: { id: "asc" } }),
        prisma.teamExternalMapping.findMany({ where: { tenantId: tenantAId }, orderBy: { id: "asc" } }),
      ]);

      expect(teamsAfter).toEqual(teamsBefore);
      expect(mappingsAfter).toEqual(mappingsBefore);
    });

    it("12 — dry-run (planStaleMatchReconciliation) performs zero writes even with repairable/ambiguous rows present", async () => {
      const mappingId = await createEventAndMapping({
        externalMatchId: 900040,
        homeTeamId: null,
        awayTeamId: canonicalAwayClubTeamId,
        providerHomeTeamId: PROVIDER_HOME_TEAM_ID,
        providerAwayTeamId: PROVIDER_AWAY_CLUB_TEAM_ID,
      });

      const before = await prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: mappingId } });

      const report = await planStaleMatchReconciliation(tenantAId, CURRENT_SEASON_ID, PROVIDER);
      expect(report.repairableRows).toBeGreaterThanOrEqual(1);

      const after = await prisma.matchExternalMapping.findUniqueOrThrow({ where: { id: mappingId } });
      expect(after).toEqual(before);
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });
  },
);
