/**
 * Tests for lib/provider-mapping/provider-mapping-service.ts
 *
 * Covers:
 *   A. createProviderMapping — happy path and validation errors
 *   B. Duplicate prevention
 *   C. Tenant isolation
 *   D. Archived entity rejection
 *   E. Provider isolation (unknown provider)
 *   F. removeProviderMapping
 *   G. validateProviderMapping
 *   H. Permissions (via canManage guard on queries)
 *
 * All external dependencies (Prisma, provider registry) are mocked.
 * No DB access in these tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: { findFirst: vi.fn(), findFirstOrThrow: vi.fn() },
    competition: { findFirst: vi.fn() },
    teamExternalMapping: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ── Mock provider registry ─────────────────────────────────────────────────────

vi.mock("@/lib/provider-mapping/provider-registry", () => ({
  getProviderAdapter: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "@/lib/provider-mapping/provider-registry";
import {
  createProviderMapping,
  removeProviderMapping,
  validateProviderMapping,
  replaceProviderMapping,
} from "../provider-mapping-service";
import type { CreateProviderMappingInput } from "../types";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TEAM_SEASON_ID = "ts-01";
const TEAM_ID = "team-01";
const MAPPING_ID = "mapping-01";
const COMPETITION_ID = "comp-01";

const baseInput: CreateProviderMappingInput = {
  tenantId: TENANT_A,
  teamSeasonId: TEAM_SEASON_ID,
  provider: "SFV",
  externalTeamId: 100,
  externalSeasonId: 50,
};

const mockTeamSeason = {
  id: TEAM_SEASON_ID,
  status: "ACTIVE",
  teamId: TEAM_ID,
  team: { name: "FC Test", tenantId: TENANT_A },
};

const mockAdapter = {
  providerKey: "SFV",
  fetchProviderTeams: vi.fn(),
  getProviderSeasonId: vi.fn().mockResolvedValue(50),
};

const mockMappingRow = {
  id: MAPPING_ID,
  tenantId: TENANT_A,
  teamId: TEAM_ID,
  team: { name: "FC Test" },
  teamSeasonId: TEAM_SEASON_ID,
  teamSeason: { displayName: "FC Test 2025/26" },
  provider: "SFV",
  externalTeamId: 100,
  externalSeasonId: 50,
  providerTeamName: "FC Test (SFV)",
  providerLeagueId: 42,
  providerLeagueName: "3. Liga",
  providerOrganisationId: 10,
  providerIsActive: true,
  mappingSource: "MANUAL",
  confidenceLevel: "HIGH",
  mappingCompetitionId: null,
  mappingCompetition: null,
  lastSyncedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default happy-path mocks
  vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(mockTeamSeason as never);
  vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.teamExternalMapping.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.teamExternalMapping.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.teamExternalMapping.upsert).mockResolvedValue(mockMappingRow as never);
  vi.mocked(getProviderAdapter).mockReturnValue(mockAdapter as never);
});

// ── A. Happy path ──────────────────────────────────────────────────────────────

describe("A. createProviderMapping — happy path", () => {
  it("returns ok: true with a ProviderMappingDto on success", async () => {
    const result = await createProviderMapping(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mapping.provider).toBe("SFV");
      expect(result.mapping.externalTeamId).toBe(100);
      expect(result.mapping.mappingSource).toBe("MANUAL");
    }
  });

  it("passes confidenceLevel when provided", async () => {
    const result = await createProviderMapping({
      ...baseInput,
      confidenceLevel: "HIGH",
    });
    expect(result.ok).toBe(true);
    // Upsert should have been called with the confidence level
    expect(prisma.teamExternalMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ confidenceLevel: "HIGH" }),
      }),
    );
  });
});

// ── B. Duplicate prevention ────────────────────────────────────────────────────

describe("B. Duplicate prevention", () => {
  it("rejects when TeamSeason is already mapped for this provider", async () => {
    vi.mocked(prisma.teamExternalMapping.count).mockResolvedValue(1 as never);
    const result = await createProviderMapping(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ALREADY_MAPPED");
    }
  });

  it("rejects when external team is already mapped to another TeamSeason", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst).mockResolvedValue(
      { id: "other-mapping" } as never,
    );
    const result = await createProviderMapping(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EXTERNAL_TEAM_ALREADY_MAPPED");
    }
  });
});

// ── C. Tenant isolation ────────────────────────────────────────────────────────

describe("C. Tenant isolation", () => {
  it("rejects when TeamSeason belongs to a different tenant", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(null as never);
    const result = await createProviderMapping(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TEAM_SEASON_NOT_FOUND");
    }
  });

  it("rejects when Competition belongs to a different tenant", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);
    const result = await createProviderMapping({
      ...baseInput,
      competitionId: COMPETITION_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COMPETITION_NOT_FOUND");
    }
  });
});

// ── D. Archived entity rejection ───────────────────────────────────────────────

describe("D. Archived entity rejection", () => {
  it("rejects ARCHIVED TeamSeason", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
      ...mockTeamSeason,
      status: "ARCHIVED",
    } as never);
    const result = await createProviderMapping(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TEAM_SEASON_ARCHIVED");
    }
  });

  it("rejects archived Competition as context", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({
      id: COMPETITION_ID,
      tenantId: TENANT_A,
      isArchived: true,
    } as never);
    const result = await createProviderMapping({
      ...baseInput,
      competitionId: COMPETITION_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COMPETITION_ARCHIVED");
    }
  });
});

// ── E. Provider isolation ──────────────────────────────────────────────────────

describe("E. Provider isolation", () => {
  it("rejects when no adapter is registered for the provider", async () => {
    vi.mocked(getProviderAdapter).mockReturnValue(undefined);
    const result = await createProviderMapping({ ...baseInput, provider: "UNKNOWN" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PROVIDER_NOT_FOUND");
    }
  });

  it("rejects when TeamSeason is not found", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(null as never);
    const result = await createProviderMapping(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TEAM_SEASON_NOT_FOUND");
    }
  });
});

// ── F. removeProviderMapping ───────────────────────────────────────────────────

describe("F. removeProviderMapping", () => {
  it("returns ok: true when mapping exists and belongs to tenant", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst).mockResolvedValue(
      { id: MAPPING_ID } as never,
    );
    vi.mocked(prisma.teamExternalMapping.update).mockResolvedValue({} as never);

    const result = await removeProviderMapping(TENANT_A, MAPPING_ID);
    expect(result.ok).toBe(true);
  });

  it("sets teamSeasonId to null (preserves row)", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst).mockResolvedValue(
      { id: MAPPING_ID } as never,
    );
    vi.mocked(prisma.teamExternalMapping.update).mockResolvedValue({} as never);

    await removeProviderMapping(TENANT_A, MAPPING_ID);
    expect(prisma.teamExternalMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamSeasonId: null }),
      }),
    );
  });

  it("returns MAPPING_NOT_FOUND when mapping does not exist", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst).mockResolvedValue(null as never);

    const result = await removeProviderMapping(TENANT_A, "non-existent");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("MAPPING_NOT_FOUND");
    }
  });

  it("rejects when mapping belongs to different tenant", async () => {
    // findFirst returns null when tenantId does not match
    vi.mocked(prisma.teamExternalMapping.findFirst).mockResolvedValue(null as never);

    const result = await removeProviderMapping(TENANT_B, MAPPING_ID);
    expect(result.ok).toBe(false);
  });
});

// ── G. validateProviderMapping ─────────────────────────────────────────────────

describe("G. validateProviderMapping", () => {
  it("returns valid: true on happy path", async () => {
    const result = await validateProviderMapping(baseInput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accumulates multiple errors", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(null as never);
    vi.mocked(getProviderAdapter).mockReturnValue(undefined);

    const result = await validateProviderMapping({ ...baseInput, provider: "UNKNOWN" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("includes error for archived TeamSeason", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
      ...mockTeamSeason,
      status: "ARCHIVED",
    } as never);

    const result = await validateProviderMapping(baseInput);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("archiv"))).toBe(true);
  });
});

// ── H. replaceProviderMapping — corrective (TEAM-PROVIDER-01-V) ───────────────

describe("H. replaceProviderMapping — atomic transaction", () => {
  const existingMappingId = "mapping-existing";

  beforeEach(() => {
    // Mock existing mapping lookup
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockResolvedValueOnce({ id: existingMappingId, provider: "SFV", teamSeasonId: TEAM_SEASON_ID } as never)
      // No other mapping for this external team
      .mockResolvedValueOnce(null as never);

    // validateProviderMapping needs teamSeason + no archived competition
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(mockTeamSeason as never);

    // $transaction mock: execute the callback with a minimal tx client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const txClient = {
        teamExternalMapping: {
          update: vi.fn().mockResolvedValue({}),
          upsert: vi.fn().mockResolvedValue(mockMappingRow),
        },
        teamSeason: {
          findFirstOrThrow: vi.fn().mockResolvedValue({ teamId: TEAM_ID }),
        },
      };
      return cb(txClient);
    });
  });

  it("returns ok: true on successful replace", async () => {
    const result = await replaceProviderMapping(TENANT_A, existingMappingId, baseInput);
    expect(result.ok).toBe(true);
  });

  it("uses $transaction (not separate updates)", async () => {
    await replaceProviderMapping(TENANT_A, existingMappingId, baseInput);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("returns TEAM_SEASON_NOT_FOUND when existing mapping not found", async () => {
    // Override: no existing mapping for this specific test
    vi.mocked(prisma.teamExternalMapping.findFirst).mockReset().mockResolvedValue(null as never);
    const result = await replaceProviderMapping(TENANT_A, "non-existent", baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TEAM_SEASON_NOT_FOUND");
  });

  it("returns EXTERNAL_TEAM_ALREADY_MAPPED when external team is mapped elsewhere", async () => {
    // Override: first returns existing mapping, second returns a conflict
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce({ id: existingMappingId, provider: "SFV", teamSeasonId: TEAM_SEASON_ID } as never)
      .mockResolvedValueOnce({ id: "other-mapping" } as never);

    const result = await replaceProviderMapping(TENANT_A, existingMappingId, baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("EXTERNAL_TEAM_ALREADY_MAPPED");
  });
});
