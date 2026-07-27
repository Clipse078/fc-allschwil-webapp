/**
 * STAGE-OPS-01 — Regression tests for Issue 2: /dashboard/teams/provider-mapping fails.
 *
 * Root cause: Migration 20260727300000_team_provider_01_canonical_mapping was not
 * applied to the STAGE database, causing the listProviderMappings query to fail
 * when selecting the new columns (mappingSource, confidenceLevel, mappingCompetitionId).
 *
 * These tests cover:
 *   - listProviderMappings with no data (empty state, should not crash)
 *   - listProviderMappings tenant isolation (only own-tenant data returned)
 *   - listProviderMappings filter parameters work correctly
 *   - Nullable optional fields (confidenceLevel, mappingCompetitionId) are handled
 *   - Connected provider with mappings
 *   - Connected provider without mappings
 *   - Manual-only teams (no mappings)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { listProviderMappings, getMappingsForTeamSeason } from "../provider-mapping-queries";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamExternalMapping: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  teamExternalMapping: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeRow(overrides: {
  id?: string;
  tenantId?: string;
  teamId?: string;
  teamSeasonId?: string | null;
  provider?: string;
  externalTeamId?: number;
  externalSeasonId?: number;
  providerTeamName?: string | null;
  providerLeagueId?: number | null;
  providerLeagueName?: string | null;
  providerOrganisationId?: number | null;
  providerIsActive?: boolean;
  mappingSource?: string;
  confidenceLevel?: string | null;
  mappingCompetitionId?: string | null;
} = {}) {
  // Use explicit "key in overrides" checks so null overrides are honoured
  // (nullish coalescing ?? would replace null with the default value).
  const teamSeasonId = "teamSeasonId" in overrides ? overrides.teamSeasonId ?? null : "ts-01";
  const confidenceLevel = "confidenceLevel" in overrides ? overrides.confidenceLevel ?? null : null;
  const mappingCompetitionId = "mappingCompetitionId" in overrides ? overrides.mappingCompetitionId ?? null : null;

  return {
    id: overrides.id ?? "map-01",
    tenantId: overrides.tenantId ?? TENANT_A,
    teamId: overrides.teamId ?? "team-01",
    team: { name: "FC Test" },
    teamSeasonId,
    teamSeason: teamSeasonId ? { displayName: "FC Test 2025/2026" } : null,
    provider: overrides.provider ?? "SFV",
    externalTeamId: overrides.externalTeamId ?? 100,
    externalSeasonId: overrides.externalSeasonId ?? 50,
    providerTeamName: overrides.providerTeamName ?? "SFV Team Name",
    providerLeagueId: overrides.providerLeagueId ?? null,
    providerLeagueName: overrides.providerLeagueName ?? null,
    providerOrganisationId: overrides.providerOrganisationId ?? null,
    providerIsActive: overrides.providerIsActive ?? true,
    mappingSource: overrides.mappingSource ?? "SYNC",
    confidenceLevel,
    mappingCompetitionId,
    mappingCompetition: mappingCompetitionId ? { officialName: "Liga A" } : null,
    lastSyncedAt: new Date("2026-07-01T00:00:00Z"),
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("STAGE-OPS-01 — listProviderMappings (Issue 2 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no mappings exist (no provider configured)", async () => {
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([]);
    const result = await listProviderMappings(TENANT_A);
    expect(result).toEqual([]);
  });

  it("returns mapped DTO for a SYNC-created row with all nullable fields null", async () => {
    const row = makeRow({
      teamSeasonId: "ts-01",
      mappingSource: "SYNC",
      confidenceLevel: null,
      mappingCompetitionId: null,
      providerLeagueId: null,
      providerLeagueName: null,
      providerOrganisationId: null,
    });
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([row]);

    const result = await listProviderMappings(TENANT_A);
    expect(result).toHaveLength(1);
    expect(result[0].mappingSource).toBe("SYNC");
    expect(result[0].confidenceLevel).toBeNull();
    expect(result[0].mappingCompetitionId).toBeNull();
    expect(result[0].mappingCompetitionName).toBeNull();
    expect(result[0].teamSeasonId).toBe("ts-01");
    expect(result[0].teamSeasonDisplayName).toBe("FC Test 2025/2026");
  });

  it("returns mapped DTO for a MANUAL row with HIGH confidence and competition context", async () => {
    const row = makeRow({
      mappingSource: "MANUAL",
      confidenceLevel: "HIGH",
      mappingCompetitionId: "comp-01",
    });
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([row]);

    const result = await listProviderMappings(TENANT_A);
    expect(result).toHaveLength(1);
    expect(result[0].mappingSource).toBe("MANUAL");
    expect(result[0].confidenceLevel).toBe("HIGH");
    expect(result[0].mappingCompetitionId).toBe("comp-01");
    expect(result[0].mappingCompetitionName).toBe("Liga A");
  });

  it("handles unmapped TeamExternalMapping rows (teamSeasonId is null)", async () => {
    const row = makeRow({ teamSeasonId: null });
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([row]);

    const result = await listProviderMappings(TENANT_A);
    expect(result).toHaveLength(1);
    expect(result[0].teamSeasonId).toBeNull();
    expect(result[0].teamSeasonDisplayName).toBeNull();
  });

  it("tenant isolation: query always receives the given tenantId in the where clause", async () => {
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([]);
    await listProviderMappings(TENANT_A);

    const callArgs = mockPrisma.teamExternalMapping.findMany.mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe(TENANT_A);
  });

  it("tenant B query does not leak tenant A data", async () => {
    // Tenant B has no mappings
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([]);
    const result = await listProviderMappings(TENANT_B);
    expect(result).toEqual([]);

    const callArgs = mockPrisma.teamExternalMapping.findMany.mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe(TENANT_B);
  });

  it("provider filter is forwarded to the query", async () => {
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([]);
    await listProviderMappings(TENANT_A, { provider: "SFV" });

    const callArgs = mockPrisma.teamExternalMapping.findMany.mock.calls[0][0];
    expect(callArgs.where.provider).toBe("SFV");
  });

  it("mappingSource filter is forwarded to the query", async () => {
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([]);
    await listProviderMappings(TENANT_A, { mappingSource: "MANUAL" });

    const callArgs = mockPrisma.teamExternalMapping.findMany.mock.calls[0][0];
    expect(callArgs.where.mappingSource).toBe("MANUAL");
  });

  it("search filter creates an OR clause over team name and provider team name", async () => {
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([]);
    await listProviderMappings(TENANT_A, { search: "FC Test" });

    const callArgs = mockPrisma.teamExternalMapping.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR[0].team.name.contains).toBe("FC Test");
    expect(callArgs.where.OR[1].providerTeamName.contains).toBe("FC Test");
  });

  it("DTO serializes dates to ISO strings", async () => {
    const row = makeRow({});
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([row]);

    const result = await listProviderMappings(TENANT_A);
    expect(typeof result[0].lastSyncedAt).toBe("string");
    expect(typeof result[0].createdAt).toBe("string");
    expect(typeof result[0].updatedAt).toBe("string");
  });

  it("returns all mappings regardless of providerIsActive status", async () => {
    const active = makeRow({ id: "map-01", providerIsActive: true });
    const inactive = makeRow({ id: "map-02", providerIsActive: false });
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([active, inactive]);

    const result = await listProviderMappings(TENANT_A);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === "map-01")?.providerIsActive).toBe(true);
    expect(result.find((r) => r.id === "map-02")?.providerIsActive).toBe(false);
  });
});

describe("STAGE-OPS-01 — getMappingsForTeamSeason (Issue 2 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when a TeamSeason has no provider mappings (manual team)", async () => {
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([]);
    const result = await getMappingsForTeamSeason(TENANT_A, "ts-01");
    expect(result).toEqual([]);
  });

  it("scopes query to tenantId and teamSeasonId", async () => {
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([]);
    await getMappingsForTeamSeason(TENANT_A, "ts-01");

    const callArgs = mockPrisma.teamExternalMapping.findMany.mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe(TENANT_A);
    expect(callArgs.where.teamSeasonId).toBe("ts-01");
  });
});
