/**
 * lib/integrations/sfv/sync/__tests__/team-persistence.test.ts
 *
 * TEAM-SFV-MAPPING-01 — Focused tests for the season-carryover fix in
 * team-persistence.ts.
 *
 * Root cause under test: `loadExistingMappings` is scoped to a single
 * `externalSeasonId`. Without a cross-season fallback, every time a
 * tenant's configured SFV season advances (e.g. 2026 → 2027),
 * `processTeamDetail` would treat every already-known team as brand new
 * and call `createTeamWithMapping`, producing a duplicate canonical Team
 * for the same real-world SFV team every season — the "many
 * indistinguishable FC Allschwil rows" defect.
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database or
 * network access.
 *
 * TEST COVERAGE MAP:
 *   loadCrossSeasonTeamIds
 *     1. Excludes rows from the current season being synced.
 *     2. Includes rows from any other season.
 *     3. Most-recently-synced row wins when multiple prior seasons map the
 *        same externalTeamId.
 *     4. Returns an empty map when no prior-season rows exist.
 *
 *   linkExistingTeamToNewSeason
 *     5. Creates a new TeamExternalMapping row for the existing teamId.
 *     6. Never calls team.create (no duplicate Team).
 *     7. Returns status "relinked".
 *     8. Falls back to full creation if the canonical Team no longer exists.
 *     9. Returns a failed outcome (not a thrown error) on a persistence error.
 *
 *   processTeamDetail — resolution order
 *     10. Current-season mapping exists → update path (cross-season map ignored).
 *     11. No current-season mapping, but cross-season teamId known → relink.
 *     12. No current-season mapping and no cross-season teamId → create.
 *     13. Defaults crossSeasonTeamIds to an empty map when omitted (back-compat).
 *
 *   updateMappingFields — TEAM-IDENTITY-01 tenant-identity protection
 *     14. Only writes to teamExternalMapping.update — never calls team.update.
 *     15. Writes exclusively provider-owned fields (never name/shortName/
 *         alternativeName/isActive), even when the provider payload contains
 *         a changed team name.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TeamDetail } from "../../client";
import type { SfvTeamSyncContext } from "../types";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

const mockTeamExternalMappingFindMany = vi.fn();
const mockTeamExternalMappingCreate = vi.fn();
const mockTeamExternalMappingUpdate = vi.fn();
const mockTeamFindUnique = vi.fn();
const mockTeamFindFirst = vi.fn();
const mockTeamUpdate = vi.fn();
const mockTransaction = vi.fn();

const mockTeamExternalMappingUpdateMany = vi.fn();
const mockResolveTeamSeasonId = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamExternalMapping: {
      findMany: (...args: unknown[]) => mockTeamExternalMappingFindMany(...args),
      create: (...args: unknown[]) => mockTeamExternalMappingCreate(...args),
      update: (...args: unknown[]) => mockTeamExternalMappingUpdate(...args),
      updateMany: (...args: unknown[]) => mockTeamExternalMappingUpdateMany(...args),
    },
    team: {
      findUnique: (...args: unknown[]) => mockTeamFindUnique(...args),
      findFirst: (...args: unknown[]) => mockTeamFindFirst(...args),
      // TEAM-IDENTITY-01: kept as an explicit spy (not omitted) so the tests
      // below can assert it is never called by the sync update path, rather
      // than relying on an incidental TypeError if it ever were.
      update: (...args: unknown[]) => mockTeamUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/lib/integrations/sfv/team-season-resolution", () => ({
  resolveTeamSeasonIdForExternalMapping: (...args: unknown[]) =>
    mockResolveTeamSeasonId(...args),
}));

const {
  loadCrossSeasonTeamIds,
  linkExistingTeamToNewSeason,
  processTeamDetail,
  updateMappingFields,
} = await import("../team-persistence");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-fca";
const PROVIDER = "SFV";

const CONTEXT_2027: SfvTeamSyncContext = {
  tenantId: TENANT_ID,
  clubId: 483,
  seasonId: 2027,
  organisationId: null,
  syncedAt: new Date("2027-07-01T00:00:00.000Z"),
};

function makeDetail(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: true,
    teamId: 31927,
    teamName: "FC Allschwil C1",
    teamFullname: "FC Allschwil C1",
    clubNumber: 3502,
    clubName: "FC Allschwil",
    teamLeagueId: 17131,
    teamLeagueName: "Junioren C Promotion",
    teamDivisionName: "Gruppe 1",
    teamOrganisationId: 8,
    isTeamActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTeamSeasonId.mockResolvedValue("ts-2027");
});

// ── loadCrossSeasonTeamIds ────────────────────────────────────────────────────

describe("loadCrossSeasonTeamIds", () => {
  it("1 — queries with externalSeasonId excluding the current season", async () => {
    mockTeamExternalMappingFindMany.mockResolvedValueOnce([]);

    await loadCrossSeasonTeamIds(TENANT_ID, PROVIDER, 2027);

    expect(mockTeamExternalMappingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, provider: PROVIDER, externalSeasonId: { not: 2027 } },
      }),
    );
  });

  it("2 — includes a row synced under a prior season", async () => {
    mockTeamExternalMappingFindMany.mockResolvedValueOnce([
      { externalTeamId: 31927, teamId: "team-1" },
    ]);

    const map = await loadCrossSeasonTeamIds(TENANT_ID, PROVIDER, 2027);

    expect(map.get(31927)).toBe("team-1");
  });

  it("3 — most-recently-synced row wins for a duplicated externalTeamId", async () => {
    // Prisma orderBy lastSyncedAt desc — mock returns already in that order.
    mockTeamExternalMappingFindMany.mockResolvedValueOnce([
      { externalTeamId: 31927, teamId: "team-2026-latest" },
      { externalTeamId: 31927, teamId: "team-2025-older" },
    ]);

    const map = await loadCrossSeasonTeamIds(TENANT_ID, PROVIDER, 2027);

    expect(map.get(31927)).toBe("team-2026-latest");
  });

  it("4 — returns an empty map when no prior-season rows exist (first-ever sync)", async () => {
    mockTeamExternalMappingFindMany.mockResolvedValueOnce([]);

    const map = await loadCrossSeasonTeamIds(TENANT_ID, PROVIDER, 2027);

    expect(map.size).toBe(0);
  });
});

// ── linkExistingTeamToNewSeason ───────────────────────────────────────────────

describe("linkExistingTeamToNewSeason", () => {
  it("5 — creates a new TeamExternalMapping row for the existing teamId", async () => {
    mockTeamFindFirst.mockResolvedValueOnce({ id: "team-existing" });
    mockTeamExternalMappingCreate.mockResolvedValueOnce({});

    await linkExistingTeamToNewSeason("team-existing", makeDetail(), CONTEXT_2027);

    expect(mockTeamExternalMappingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          teamId: "team-existing",
          teamSeasonId: "ts-2027",
          externalTeamId: 31927,
          externalSeasonId: 2027,
        }),
      }),
    );
  });

  it("6 — never calls a transaction / team creation (no duplicate Team)", async () => {
    mockTeamFindFirst.mockResolvedValueOnce({ id: "team-existing" });
    mockTeamExternalMappingCreate.mockResolvedValueOnce({});

    await linkExistingTeamToNewSeason("team-existing", makeDetail(), CONTEXT_2027);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("7 — returns status 'relinked' on success", async () => {
    mockTeamFindFirst.mockResolvedValueOnce({ id: "team-existing" });
    mockTeamExternalMappingCreate.mockResolvedValueOnce({});

    const outcome = await linkExistingTeamToNewSeason("team-existing", makeDetail(), CONTEXT_2027);

    expect(outcome).toEqual({ status: "relinked" });
  });

  it("8 — falls back to full team creation when the canonical Team no longer exists", async () => {
    mockTeamFindFirst.mockResolvedValueOnce(null);
    mockTeamFindUnique.mockResolvedValueOnce(null); // no slug conflict
    mockTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        team: { create: vi.fn().mockResolvedValueOnce({ id: "team-new" }) },
        teamExternalMapping: { create: vi.fn().mockResolvedValueOnce({}) },
      });
    });

    const outcome = await linkExistingTeamToNewSeason("team-deleted", makeDetail(), CONTEXT_2027);

    expect(outcome).toEqual({ status: "created" });
    expect(mockTeamExternalMappingCreate).not.toHaveBeenCalled();
  });

  it("9 — returns a failed outcome (not a thrown error) on a persistence error", async () => {
    mockTeamFindFirst.mockResolvedValueOnce({ id: "team-existing" });
    mockTeamExternalMappingCreate.mockRejectedValueOnce(new Error("unique constraint"));

    const outcome = await linkExistingTeamToNewSeason("team-existing", makeDetail(), CONTEXT_2027);

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.code).toBe("TEAM_RELINK_FAILED");
    }
  });
});

// ── processTeamDetail — resolution order ──────────────────────────────────────

describe("processTeamDetail — resolution order", () => {
  it("10 — current-season mapping present → update path, cross-season map ignored", async () => {
    const existingMappings = new Map([
      [
        31927,
        {
          id: "mapping-1",
          teamId: "team-existing",
          teamSeasonId: null,
          providerTeamName: "Old name",
          providerLeagueId: 1,
          providerLeagueName: "Old league",
          providerOrganisationId: 8,
          providerIsActive: true,
        },
      ],
    ]);
    const crossSeasonTeamIds = new Map([[31927, "team-should-not-be-used"]]);
    mockTeamExternalMappingUpdate.mockResolvedValueOnce({});

    const outcome = await processTeamDetail(
      makeDetail(),
      CONTEXT_2027,
      existingMappings,
      crossSeasonTeamIds,
    );

    expect(outcome.status).toBe("updated");
    expect(mockTeamExternalMappingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mapping-1" } }),
    );
    expect(mockTeamFindFirst).not.toHaveBeenCalled();
  });

  it("11 — no current-season mapping, cross-season teamId known → relink (no new Team)", async () => {
    mockTeamFindFirst.mockResolvedValueOnce({ id: "team-2026" });
    mockTeamExternalMappingCreate.mockResolvedValueOnce({});

    const outcome = await processTeamDetail(
      makeDetail(),
      CONTEXT_2027,
      new Map(),
      new Map([[31927, "team-2026"]]),
    );

    expect(outcome).toEqual({ status: "relinked" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("12 — no current-season mapping and no cross-season teamId → create", async () => {
    mockTeamFindUnique.mockResolvedValueOnce(null);
    mockTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        team: { create: vi.fn().mockResolvedValueOnce({ id: "team-brand-new" }) },
        teamExternalMapping: { create: vi.fn().mockResolvedValueOnce({}) },
      });
    });

    const outcome = await processTeamDetail(makeDetail(), CONTEXT_2027, new Map(), new Map());

    expect(outcome).toEqual({ status: "created" });
  });

  it("13 — defaults crossSeasonTeamIds to an empty map when omitted (back-compat)", async () => {
    mockTeamFindUnique.mockResolvedValueOnce(null);
    mockTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        team: { create: vi.fn().mockResolvedValueOnce({ id: "team-brand-new" }) },
        teamExternalMapping: { create: vi.fn().mockResolvedValueOnce({}) },
      });
    });

    const outcome = await processTeamDetail(makeDetail(), CONTEXT_2027, new Map());

    expect(outcome).toEqual({ status: "created" });
  });
});

// ── updateMappingFields — TEAM-IDENTITY-01 tenant-identity protection ───────

describe("updateMappingFields — provider naming cannot overwrite tenant-managed identity", () => {
  it("14 — only writes to teamExternalMapping.update, never team.update", async () => {
    mockTeamExternalMappingUpdate.mockResolvedValueOnce({});

    const outcome = await updateMappingFields(
      "mapping-1",
      "team-existing",
      makeDetail({ teamName: "FC Allschwil C1 (Renamed by SFV)" }),
      CONTEXT_2027,
      "ts-existing",
    );

    expect(outcome).toEqual({ status: "updated" });
    expect(mockTeamExternalMappingUpdate).toHaveBeenCalledTimes(1);
    expect(mockTeamUpdate).not.toHaveBeenCalled();
  });

  it("15 — writes exclusively provider-owned mapping fields, never Team.name/shortName/alternativeName/isActive", async () => {
    mockTeamExternalMappingUpdate.mockResolvedValueOnce({});

    await updateMappingFields(
      "mapping-1",
      "team-existing",
      makeDetail({ teamName: "A completely different provider name" }),
      CONTEXT_2027,
      "ts-existing",
    );

    const updateArgs = mockTeamExternalMappingUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "mapping-1" });
    expect(Object.keys(updateArgs.data).sort()).toEqual(
      [
        "providerTeamName",
        "providerLeagueId",
        "providerLeagueName",
        "providerOrganisationId",
        "providerIsActive",
        "lastSyncedAt",
      ].sort(),
    );
    expect(updateArgs.data).not.toHaveProperty("name");
    expect(updateArgs.data).not.toHaveProperty("shortName");
    expect(updateArgs.data).not.toHaveProperty("alternativeName");
    expect(updateArgs.data).not.toHaveProperty("isActive");
  });
});

describe("processTeamDetail — TeamSeason linkage on unchanged mappings", () => {
  it("links teamSeasonId when provider data is unchanged but link was missing", async () => {
    const existingMappings = new Map([
      [
        31927,
        {
          id: "mapping-1",
          teamId: "team-existing",
          teamSeasonId: null,
          providerTeamName: "FC Allschwil C1",
          providerLeagueId: 17131,
          providerLeagueName: "Junioren C Promotion",
          providerOrganisationId: 8,
          providerIsActive: true,
        },
      ],
    ]);

    mockTeamExternalMappingUpdateMany.mockResolvedValueOnce({ count: 1 });

    const outcome = await processTeamDetail(makeDetail(), CONTEXT_2027, existingMappings);

    expect(outcome.status).toBe("updated");
    expect(mockTeamExternalMappingUpdateMany).toHaveBeenCalledWith({
      where: { id: "mapping-1", teamSeasonId: null },
      data: { teamSeasonId: "ts-2027" },
    });
  });
});
