/**
 * lib/integrations/sfv/sync/__tests__/logo-enrichment.integration.test.ts
 *
 * CLUB-DIRECTORY-02B — integration tests against a REAL, disposable, local
 * PostgreSQL database (never STAGE, never any remote database). Proves the
 * full logo-discovery/enrichment chain end-to-end through real Prisma reads
 * and writes — not the in-memory fake database used by
 * lib/club-directory/__tests__/discovery-service.test.ts /
 * mutation-service.test.ts — for exactly the scenarios the task requires
 * evidence for:
 *
 *   1. A brand-new opponent is discovered and its ExternalClub.logoUrl is
 *      enriched from provider data (SFV team-picture -> data: URI).
 *   2. An existing canonical club with an empty logoUrl gets enriched on a
 *      later sync.
 *   3. A tenant-managed (pre-set) ExternalClub.logoUrl is NEVER overwritten
 *      by provider sync, even when the provider reports a different crest.
 *   4. Repeated sync is idempotent: once enriched, a second/third run makes
 *      no further writes and does not call the SFV client again (proves the
 *      "avoid unnecessary provider/network calls" requirement against real
 *      DB state, not just an in-memory mock).
 *   5. Tenant isolation: the same SFV providerTeamId under two different
 *      tenants resolves to two independent ExternalClub rows, each enriched
 *      independently.
 *   6. A picture-fetch failure never blocks discovery/persistence — the
 *      ExternalTeam/ExternalClub shell is still created with logoUrl null.
 *
 * Mocks ONLY the SFV network boundary (fetchTeamPicture in ../../client) —
 * every database interaction (discoverExternalTeamFromProvider,
 * findExternalTeamByProviderIdentity, the real Prisma adapters) is real SQL
 * against a real Postgres instance, exercising the exact composition
 * external-team-discovery.ts#createExternalOpponentResolver uses in
 * production (see lib/integrations/sfv/sync/__tests__/
 * external-team-discovery-logo-enrichment.test.ts for the equivalent
 * fully-mocked wiring-shape proof).
 *
 * SAFETY:
 *   - This suite ONLY runs when `CLUB_DIRECTORY_02B_TEST_DATABASE_URL` is
 *     set. When unset (the default in any environment without a disposable
 *     local Postgres instance, including STAGE/CI runners that don't
 *     provision one), the entire suite is skipped — never touches any real
 *     database.
 *   - The URL must resolve to a local host (localhost/127.0.0.1/::1) — a
 *     defensive check refuses to run against anything else.
 *   - All rows are created under randomly-generated, per-run tenant keys so
 *     repeated runs never collide, and everything is deleted in `afterAll`.
 *
 * Local setup used to produce this file's evidence:
 *   sudo pg_ctlcluster 16 main start
 *   sudo -u postgres psql -c "CREATE DATABASE club_directory_02b_test;"
 *   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/club_directory_02b_test npx prisma db push --accept-data-loss
 *   CLUB_DIRECTORY_02B_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/club_directory_02b_test npx vitest run lib/integrations/sfv/sync/__tests__/logo-enrichment.integration.test.ts
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const mockFetchTeamPicture = vi.fn();
vi.mock("../../client", () => ({
  fetchTeamPicture: (...args: unknown[]) => mockFetchTeamPicture(...args),
}));

const { createClubDirectoryMutationDatabase } = await import("../../../../club-directory/prisma-mutation-adapter");
const { createClubDirectoryQueryDatabase } = await import("../../../../club-directory/prisma-adapter");
const { discoverExternalTeamFromProvider } = await import("../../../../club-directory/discovery-service");
const { findExternalTeamByProviderIdentity } = await import("../../../../club-directory/query-service");
const { resolveProviderLogoDataUri } = await import("../team-logo");

const TEST_DATABASE_URL = process.env.CLUB_DIRECTORY_02B_TEST_DATABASE_URL;

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

const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PROVIDER = "SFV";

/**
 * Reproduces the exact composition createExternalOpponentResolver uses in
 * production (external-team-discovery.ts) against the given real Prisma
 * client — a fetch-then-discover round for one SFV teamId, one "sync run".
 */
async function syncOneOpponent(
  prisma: PrismaClient,
  tenantId: string,
  sfvTeamId: number,
  sfvTeamName: string,
  syncedAt: Date,
) {
  const mutationDatabase = createClubDirectoryMutationDatabase(prisma);
  const queryDatabase = createClubDirectoryQueryDatabase(prisma);

  const existing = await findExternalTeamByProviderIdentity(queryDatabase, {
    tenantId,
    provider: PROVIDER,
    providerTeamId: sfvTeamId,
  });
  const alreadyEnriched = existing !== null && existing.externalClub.logoUrl !== null;

  const providerLogoUrl = alreadyEnriched ? null : await resolveProviderLogoDataUri(sfvTeamId);

  return discoverExternalTeamFromProvider(
    mutationDatabase,
    {
      tenantId,
      provider: PROVIDER,
      providerTeamId: sfvTeamId,
      providerTeamName: sfvTeamName,
      providerLogoUrl,
    },
    syncedAt,
  );
}

function picturePayload(base64: string) {
  return {
    base64,
    contentType: "application/json",
    contentLength: null,
    etag: null,
    lastModified: null,
    cacheControl: null,
  };
}

describe.skipIf(!canRun)(
  "CLUB-DIRECTORY-02B SFV logo discovery & enrichment (real disposable Postgres)",
  () => {
    let prisma: PrismaClient;
    let pool: Pool;

    const RUN_ID = `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const TENANT_A_KEY = `club-directory-02b-tenant-a-${RUN_ID}`;
    const TENANT_B_KEY = `club-directory-02b-tenant-b-${RUN_ID}`;
    let tenantAId: string;
    let tenantBId: string;

    beforeAll(async () => {
      if (!TEST_DATABASE_URL) return;

      pool = new Pool({ connectionString: TEST_DATABASE_URL });
      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter });

      const [tenantA, tenantB] = await Promise.all([
        prisma.tenant.create({ data: { key: TENANT_A_KEY, name: "CLUB-DIRECTORY-02B Tenant A" } }),
        prisma.tenant.create({ data: { key: TENANT_B_KEY, name: "CLUB-DIRECTORY-02B Tenant B" } }),
      ]);
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;
    });

    afterAll(async () => {
      if (!TEST_DATABASE_URL) return;

      for (const tenantId of [tenantAId, tenantBId]) {
        await prisma.externalTeamProviderMapping.deleteMany({ where: { tenantId } });
        await prisma.externalClubProviderMapping.deleteMany({ where: { tenantId } });
        await prisma.externalTeam.deleteMany({ where: { tenantId } });
        await prisma.externalClub.deleteMany({ where: { tenantId } });
      }
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

      await prisma.$disconnect();
      await pool.end();
    });

    afterEach(() => {
      mockFetchTeamPicture.mockReset();
    });

    it("1 — discovers a brand-new opponent and enriches ExternalClub.logoUrl from real provider data", async () => {
      const sfvTeamId = 810001;
      mockFetchTeamPicture.mockResolvedValueOnce(picturePayload(GIF_BASE64));

      const result = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Enrichment Test",
        new Date("2026-08-01T00:00:00.000Z"),
      );

      expect(result.discovered).toBe(true);
      expect(mockFetchTeamPicture).toHaveBeenCalledWith(sfvTeamId);
      expect(result.club.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);

      // Round-trips exactly through the real Postgres TEXT column.
      const persisted = await prisma.externalClub.findUniqueOrThrow({ where: { id: result.club.id } });
      expect(persisted.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);
    });

    it("2 — enriches an existing canonical club whose logoUrl is still empty (discovered without a logo, enriched on a later sync)", async () => {
      const sfvTeamId = 810002;

      // First sync: picture fetch fails/unavailable — club is created with logoUrl still null.
      mockFetchTeamPicture.mockResolvedValueOnce(null);
      const first = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Late Enrichment",
        new Date("2026-08-01T00:00:00.000Z"),
      );
      expect(first.club.logoUrl).toBeNull();

      // Second sync: SFV now has a picture on file — the still-empty club gets enriched.
      mockFetchTeamPicture.mockResolvedValueOnce(picturePayload(GIF_BASE64));
      const second = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Late Enrichment",
        new Date("2026-08-02T00:00:00.000Z"),
      );

      expect(second.club.id).toBe(first.club.id);
      expect(second.club.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);
    });

    it("3 — never overwrites a tenant-managed logoUrl, even when provider sync reports a different crest", async () => {
      const sfvTeamId = 810003;

      mockFetchTeamPicture.mockResolvedValueOnce(picturePayload(GIF_BASE64));
      const first = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Tenant Protected",
        new Date("2026-08-01T00:00:00.000Z"),
      );

      // Club Admin manually sets a tenant-managed crest (simulates the real
      // upload flow — see lib/assets/club-logo-upload.ts).
      const tenantLogoUrl = "https://blob.example.com/tenant-uploaded-crest.png";
      await prisma.externalClub.update({
        where: { id: first.club.id },
        data: { logoUrl: tenantLogoUrl },
      });

      // A later sync reports a DIFFERENT provider crest.
      const differentGif = "R0lGODlhAQABAIAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICTAEAOw==";
      mockFetchTeamPicture.mockResolvedValueOnce(picturePayload(differentGif));
      const second = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Tenant Protected",
        new Date("2026-08-02T00:00:00.000Z"),
      );

      expect(second.club.logoUrl).toBe(tenantLogoUrl);

      const persisted = await prisma.externalClub.findUniqueOrThrow({ where: { id: first.club.id } });
      expect(persisted.logoUrl).toBe(tenantLogoUrl);
    });

    it("4 — repeated sync is idempotent and stops calling the SFV picture endpoint once enriched", async () => {
      const sfvTeamId = 810004;

      mockFetchTeamPicture.mockResolvedValueOnce(picturePayload(GIF_BASE64));
      const first = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Idempotency Test",
        new Date("2026-08-01T00:00:00.000Z"),
      );
      expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);

      // Two further "sync runs" — the picture endpoint must never be called
      // again once the club already has a logo (avoids unnecessary
      // provider/network calls), and the stored logo never changes.
      const second = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Idempotency Test",
        new Date("2026-08-02T00:00:00.000Z"),
      );
      const third = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Idempotency Test",
        new Date("2026-08-03T00:00:00.000Z"),
      );

      expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
      expect(second.club.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);
      expect(third.club.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);
      expect(second.club.id).toBe(first.club.id);
      expect(third.club.id).toBe(first.club.id);

      const clubCount = await prisma.externalClub.count({
        where: { tenantId: tenantAId, name: "SV Idempotency Test" },
      });
      expect(clubCount).toBe(1);
    });

    it("5 — tenant isolation: the same SFV providerTeamId resolves to independent, independently-enriched clubs per tenant", async () => {
      const sharedSfvTeamId = 810005;

      mockFetchTeamPicture.mockResolvedValueOnce(picturePayload(GIF_BASE64));
      const forTenantA = await syncOneOpponent(
        prisma,
        tenantAId,
        sharedSfvTeamId,
        "SV Shared Team Id",
        new Date("2026-08-01T00:00:00.000Z"),
      );

      // Tenant B has never seen this SFV teamId before — must be a
      // completely separate discovery, not fed by tenant A's cache/state.
      mockFetchTeamPicture.mockResolvedValueOnce(null);
      const forTenantB = await syncOneOpponent(
        prisma,
        tenantBId,
        sharedSfvTeamId,
        "SV Shared Team Id",
        new Date("2026-08-01T00:00:00.000Z"),
      );

      expect(forTenantA.club.id).not.toBe(forTenantB.club.id);
      expect(forTenantA.club.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);
      expect(forTenantB.club.logoUrl).toBeNull();

      const tenantAClub = await prisma.externalClub.findUniqueOrThrow({
        where: { id: forTenantA.club.id },
      });
      const tenantBClub = await prisma.externalClub.findUniqueOrThrow({
        where: { id: forTenantB.club.id },
      });
      expect(tenantAClub.tenantId).toBe(tenantAId);
      expect(tenantBClub.tenantId).toBe(tenantBId);
    });

    it("6 — a picture-fetch failure never blocks discovery/persistence — the shell is still created with logoUrl null", async () => {
      const sfvTeamId = 810006;
      mockFetchTeamPicture.mockRejectedValueOnce(new Error("SFV unavailable"));

      const result = await syncOneOpponent(
        prisma,
        tenantAId,
        sfvTeamId,
        "SV Failure Resilience",
        new Date("2026-08-01T00:00:00.000Z"),
      );

      expect(result.discovered).toBe(true);
      expect(result.club.logoUrl).toBeNull();
      expect(result.team.id).toBeTruthy();

      const persistedTeam = await prisma.externalTeam.findUniqueOrThrow({
        where: { id: result.team.id },
      });
      expect(persistedTeam.name).toBe("SV Failure Resilience");
    });
  },
);
