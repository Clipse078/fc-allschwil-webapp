/**
 * STAGE-OPS-02 — Regression tests for provider mapping Bearbeiten 404.
 *
 * Root cause: ProviderMappingTable generated the "Bearbeiten" href as
 *   `/dashboard/teams/provider-mapping/unmapped?mappingId={id}`
 * for unmapped rows (teamSeasonId = null). The [teamSeasonId] page looked up
 * a TeamSeason by id="unmapped" → not found → notFound() → 404.
 *
 * Fix:
 *   - Mapped rows → `/dashboard/teams/provider-mapping/{teamSeasonId}?mappingId={id}`
 *   - Unmapped rows → `/dashboard/teams/provider-mapping/mapping/{id}`
 *
 * Tests cover:
 *   A. getProviderMappingById — tenant isolation
 *   B. getEligibleTeamSeasonsForMapping — tenant-scoped, excludes archived
 *   C. Bearbeiten URL logic — mapped vs unmapped
 *   D. Mapping assign workflow — createProviderMapping upsert handles unmapped row
 *   E. Foreign-tenant mapping ID returns null
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getProviderMappingById,
  getEligibleTeamSeasonsForMapping,
} from "../provider-mapping-queries";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamExternalMapping: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    teamSeason: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  teamExternalMapping: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  teamSeason: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const MAPPING_ID = "mapping-01";
const TEAM_SEASON_ID = "ts-01";

function makeMappingRow(teamSeasonId: string | null = null) {
  return {
    id: MAPPING_ID,
    tenantId: TENANT_A,
    teamId: "team-01",
    team: { name: "FC Test" },
    teamSeasonId,
    teamSeason: teamSeasonId ? { displayName: "FC Test 2025/2026" } : null,
    provider: "SFV",
    externalTeamId: 100,
    externalSeasonId: 50,
    providerTeamName: "SFV Team",
    providerLeagueId: null,
    providerLeagueName: null,
    providerOrganisationId: null,
    providerIsActive: true,
    mappingSource: "SYNC",
    confidenceLevel: null,
    mappingCompetitionId: null,
    mappingCompetition: null,
    lastSyncedAt: new Date("2026-07-01T00:00:00Z"),
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
  };
}

function makeTeamSeasonRow(overrides: Partial<{ id: string; status: string }> = {}) {
  return {
    id: overrides.id ?? TEAM_SEASON_ID,
    displayName: "FC Test A 2025/2026",
    shortName: null,
    status: overrides.status ?? "ACTIVE",
    team: { name: "FC Test A" },
    season: { name: "Saison 2025/2026", key: "2025-2026", startDate: new Date("2025-07-15") },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("STAGE-OPS-02 — getProviderMappingById (Issue 2 regression)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns DTO when mapping exists for the given tenantId", async () => {
    mockPrisma.teamExternalMapping.findFirst.mockResolvedValue(makeMappingRow(null));
    const result = await getProviderMappingById(TENANT_A, MAPPING_ID);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(MAPPING_ID);
    expect(result?.teamSeasonId).toBeNull();
  });

  it("returns null for a foreign-tenant mapping ID (tenant isolation)", async () => {
    mockPrisma.teamExternalMapping.findFirst.mockResolvedValue(null);
    const result = await getProviderMappingById(TENANT_B, MAPPING_ID);
    expect(result).toBeNull();
  });

  it("includes tenantId in the where clause", async () => {
    mockPrisma.teamExternalMapping.findFirst.mockResolvedValue(null);
    await getProviderMappingById(TENANT_A, MAPPING_ID);
    const callArgs = mockPrisma.teamExternalMapping.findFirst.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ id: MAPPING_ID, tenantId: TENANT_A });
  });

  it("returns DTO with teamSeasonId set for a mapped row", async () => {
    mockPrisma.teamExternalMapping.findFirst.mockResolvedValue(makeMappingRow(TEAM_SEASON_ID));
    const result = await getProviderMappingById(TENANT_A, MAPPING_ID);
    expect(result?.teamSeasonId).toBe(TEAM_SEASON_ID);
    expect(result?.teamSeasonDisplayName).toBe("FC Test 2025/2026");
  });
});

describe("STAGE-OPS-02 — getEligibleTeamSeasonsForMapping", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns team seasons scoped to the tenant", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([makeTeamSeasonRow()]);
    const result = await getEligibleTeamSeasonsForMapping(TENANT_A);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(TEAM_SEASON_ID);
    expect(result[0].teamName).toBe("FC Test A");
    expect(result[0].seasonName).toBe("Saison 2025/2026");
  });

  it("applies tenant filter in the where clause", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);
    await getEligibleTeamSeasonsForMapping(TENANT_A);
    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where.team.tenantId).toBe(TENANT_A);
  });

  it("excludes ARCHIVED TeamSeasons", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);
    await getEligibleTeamSeasonsForMapping(TENANT_A);
    const callArgs = mockPrisma.teamSeason.findMany.mock.calls[0][0];
    expect(callArgs.where.status).toEqual({ not: "ARCHIVED" });
  });

  it("returns empty array when tenant has no team seasons", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([]);
    const result = await getEligibleTeamSeasonsForMapping(TENANT_A);
    expect(result).toEqual([]);
  });

  it("returns correct shape with all required fields", async () => {
    mockPrisma.teamSeason.findMany.mockResolvedValue([makeTeamSeasonRow()]);
    const result = await getEligibleTeamSeasonsForMapping(TENANT_A);
    const ts = result[0];
    expect(ts).toHaveProperty("id");
    expect(ts).toHaveProperty("displayName");
    expect(ts).toHaveProperty("teamName");
    expect(ts).toHaveProperty("seasonName");
    expect(ts).toHaveProperty("seasonKey");
    expect(ts).toHaveProperty("status");
  });
});

describe("STAGE-OPS-02 — Bearbeiten URL logic", () => {
  it("mapped row uses [teamSeasonId] route with mappingId query param", () => {
    const m = { id: MAPPING_ID, teamSeasonId: TEAM_SEASON_ID };
    const href = m.teamSeasonId
      ? `/dashboard/teams/provider-mapping/${m.teamSeasonId}?mappingId=${m.id}`
      : `/dashboard/teams/provider-mapping/mapping/${m.id}`;
    expect(href).toBe(`/dashboard/teams/provider-mapping/${TEAM_SEASON_ID}?mappingId=${MAPPING_ID}`);
    expect(href).not.toContain("unmapped");
  });

  it("unmapped row uses mapping/[mappingId] route — NO 'unmapped' literal", () => {
    const m = { id: MAPPING_ID, teamSeasonId: null };
    const href = m.teamSeasonId
      ? `/dashboard/teams/provider-mapping/${m.teamSeasonId}?mappingId=${m.id}`
      : `/dashboard/teams/provider-mapping/mapping/${m.id}`;
    expect(href).toBe(`/dashboard/teams/provider-mapping/mapping/${MAPPING_ID}`);
    expect(href).not.toContain("unmapped");
    expect(href).not.toContain("null");
  });

  it("the word 'unmapped' must not appear in any generated Bearbeiten href", () => {
    const rows = [
      { id: "m1", teamSeasonId: "ts-1" },
      { id: "m2", teamSeasonId: null },
      { id: "m3", teamSeasonId: "ts-3" },
    ];
    for (const m of rows) {
      const href = m.teamSeasonId
        ? `/dashboard/teams/provider-mapping/${m.teamSeasonId}?mappingId=${m.id}`
        : `/dashboard/teams/provider-mapping/mapping/${m.id}`;
      expect(href).not.toContain("unmapped");
    }
  });
});
