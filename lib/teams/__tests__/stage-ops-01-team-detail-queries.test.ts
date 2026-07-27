/**
 * STAGE-OPS-01 — Regression tests for Issue 3: /dashboard/teams/[teamId] fails.
 *
 * Root cause: getTeamDetailData queried TeamSeason.participationType and the
 * TeamSeasonCompetition relation, both of which depend on migrations
 * 20260727200000_team_create_02_participation_type and
 * 20260727100000_competition_01_canonical_foundation. If those migrations had
 * not been applied to STAGE, the query failed with a PostgreSQL column/table
 * not found error.
 *
 * Additionally, getTeamDetailData previously had no tenant isolation:
 * it queried by teamId only, allowing cross-tenant data access.
 *
 * These tests cover:
 *   - Tenant isolation: tenantId scoping in getTeamDetailData
 *   - Valid team for own tenant returns data
 *   - Foreign-tenant team ID returns null
 *   - Missing team ID returns null
 *   - Archived team handling
 *   - Manual team without mappings (no competitions)
 *   - Provider-synchronized team with competitions
 *   - Optional relations are handled (no orgUnit, no teamSeasons, etc.)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTeamDetailData } from "../queries";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
    },
    season: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  team: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TEAM_ID_A = "team-a-01";
const TEAM_ID_B = "team-b-01";

function makeTeamRow(overrides: Partial<{
  id: string;
  tenantId: string | null;
  isActive: boolean;
  orgUnit: null | { id: string; name: string; key: string; type: string };
  teamSeasons: unknown[];
}> = {}) {
  return {
    id: overrides.id ?? TEAM_ID_A,
    name: "FC Test",
    slug: "fc-test",
    category: "AKTIVE",
    genderGroup: null,
    ageGroup: null,
    sortOrder: 0,
    isActive: overrides.isActive ?? true,
    websiteVisible: true,
    infoboardVisible: true,
    orgUnitId: overrides.orgUnit?.id ?? null,
    orgUnit: overrides.orgUnit ?? null,
    tenantId: overrides.tenantId ?? TENANT_A,
    teamSeasons: overrides.teamSeasons ?? [],
  };
}

function makeTeamSeason(competitionCount = 0) {
  const competitions = Array.from({ length: competitionCount }, (_, i) => ({
    isPrimary: i === 0,
    competition: {
      id: `comp-0${i + 1}`,
      officialName: `Liga ${i + 1}`,
      shortName: `L${i + 1}`,
      provider: "SFV",
      competitionType: "LEAGUE",
      isArchived: false,
    },
  }));

  return {
    id: "ts-01",
    displayName: "FC Test 2025/2026",
    shortName: null,
    status: "ACTIVE",
    participationType: "COMPETITION",
    websiteVisible: true,
    infoboardVisible: true,
    season: {
      id: "season-01",
      key: "2025-2026",
      name: "Saison 2025/2026",
      startDate: new Date("2025-07-15"),
      endDate: new Date("2026-07-14"),
      isActive: true,
    },
    competitions,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("STAGE-OPS-01 — getTeamDetailData tenant isolation (Issue 3 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns team data when tenantId matches", async () => {
    const teamRow = makeTeamRow({ tenantId: TENANT_A });
    mockPrisma.team.findFirst.mockResolvedValue(teamRow);

    const result = await getTeamDetailData(TEAM_ID_A, TENANT_A);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(TEAM_ID_A);
  });

  it("returns null for a foreign-tenant team ID (tenant isolation)", async () => {
    // When tenantId is provided, Prisma should scope by it.
    // Mocking findFirst to return null simulates the DB rejecting the query.
    mockPrisma.team.findFirst.mockResolvedValue(null);

    const result = await getTeamDetailData(TEAM_ID_B, TENANT_A);
    expect(result).toBeNull();
  });

  it("includes tenantId in the where clause when tenantId is provided", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    await getTeamDetailData(TEAM_ID_A, TENANT_A);

    const callArgs = mockPrisma.team.findFirst.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ id: TEAM_ID_A, tenantId: TENANT_A });
  });

  it("omits tenantId from where clause when tenantId is undefined (backward compat)", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    await getTeamDetailData(TEAM_ID_A, undefined);

    const callArgs = mockPrisma.team.findFirst.mock.calls[0][0];
    expect(callArgs.where).toEqual({ id: TEAM_ID_A });
    expect(callArgs.where.tenantId).toBeUndefined();
  });

  it("omits tenantId from where clause when tenantId is null (backward compat)", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    await getTeamDetailData(TEAM_ID_A, null);

    const callArgs = mockPrisma.team.findFirst.mock.calls[0][0];
    expect(callArgs.where).toEqual({ id: TEAM_ID_A });
  });

  it("returns null for a missing team ID", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    const result = await getTeamDetailData("nonexistent", TENANT_A);
    expect(result).toBeNull();
  });
});

describe("STAGE-OPS-01 — getTeamDetailData data handling (Issue 3 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles a team without teamSeasons (new team, not yet in a season)", async () => {
    const teamRow = makeTeamRow({ teamSeasons: [] });
    mockPrisma.team.findFirst.mockResolvedValue(teamRow);

    const result = await getTeamDetailData(TEAM_ID_A, TENANT_A);
    expect(result).not.toBeNull();
    expect(result?.teamSeasons).toEqual([]);
  });

  it("handles a team without orgUnit (not linked to org unit)", async () => {
    const teamRow = makeTeamRow({ orgUnit: null });
    mockPrisma.team.findFirst.mockResolvedValue(teamRow);

    const result = await getTeamDetailData(TEAM_ID_A, TENANT_A);
    expect(result?.orgUnit).toBeNull();
  });

  it("handles a manual team with no competitions in any TeamSeason", async () => {
    const teamSeasonNoCompetitions = makeTeamSeason(0);
    const teamRow = makeTeamRow({ teamSeasons: [teamSeasonNoCompetitions] });
    mockPrisma.team.findFirst.mockResolvedValue(teamRow);

    const result = await getTeamDetailData(TEAM_ID_A, TENANT_A);
    expect(result?.teamSeasons[0].competitions).toEqual([]);
  });

  it("handles a provider-synchronized team with one competition", async () => {
    const teamSeasonWithComp = makeTeamSeason(1);
    const teamRow = makeTeamRow({ teamSeasons: [teamSeasonWithComp] });
    mockPrisma.team.findFirst.mockResolvedValue(teamRow);

    const result = await getTeamDetailData(TEAM_ID_A, TENANT_A);
    expect(result?.teamSeasons[0].competitions).toHaveLength(1);
    expect(result?.teamSeasons[0].competitions[0].competition.provider).toBe("SFV");
  });

  it("serializes season dates to ISO strings", async () => {
    const teamSeasonWithDates = makeTeamSeason(0);
    const teamRow = makeTeamRow({ teamSeasons: [teamSeasonWithDates] });
    mockPrisma.team.findFirst.mockResolvedValue(teamRow);

    const result = await getTeamDetailData(TEAM_ID_A, TENANT_A);
    const season = result?.teamSeasons[0].season;
    expect(typeof season?.startDate).toBe("string");
    expect(typeof season?.endDate).toBe("string");
    expect(season?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("handles an archived (inactive) team correctly", async () => {
    const teamRow = makeTeamRow({ isActive: false });
    mockPrisma.team.findFirst.mockResolvedValue(teamRow);

    const result = await getTeamDetailData(TEAM_ID_A, TENANT_A);
    expect(result?.isActive).toBe(false);
  });

  it("handles a team with TRAINING participationType TeamSeason", async () => {
    const trainingTeamSeason = {
      ...makeTeamSeason(0),
      participationType: "TRAINING",
    };
    const teamRow = makeTeamRow({ teamSeasons: [trainingTeamSeason] });
    mockPrisma.team.findFirst.mockResolvedValue(teamRow);

    const result = await getTeamDetailData(TEAM_ID_A, TENANT_A);
    expect(result?.teamSeasons[0].participationType).toBe("TRAINING");
  });
});
