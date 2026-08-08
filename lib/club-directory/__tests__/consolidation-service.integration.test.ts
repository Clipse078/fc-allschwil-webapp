/**
 * lib/club-directory/__tests__/consolidation-service.integration.test.ts
 *
 * CLUB-DIRECTORY-02C — integration tests against a REAL, disposable, local
 * PostgreSQL database (never STAGE, never any remote database). Proves the
 * backfill/consolidation service end-to-end through real Prisma reads and
 * writes — not the in-memory fake database used by
 * consolidation-service.test.ts — for exactly the scenarios the task
 * requires evidence for:
 *
 *   1. Multiple pre-existing per-team ExternalClub rows sharing the same
 *      resolved SFV clubNumber consolidate onto ONE canonical ExternalClub.
 *   2. Distinct real-world clubs (different clubNumbers) remain distinct.
 *   3. ExternalTeam rows, their ExternalTeamProviderMapping rows, AND
 *      Match references (MatchExternalMapping.homeExternalTeamId) all
 *      survive consolidation — Matchcenter's real query-service (unmodified
 *      by this slice) resolves the CANONICAL club's crest immediately
 *      afterward, through the exact same code path used in production.
 *   4. Tenant isolation — the same clubNumber under two tenants never
 *      cross-merges.
 *   5. Idempotent rerun — running the same consolidation twice produces no
 *      further writes.
 *   6. A tenant-managed logo on the canonical club survives consolidation
 *      unchanged, even when a losing club has a different logo.
 *   7. An existing provider-filled logo on a losing club is adopted onto a
 *      still-logo-less canonical club.
 *
 * SAFETY:
 *   - This suite ONLY runs when `CLUB_DIRECTORY_02C_TEST_DATABASE_URL` is
 *     set. When unset, the entire suite is skipped — never touches any
 *     real database.
 *   - The URL must resolve to a local host (localhost/127.0.0.1/::1).
 *   - All rows are created under randomly-generated, per-run tenant/season
 *     keys so repeated runs never collide, and everything is deleted in
 *     `afterAll`.
 *
 * Local setup used to produce this file's evidence:
 *   sudo pg_ctlcluster 16 main start
 *   sudo -u postgres psql -c "CREATE DATABASE club_directory_02c_test;"
 *   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/club_directory_02c_test npx prisma db push --accept-data-loss
 *   CLUB_DIRECTORY_02C_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/club_directory_02c_test npx vitest run lib/club-directory/__tests__/consolidation-service.integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { consolidateExternalClubsByProviderIdentity } from "../consolidation-service";
import { createClubConsolidationDatabase } from "../prisma-consolidation-adapter";
import { getMatchcenterMatchDetail, type MatchcenterQueryDatabase } from "../../matchcenter/query-service";

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

describe.skipIf(!canRun)(
  "CLUB-DIRECTORY-02C consolidation service (real disposable Postgres)",
  () => {
    let prisma: PrismaClient;
    let pool: Pool;

    const RUN_ID = `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const TENANT_A_KEY = `club-directory-02c-tenant-a-${RUN_ID}`;
    const TENANT_B_KEY = `club-directory-02c-tenant-b-${RUN_ID}`;
    const SEASON_KEY = `club-directory-02c-season-${RUN_ID}`;

    let tenantAId: string;
    let tenantBId: string;
    let seasonId: string;

    beforeAll(async () => {
      if (!TEST_DATABASE_URL) return;

      pool = new Pool({ connectionString: TEST_DATABASE_URL });
      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter });

      const [tenantA, tenantB] = await Promise.all([
        prisma.tenant.create({ data: { key: TENANT_A_KEY, name: "CLUB-DIRECTORY-02C Tenant A" } }),
        prisma.tenant.create({ data: { key: TENANT_B_KEY, name: "CLUB-DIRECTORY-02C Tenant B" } }),
      ]);
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;

      const season = await prisma.season.create({
        data: {
          key: SEASON_KEY,
          name: "2026/2027 (test)",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2027-06-30T00:00:00.000Z"),
          isActive: true,
        },
      });
      seasonId = season.id;
    });

    afterAll(async () => {
      if (!TEST_DATABASE_URL) return;

      for (const tenantId of [tenantAId, tenantBId]) {
        await prisma.matchExternalMapping.deleteMany({ where: { tenantId } });
        await prisma.event.deleteMany({ where: { tenantId } });
        await prisma.externalTeamProviderMapping.deleteMany({ where: { tenantId } });
        await prisma.externalClubProviderMapping.deleteMany({ where: { tenantId } });
        await prisma.externalTeam.deleteMany({ where: { tenantId } });
        await prisma.externalClub.deleteMany({ where: { tenantId } });
      }
      await prisma.season.deleteMany({ where: { id: seasonId } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

      await prisma.$disconnect();
      await pool.end();
    });

    /** Seeds a pre-existing "one club per team" duplicate: N clubs, one team each, one mapping each. */
    async function seedDuplicateClubPerTeam(
      tenantId: string,
      teamSpecs: Array<{ providerTeamId: number; name: string; logoUrl?: string | null; createdAtOffsetDays?: number }>,
    ): Promise<{ clubIds: string[]; teamIds: string[] }> {
      const clubIds: string[] = [];
      const teamIds: string[] = [];
      for (const spec of teamSpecs) {
        const club = await prisma.externalClub.create({
          data: {
            tenantId,
            name: spec.name,
            source: PROVIDER,
            logoUrl: spec.logoUrl ?? null,
            createdAt: new Date(
              Date.now() - (spec.createdAtOffsetDays ?? 0) * 24 * 60 * 60 * 1000,
            ),
          },
        });
        const team = await prisma.externalTeam.create({
          data: { tenantId, externalClubId: club.id, name: spec.name, source: PROVIDER },
        });
        await prisma.externalTeamProviderMapping.create({
          data: { tenantId, externalTeamId: team.id, provider: PROVIDER, providerTeamId: spec.providerTeamId },
        });
        clubIds.push(club.id);
        teamIds.push(team.id);
      }
      return { clubIds, teamIds };
    }

    async function runConsolidation(tenantId: string, resolvedClubIdsByTeamId: Map<number, number>) {
      const database = createClubConsolidationDatabase(prisma);
      return consolidateExternalClubsByProviderIdentity(database, {
        tenantId,
        provider: PROVIDER,
        resolvedClubIdsByTeamId,
      });
    }

    /**
     * getMatchcenterMatchDetail() itself forces `include: matchcenterRelations`
     * on every call (see lib/matchcenter/query-service.ts), so a plain
     * pass-through to the real Prisma delegate always fetches the full shape
     * that function depends on — this cast only works around the raw
     * Prisma-generated return type not matching the service's narrower
     * structural `MatchcenterEventRecord` type one-for-one at the type level.
     */
    function matchcenterQueryDatabase(): MatchcenterQueryDatabase {
      return {
        event: {
          findFirst: (args: object) => prisma.event.findFirst(args as never) as never,
          findMany: (args: object) => prisma.event.findMany(args as never) as never,
        },
      };
    }

    it("1 — merges pre-existing per-team ExternalClub rows sharing the same resolved clubNumber onto ONE canonical club", async () => {
      const { clubIds, teamIds } = await seedDuplicateClubPerTeam(tenantAId, [
        { providerTeamId: 900001, name: "FC Therwil 1" },
        { providerTeamId: 900002, name: "FC Therwil B1" },
        { providerTeamId: 900003, name: "FC Therwil D7 gelb" },
      ]);

      const result = await runConsolidation(
        tenantAId,
        new Map([
          [900001, 700],
          [900002, 700],
          [900003, 700],
        ]),
      );

      expect(result.groupsMerged).toBe(1);
      expect(result.teamsMoved).toBe(2);
      expect(result.clubsArchived).toBe(2);

      const teams = await prisma.externalTeam.findMany({ where: { id: { in: teamIds } } });
      const distinctClubIds = new Set(teams.map((t) => t.externalClubId));
      expect(distinctClubIds.size).toBe(1);
      const canonicalClubId = [...distinctClubIds][0];

      // Nothing is deleted — all three original ExternalClub rows still exist.
      const clubs = await prisma.externalClub.findMany({ where: { id: { in: clubIds } } });
      expect(clubs).toHaveLength(3);
      const losing = clubs.filter((c) => c.id !== canonicalClubId);
      expect(losing).toHaveLength(2);
      for (const c of losing) {
        expect(c.archivedAt).not.toBeNull();
      }

      // A durable ExternalClubProviderMapping now records this clubNumber -> canonical club.
      const clubMapping = await prisma.externalClubProviderMapping.findUnique({
        where: { tenantId_provider_providerClubId: { tenantId: tenantAId, provider: PROVIDER, providerClubId: 700 } },
      });
      expect(clubMapping?.externalClubId).toBe(canonicalClubId);
    });

    it("2 — distinct clubs (different clubNumbers) remain distinct after consolidation", async () => {
      const { clubIds: therwilClubIds } = await seedDuplicateClubPerTeam(tenantAId, [
        { providerTeamId: 900101, name: "FC Therwil 1" },
      ]);
      const { clubIds: aeschClubIds } = await seedDuplicateClubPerTeam(tenantAId, [
        { providerTeamId: 900102, name: "FC Aesch 1" },
      ]);

      await runConsolidation(
        tenantAId,
        new Map([
          [900101, 701],
          [900102, 702],
        ]),
      );

      const therwilClub = await prisma.externalClub.findUniqueOrThrow({ where: { id: therwilClubIds[0] } });
      const aeschClub = await prisma.externalClub.findUniqueOrThrow({ where: { id: aeschClubIds[0] } });
      expect(therwilClub.id).not.toBe(aeschClub.id);
      expect(therwilClub.archivedAt).toBeNull();
      expect(aeschClub.archivedAt).toBeNull();
    });

    it("3 — ExternalTeam, ExternalTeamProviderMapping, and Match references all survive; Matchcenter resolves the CANONICAL club crest afterward", async () => {
      const { clubIds, teamIds } = await seedDuplicateClubPerTeam(tenantAId, [
        {
          providerTeamId: 900201,
          name: "FC Muttenz 1",
          logoUrl: "data:image/gif;base64,CANONICALCREST=",
          createdAtOffsetDays: 10,
        },
        { providerTeamId: 900202, name: "FC Muttenz B1" },
      ]);

      // A real Event + MatchExternalMapping referencing the SECOND (losing)
      // club's team as the away side — exactly what schedule sync produces.
      const event = await prisma.event.create({
        data: {
          seasonId,
          tenantId: tenantAId,
          type: "MATCH",
          source: "SFV",
          status: "SCHEDULED",
          title: "Test match vs FC Muttenz",
          startAt: new Date("2027-09-01T18:00:00.000Z"),
        },
      });
      await prisma.matchExternalMapping.create({
        data: {
          tenantId: tenantAId,
          eventId: event.id,
          provider: PROVIDER,
          externalMatchId: 900299,
          externalSeasonId: 2027,
          providerHomeTeamId: 1,
          providerAwayTeamId: 900202,
          awayExternalTeamId: teamIds[1],
          lastSyncedAt: new Date(),
        },
      });

      const beforeDetail = await getMatchcenterMatchDetail(matchcenterQueryDatabase(), {
        tenantId: tenantAId,
        eventId: event.id,
      });
      // Before consolidation, the away side's crest comes from its OWN
      // (still-separate) club — which has no logo yet.
      expect(beforeDetail?.away.externalLogoUrl).toBeNull();

      const result = await runConsolidation(
        tenantAId,
        new Map([
          [900201, 703],
          [900202, 703],
        ]),
      );
      expect(result.groupsMerged).toBe(1);

      // The team row (and its provider mapping) is untouched in identity —
      // only its externalClubId changed.
      const mappingAfter = await prisma.externalTeamProviderMapping.findFirst({
        where: { tenantId: tenantAId, provider: PROVIDER, providerTeamId: 900202 },
      });
      expect(mappingAfter?.externalTeamId).toBe(teamIds[1]);

      // Match reference is untouched — same externalTeamId, same eventId.
      const mappingRow = await prisma.matchExternalMapping.findUnique({ where: { eventId: event.id } });
      expect(mappingRow?.awayExternalTeamId).toBe(teamIds[1]);

      // Matchcenter's REAL, unmodified query-service now resolves the
      // CANONICAL club's crest through the exact same production code path.
      const afterDetail = await getMatchcenterMatchDetail(matchcenterQueryDatabase(), {
        tenantId: tenantAId,
        eventId: event.id,
      });
      expect(afterDetail?.away.externalLogoUrl).toBe("data:image/gif;base64,CANONICALCREST=");

      // The canonical club is the earliest-created one (offset 10 days) —
      // confirm the crest now lives there, not on the away team's OWN
      // now-archived original club.
      const canonicalClub = await prisma.externalClub.findUniqueOrThrow({ where: { id: clubIds[0] } });
      expect(canonicalClub.logoUrl).toBe("data:image/gif;base64,CANONICALCREST=");
    });

    it("4 — tenant isolation: the same clubNumber under two tenants never cross-merges", async () => {
      const { clubIds: tenantAClubs } = await seedDuplicateClubPerTeam(tenantAId, [
        { providerTeamId: 900301, name: "FC Shared Name 1" },
      ]);
      const { clubIds: tenantBClubs } = await seedDuplicateClubPerTeam(tenantBId, [
        { providerTeamId: 900302, name: "FC Shared Name 1" },
      ]);

      await runConsolidation(tenantAId, new Map([[900301, 704]]));
      await runConsolidation(tenantBId, new Map([[900302, 704]]));

      const tenantAClub = await prisma.externalClub.findUniqueOrThrow({ where: { id: tenantAClubs[0] } });
      const tenantBClub = await prisma.externalClub.findUniqueOrThrow({ where: { id: tenantBClubs[0] } });
      expect(tenantAClub.tenantId).toBe(tenantAId);
      expect(tenantBClub.tenantId).toBe(tenantBId);
      expect(tenantAClub.archivedAt).toBeNull();
      expect(tenantBClub.archivedAt).toBeNull();

      const clubMappingA = await prisma.externalClubProviderMapping.findUnique({
        where: { tenantId_provider_providerClubId: { tenantId: tenantAId, provider: PROVIDER, providerClubId: 704 } },
      });
      const clubMappingB = await prisma.externalClubProviderMapping.findUnique({
        where: { tenantId_provider_providerClubId: { tenantId: tenantBId, provider: PROVIDER, providerClubId: 704 } },
      });
      expect(clubMappingA?.externalClubId).toBe(tenantAClub.id);
      expect(clubMappingB?.externalClubId).toBe(tenantBClub.id);
    });

    it("5 — idempotent rerun: running the same consolidation twice produces no further writes", async () => {
      const { teamIds } = await seedDuplicateClubPerTeam(tenantAId, [
        { providerTeamId: 900401, name: "FC Rerun 1" },
        { providerTeamId: 900402, name: "FC Rerun B1" },
      ]);
      const map = new Map([
        [900401, 705],
        [900402, 705],
      ]);

      const first = await runConsolidation(tenantAId, map);
      expect(first.groupsMerged).toBe(1);

      const teamsAfterFirst = await prisma.externalTeam.findMany({ where: { id: { in: teamIds } } });
      const clubIdAfterFirst = teamsAfterFirst[0].externalClubId;

      const second = await runConsolidation(tenantAId, map);
      expect(second.groupsMerged).toBe(0);
      expect(second.groupsAlreadyConsolidated).toBe(1);
      expect(second.teamsMoved).toBe(0);
      expect(second.clubsArchived).toBe(0);

      const teamsAfterSecond = await prisma.externalTeam.findMany({ where: { id: { in: teamIds } } });
      expect(teamsAfterSecond.every((t) => t.externalClubId === clubIdAfterFirst)).toBe(true);

      const clubMappingCount = await prisma.externalClubProviderMapping.count({
        where: { tenantId: tenantAId, provider: PROVIDER, providerClubId: 705 },
      });
      expect(clubMappingCount).toBe(1);
    });

    it("6 — a tenant-managed logo on the canonical club survives consolidation, even when a losing club has a different logo", async () => {
      const { clubIds } = await seedDuplicateClubPerTeam(tenantAId, [
        {
          providerTeamId: 900501,
          name: "FC TenantLogo 1",
          logoUrl: "https://cdn.example.com/tenant-uploaded.png",
          createdAtOffsetDays: 5,
        },
        { providerTeamId: 900502, name: "FC TenantLogo B1", logoUrl: "data:image/gif;base64,PROVIDERCREST=" },
      ]);

      await runConsolidation(
        tenantAId,
        new Map([
          [900501, 706],
          [900502, 706],
        ]),
      );

      const canonicalClub = await prisma.externalClub.findUniqueOrThrow({ where: { id: clubIds[0] } });
      expect(canonicalClub.logoUrl).toBe("https://cdn.example.com/tenant-uploaded.png");
    });

    it("7 — an existing provider-filled logo on a losing club is adopted onto a still-logo-less canonical club", async () => {
      const { clubIds } = await seedDuplicateClubPerTeam(tenantAId, [
        { providerTeamId: 900601, name: "FC AdoptLogo 1", createdAtOffsetDays: 5 },
        { providerTeamId: 900602, name: "FC AdoptLogo B1", logoUrl: "data:image/gif;base64,ADOPTEDCREST=" },
      ]);

      const result = await runConsolidation(
        tenantAId,
        new Map([
          [900601, 707],
          [900602, 707],
        ]),
      );

      const merged = result.details[0];
      expect(merged?.status).toBe("merged");
      if (merged?.status === "merged") {
        expect(merged.logoAdoptedFromClubId).toBe(clubIds[1]);
      }

      const canonicalClub = await prisma.externalClub.findUniqueOrThrow({ where: { id: clubIds[0] } });
      expect(canonicalClub.logoUrl).toBe("data:image/gif;base64,ADOPTEDCREST=");
    });
  },
);
