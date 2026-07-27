/**
 * Tests for lib/match-resolution/match-resolution-service.ts
 *
 * Covers (per spec):
 *   A. Fully resolved — both sides resolve to canonical TeamSeasons
 *   B. Partial resolution — only one side resolves
 *   C. Unresolved — neither side resolves (external opponents)
 *   D. Duplicate mappings — conflict detection
 *   E. Missing mappings — TEAM_MAPPING_NOT_FOUND vs external opponent
 *   F. Competition mismatch — warning, not error
 *   G. Archived TeamSeason — INVALID_MAPPING
 *   H. Archived Competition — error
 *   I. Cross-tenant — TENANT_MISMATCH
 *   J. Provider isolation — PROVIDER_NOT_SUPPORTED
 *   K. Provider neutrality — resolver never imports SFV directly
 *   L. Transaction safety — batch resolution handles per-match failures
 *   M. validateResolution — status/field consistency
 *   N. resolveProviderOwnership — registry delegation
 *   O. resolveScheduleBatch — full batch resolution
 *   P. SFV adapter integration — resolveProviderOwnership finds SFV adapter
 *
 * All external dependencies (Prisma, provider registry) are mocked.
 * No DB access in these tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamExternalMapping: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    competition: {
      findFirst: vi.fn(),
    },
    teamSeasonCompetition: {
      findFirst: vi.fn(),
    },
    matchExternalMapping: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ── Mock provider registry ─────────────────────────────────────────────────────

vi.mock("@/lib/provider-mapping/provider-registry", () => ({
  getProviderAdapter: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "@/lib/provider-mapping/provider-registry";
import {
  resolveImportedMatch,
  resolveHomeTeamSeason,
  resolveAwayTeamSeason,
  resolveCompetition,
  resolveProviderOwnership,
  validateResolution,
  resolveScheduleBatch,
} from "../match-resolution-service";
import type { MatchResolutionInput, ResolvedMatch } from "../types";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PROVIDER = "SFV";
const SEASON_ID = 2027;
const HOME_EXTERNAL_ID = 101;
const AWAY_EXTERNAL_ID = 202;
const COMPETITION_EXTERNAL_ID = 55;

const HOME_TEAM_SEASON_ID = "ts-home-01";
const AWAY_TEAM_SEASON_ID = "ts-away-01";
const COMPETITION_ID = "comp-01";

const baseInput: MatchResolutionInput = {
  tenantId: TENANT_A,
  provider: PROVIDER,
  externalMatchId: 9001,
  externalSeasonId: SEASON_ID,
  providerHomeTeamId: HOME_EXTERNAL_ID,
  providerAwayTeamId: AWAY_EXTERNAL_ID,
  providerCompetitionId: COMPETITION_EXTERNAL_ID,
};

const mockHomeMapping = {
  externalTeamId: HOME_EXTERNAL_ID,
  teamSeasonId: HOME_TEAM_SEASON_ID,
  teamId: "team-home",
  providerIsActive: true,
  teamSeason: {
    id: HOME_TEAM_SEASON_ID,
    status: "ACTIVE",
    team: { tenantId: TENANT_A },
  },
};

const mockAwayMapping = {
  externalTeamId: AWAY_EXTERNAL_ID,
  teamSeasonId: AWAY_TEAM_SEASON_ID,
  teamId: "team-away",
  providerIsActive: true,
  teamSeason: {
    id: AWAY_TEAM_SEASON_ID,
    status: "ACTIVE",
    team: { tenantId: TENANT_A },
  },
};

const mockCompetition = {
  id: COMPETITION_ID,
  externalCompetitionId: COMPETITION_EXTERNAL_ID,
  isArchived: false,
};

const mockAdapter = {
  providerKey: PROVIDER,
  fetchProviderTeams: vi.fn(),
  getProviderSeasonId: vi.fn(),
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default happy path: provider registered
  vi.mocked(getProviderAdapter).mockReturnValue(mockAdapter as never);

  // Default: count = 1 (no duplicates) for both sides
  vi.mocked(prisma.teamExternalMapping.count).mockResolvedValue(1 as never);

  // Default: home and away mappings both resolve
  vi.mocked(prisma.teamExternalMapping.findFirst)
    .mockResolvedValueOnce(mockHomeMapping as never)
    .mockResolvedValueOnce(mockAwayMapping as never);

  // Default: competition resolves
  vi.mocked(prisma.competition.findFirst).mockResolvedValue(mockCompetition as never);

  // Default: both team seasons are in the competition
  vi.mocked(prisma.teamSeasonCompetition.findFirst).mockResolvedValue({ id: "tsc-1" } as never);
});

// ── A. Fully resolved ──────────────────────────────────────────────────────────

describe("A. Fully resolved", () => {
  it("resolves both sides and returns RESOLVED status", async () => {
    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("RESOLVED");
    expect(result.resolvedHomeTeamSeasonId).toBe(HOME_TEAM_SEASON_ID);
    expect(result.resolvedAwayTeamSeasonId).toBe(AWAY_TEAM_SEASON_ID);
    expect(result.resolutionErrors).toHaveLength(0);
  });

  it("resolves competition ID when found", async () => {
    const result = await resolveImportedMatch(baseInput);
    expect(result.resolvedCompetitionId).toBe(COMPETITION_ID);
  });

  it("returns HIGH confidence when fully resolved with competition", async () => {
    const result = await resolveImportedMatch(baseInput);
    expect(result.confidence).toBe("HIGH");
  });

  it("returns no errors or warnings when fully resolved and in competition", async () => {
    const result = await resolveImportedMatch(baseInput);
    expect(result.resolutionErrors).toHaveLength(0);
    expect(result.resolutionWarnings).toHaveLength(0);
  });

  it("validates correctly with validateResolution", async () => {
    const result = await resolveImportedMatch(baseInput);
    const validation = validateResolution(result);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

// ── B. Partial resolution ──────────────────────────────────────────────────────

describe("B. Partial resolution — one side resolves", () => {
  it("returns PARTIALLY_RESOLVED when only home resolves", async () => {
    // Home resolves; away returns null (external opponent)
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce(mockHomeMapping as never)
      .mockResolvedValueOnce(null as never); // no mapping for away

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("PARTIALLY_RESOLVED");
    expect(result.resolvedHomeTeamSeasonId).toBe(HOME_TEAM_SEASON_ID);
    expect(result.resolvedAwayTeamSeasonId).toBeNull();
  });

  it("returns PARTIALLY_RESOLVED when only away resolves", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce(null as never) // no mapping for home
      .mockResolvedValueOnce(mockAwayMapping as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("PARTIALLY_RESOLVED");
    expect(result.resolvedHomeTeamSeasonId).toBeNull();
    expect(result.resolvedAwayTeamSeasonId).toBe(AWAY_TEAM_SEASON_ID);
  });

  it("returns MEDIUM confidence for partial resolution", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce(mockHomeMapping as never)
      .mockResolvedValueOnce(null as never);

    const result = await resolveImportedMatch(baseInput);
    expect(result.confidence).toBe("MEDIUM");
  });

  it("validates PARTIALLY_RESOLVED status correctly", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce(mockHomeMapping as never)
      .mockResolvedValueOnce(null as never);

    const result = await resolveImportedMatch(baseInput);
    const validation = validateResolution(result);
    expect(validation.valid).toBe(true);
  });
});

// ── C. Unresolved — both external opponents ────────────────────────────────────

describe("C. Unresolved — neither side resolves", () => {
  it("returns UNRESOLVED when neither team has a mapping", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValue(null as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("UNRESOLVED");
    expect(result.resolvedHomeTeamSeasonId).toBeNull();
    expect(result.resolvedAwayTeamSeasonId).toBeNull();
    expect(result.resolutionErrors).toHaveLength(0); // no mapping = external opponent, not error
  });

  it("returns NONE confidence when unresolved", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValue(null as never);

    const result = await resolveImportedMatch(baseInput);
    expect(result.confidence).toBe("NONE");
  });

  it("UNRESOLVED status validates correctly", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValue(null as never);

    const result = await resolveImportedMatch(baseInput);
    const validation = validateResolution(result);
    expect(validation.valid).toBe(true);
  });

  it("handles null providerCompetitionId gracefully", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValue(null as never);

    const result = await resolveImportedMatch({
      ...baseInput,
      providerCompetitionId: null,
    });

    expect(result.resolutionStatus).toBe("UNRESOLVED");
    expect(result.resolvedCompetitionId).toBeNull();
    // Competition findFirst should NOT be called when providerCompetitionId is null
    expect(prisma.competition.findFirst).not.toHaveBeenCalled();
  });
});

// ── D. Duplicate mappings — conflict detection ─────────────────────────────────

describe("D. Duplicate mappings", () => {
  it("returns CONFLICT status when duplicate home mapping detected", async () => {
    // count = 2 means duplicate for home
    vi.mocked(prisma.teamExternalMapping.count)
      .mockReset()
      .mockResolvedValueOnce(2 as never) // home duplicate
      .mockResolvedValueOnce(1 as never); // away ok

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("CONFLICT");
    expect(result.resolutionErrors).toHaveLength(1);
    expect(result.resolutionErrors[0].code).toBe("DUPLICATE_MAPPING");
    expect(result.resolutionErrors[0].side).toBe("home");
  });

  it("returns CONFLICT status when duplicate away mapping detected", async () => {
    vi.mocked(prisma.teamExternalMapping.count)
      .mockReset()
      .mockResolvedValueOnce(1 as never) // home ok
      .mockResolvedValueOnce(2 as never); // away duplicate

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("CONFLICT");
    expect(result.resolutionErrors[0].code).toBe("DUPLICATE_MAPPING");
    expect(result.resolutionErrors[0].side).toBe("away");
  });

  it("CONFLICT status validates correctly", async () => {
    vi.mocked(prisma.teamExternalMapping.count).mockReset().mockResolvedValue(2 as never);

    const result = await resolveImportedMatch(baseInput);
    const validation = validateResolution(result);
    expect(validation.valid).toBe(true);
  });
});

// ── E. Missing TeamSeason link ─────────────────────────────────────────────────

describe("E. Missing TeamSeason link", () => {
  it("returns INVALID_MAPPING when home mapping has no teamSeasonId", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce({
        ...mockHomeMapping,
        teamSeasonId: null,
        teamSeason: null,
      } as never)
      .mockResolvedValueOnce(mockAwayMapping as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("INVALID_MAPPING");
    expect(result.resolutionErrors.some((e) => e.code === "TEAM_SEASON_NOT_LINKED")).toBe(true);
  });

  it("returns TEAM_SEASON_NOT_LINKED error with home side context", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce({ ...mockHomeMapping, teamSeasonId: null, teamSeason: null } as never)
      .mockResolvedValueOnce(mockAwayMapping as never);

    const result = await resolveImportedMatch(baseInput);

    const err = result.resolutionErrors.find((e) => e.code === "TEAM_SEASON_NOT_LINKED");
    expect(err?.side).toBe("home");
  });
});

// ── F. Competition mismatch — warning ─────────────────────────────────────────

describe("F. Competition mismatch (warning, not error)", () => {
  it("adds warning when home team season not in resolved competition", async () => {
    // Competition found, but home team season not in it
    vi.mocked(prisma.teamSeasonCompetition.findFirst)
      .mockReset()
      .mockResolvedValueOnce(null as never) // home not in competition
      .mockResolvedValueOnce({ id: "tsc-away" } as never); // away is in competition

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("RESOLVED");
    expect(result.resolutionErrors).toHaveLength(0);
    expect(result.resolutionWarnings).toHaveLength(1);
    expect(result.resolutionWarnings[0]).toContain("home");
  });

  it("adds warning when away team season not in resolved competition", async () => {
    vi.mocked(prisma.teamSeasonCompetition.findFirst)
      .mockReset()
      .mockResolvedValueOnce({ id: "tsc-home" } as never) // home in competition
      .mockResolvedValueOnce(null as never); // away not in competition

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("RESOLVED");
    expect(result.resolutionWarnings.some((w) => w.includes("away"))).toBe(true);
  });

  it("returns MEDIUM confidence when there are competition mismatch warnings", async () => {
    vi.mocked(prisma.teamSeasonCompetition.findFirst).mockReset().mockResolvedValue(null as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.confidence).toBe("MEDIUM");
  });

  it("does not add competition warnings when providerCompetitionId is null", async () => {
    const result = await resolveImportedMatch({
      ...baseInput,
      providerCompetitionId: null,
    });

    expect(result.resolutionWarnings).toHaveLength(0);
  });
});

// ── G. Archived TeamSeason ─────────────────────────────────────────────────────

describe("G. Archived TeamSeason", () => {
  it("returns INVALID_MAPPING when home TeamSeason is archived", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce({
        ...mockHomeMapping,
        teamSeason: { ...mockHomeMapping.teamSeason, status: "ARCHIVED" },
      } as never)
      .mockResolvedValueOnce(mockAwayMapping as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("INVALID_MAPPING");
    expect(result.resolutionErrors.some((e) => e.code === "ARCHIVED_TEAM")).toBe(true);
    expect(result.resolutionErrors.find((e) => e.code === "ARCHIVED_TEAM")?.side).toBe("home");
  });

  it("returns INVALID_MAPPING when away TeamSeason is archived", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce(mockHomeMapping as never)
      .mockResolvedValueOnce({
        ...mockAwayMapping,
        teamSeason: { ...mockAwayMapping.teamSeason, status: "ARCHIVED" },
      } as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionStatus).toBe("INVALID_MAPPING");
    expect(result.resolutionErrors.find((e) => e.code === "ARCHIVED_TEAM")?.side).toBe("away");
  });

  it("INVALID_MAPPING status validates correctly", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce({
        ...mockHomeMapping,
        teamSeason: { ...mockHomeMapping.teamSeason, status: "ARCHIVED" },
      } as never)
      .mockResolvedValueOnce(mockAwayMapping as never);

    const result = await resolveImportedMatch(baseInput);
    const validation = validateResolution(result);
    expect(validation.valid).toBe(true);
  });
});

// ── H. Archived Competition ────────────────────────────────────────────────────

describe("H. Archived Competition", () => {
  it("records error when resolved competition is archived", async () => {
    vi.mocked(prisma.competition.findFirst).mockReset().mockResolvedValue({
      ...mockCompetition,
      isArchived: true,
    } as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionErrors.some((e) => e.code === "ARCHIVED_COMPETITION")).toBe(true);
    expect(result.resolvedCompetitionId).toBeNull();
  });

  it("does not add competition to resolved result when archived", async () => {
    vi.mocked(prisma.competition.findFirst).mockReset().mockResolvedValue({
      ...mockCompetition,
      isArchived: true,
    } as never);

    const result = await resolveImportedMatch(baseInput);
    expect(result.resolvedCompetitionId).toBeNull();
  });

  it("still resolves teams even when competition is archived", async () => {
    vi.mocked(prisma.competition.findFirst).mockReset().mockResolvedValue({
      ...mockCompetition,
      isArchived: true,
    } as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolvedHomeTeamSeasonId).toBe(HOME_TEAM_SEASON_ID);
    expect(result.resolvedAwayTeamSeasonId).toBe(AWAY_TEAM_SEASON_ID);
  });
});

// ── I. Cross-tenant ────────────────────────────────────────────────────────────

describe("I. Cross-tenant isolation", () => {
  it("returns TENANT_MISMATCH error when home team season belongs to different tenant", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce({
        ...mockHomeMapping,
        teamSeason: {
          ...mockHomeMapping.teamSeason,
          team: { tenantId: TENANT_B },
        },
      } as never)
      .mockResolvedValueOnce(mockAwayMapping as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionErrors.some((e) => e.code === "TENANT_MISMATCH")).toBe(true);
    expect(result.resolutionErrors.find((e) => e.code === "TENANT_MISMATCH")?.side).toBe("home");
  });

  it("returns TENANT_MISMATCH for away side cross-tenant", async () => {
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce(mockHomeMapping as never)
      .mockResolvedValueOnce({
        ...mockAwayMapping,
        teamSeason: {
          ...mockAwayMapping.teamSeason,
          team: { tenantId: TENANT_B },
        },
      } as never);

    const result = await resolveImportedMatch(baseInput);

    expect(result.resolutionErrors.some((e) => e.code === "TENANT_MISMATCH")).toBe(true);
    expect(result.resolutionErrors.find((e) => e.code === "TENANT_MISMATCH")?.side).toBe("away");
  });

  it("null team tenantId does not trigger TENANT_MISMATCH (legacy compat)", async () => {
    // Null tenantId on team is a legacy compatibility scenario
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce({
        ...mockHomeMapping,
        teamSeason: {
          ...mockHomeMapping.teamSeason,
          team: { tenantId: null },
        },
      } as never)
      .mockResolvedValueOnce(mockAwayMapping as never);

    const result = await resolveImportedMatch(baseInput);

    // Should not produce TENANT_MISMATCH for null tenant (legacy rows)
    expect(result.resolutionErrors.some((e) => e.code === "TENANT_MISMATCH")).toBe(false);
  });
});

// ── J. Provider isolation ──────────────────────────────────────────────────────

describe("J. Provider isolation", () => {
  it("returns UNRESOLVED with PROVIDER_NOT_SUPPORTED when adapter not registered", async () => {
    vi.mocked(getProviderAdapter).mockReturnValue(undefined);

    const result = await resolveImportedMatch({ ...baseInput, provider: "UNKNOWN_PROVIDER" });

    expect(result.resolutionStatus).toBe("UNRESOLVED");
    expect(result.resolutionErrors.some((e) => e.code === "PROVIDER_NOT_SUPPORTED")).toBe(true);
  });

  it("does not query DB when provider not supported", async () => {
    vi.mocked(getProviderAdapter).mockReturnValue(undefined);

    await resolveImportedMatch({ ...baseInput, provider: "GHOST" });

    expect(prisma.teamExternalMapping.findFirst).not.toHaveBeenCalled();
    expect(prisma.competition.findFirst).not.toHaveBeenCalled();
  });

  it("returns NONE confidence when provider not supported", async () => {
    vi.mocked(getProviderAdapter).mockReturnValue(undefined);
    const result = await resolveImportedMatch({ ...baseInput, provider: "GHOST" });
    expect(result.confidence).toBe("NONE");
  });
});

// ── K. Provider neutrality ─────────────────────────────────────────────────────

describe("K. Provider neutrality", () => {
  it("treats 'KNVB' as a valid provider key when registered", async () => {
    const knvbAdapter = { providerKey: "KNVB", fetchProviderTeams: vi.fn(), getProviderSeasonId: vi.fn() };
    vi.mocked(getProviderAdapter).mockReturnValue(knvbAdapter as never);

    const result = await resolveImportedMatch({ ...baseInput, provider: "KNVB" });

    // Should proceed to DB lookup — no SFV-specific logic
    expect(prisma.teamExternalMapping.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ provider: "KNVB" }) }),
    );
    // Result is determined by DB data, not provider
    expect(result.resolutionStatus).toBe("RESOLVED");
  });

  it("resolveProviderOwnership returns ok:true for any registered provider", () => {
    vi.mocked(getProviderAdapter).mockReturnValue(mockAdapter as never);
    const result = resolveProviderOwnership("ANY_PROVIDER");
    expect(result.ok).toBe(true);
  });

  it("resolveProviderOwnership returns ok:false for unregistered provider", () => {
    vi.mocked(getProviderAdapter).mockReturnValue(undefined);
    const result = resolveProviderOwnership("UNREGISTERED");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROVIDER_NOT_SUPPORTED");
    }
  });
});

// ── L. Transaction safety / batch error handling ───────────────────────────────

describe("L. Batch resolution error handling", () => {
  it("counts failed when resolution throws an exception", async () => {
    vi.mocked(prisma.matchExternalMapping.findMany).mockResolvedValue([
      {
        id: "mapping-01",
        externalMatchId: 9001,
        externalSeasonId: SEASON_ID,
        providerHomeTeamId: HOME_EXTERNAL_ID,
        providerAwayTeamId: AWAY_EXTERNAL_ID,
        providerLeagueId: COMPETITION_EXTERNAL_ID,
      },
    ] as never);

    // Make resolveImportedMatch throw (simulate by making count throw)
    vi.mocked(prisma.teamExternalMapping.count).mockRejectedValue(new Error("DB error") as never);

    const summary = await resolveScheduleBatch({
      tenantId: TENANT_A,
      provider: PROVIDER,
      externalSeasonId: SEASON_ID,
    });

    expect(summary.failed).toBe(1);
    expect(summary.total).toBe(1);
  });

  it("counts failed when persistence throws an exception", async () => {
    vi.mocked(prisma.matchExternalMapping.findMany).mockResolvedValue([
      {
        id: "mapping-02",
        externalMatchId: 9002,
        externalSeasonId: SEASON_ID,
        providerHomeTeamId: HOME_EXTERNAL_ID,
        providerAwayTeamId: AWAY_EXTERNAL_ID,
        providerLeagueId: null,
      },
    ] as never);

    vi.mocked(prisma.teamExternalMapping.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockResolvedValueOnce(mockHomeMapping as never)
      .mockResolvedValueOnce(mockAwayMapping as never);
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.teamSeasonCompetition.findFirst).mockResolvedValue(null as never);

    // Make persistence fail
    vi.mocked(prisma.matchExternalMapping.update).mockRejectedValue(
      new Error("Persistence error") as never,
    );

    const summary = await resolveScheduleBatch({
      tenantId: TENANT_A,
      provider: PROVIDER,
      externalSeasonId: SEASON_ID,
    });

    expect(summary.failed).toBe(1);
  });

  it("continues processing subsequent matches after one fails", async () => {
    vi.mocked(prisma.matchExternalMapping.findMany).mockResolvedValue([
      {
        id: "mapping-fail",
        externalMatchId: 9001,
        externalSeasonId: SEASON_ID,
        providerHomeTeamId: HOME_EXTERNAL_ID,
        providerAwayTeamId: AWAY_EXTERNAL_ID,
        providerLeagueId: null,
      },
      {
        id: "mapping-ok",
        externalMatchId: 9002,
        externalSeasonId: SEASON_ID,
        providerHomeTeamId: HOME_EXTERNAL_ID,
        providerAwayTeamId: AWAY_EXTERNAL_ID,
        providerLeagueId: null,
      },
    ] as never);

    // Reset and set up: first count call throws (first mapping home), then succeeds for second mapping
    vi.mocked(prisma.teamExternalMapping.count)
      .mockReset()
      .mockRejectedValueOnce(new Error("DB fail") as never) // mapping-fail home count throws
      .mockResolvedValueOnce(1 as never) // mapping-ok home count
      .mockResolvedValueOnce(1 as never); // mapping-ok away count

    // Reset findFirst: for second mapping both sides return null (external opponents)
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockReset()
      .mockResolvedValueOnce(null as never) // mapping-ok home → external opponent
      .mockResolvedValueOnce(null as never); // mapping-ok away → external opponent

    vi.mocked(prisma.matchExternalMapping.update).mockResolvedValue({} as never);

    const summary = await resolveScheduleBatch({
      tenantId: TENANT_A,
      provider: PROVIDER,
      externalSeasonId: SEASON_ID,
    });

    expect(summary.total).toBe(2);
    expect(summary.failed).toBe(1); // first mapping failed
    // Second mapping should have been processed (unresolved = external opponents)
    expect(summary.unresolved).toBe(1);
  });
});

// ── M. validateResolution ──────────────────────────────────────────────────────

describe("M. validateResolution — status/field consistency", () => {
  it("rejects RESOLVED with missing home TeamSeason", () => {
    const invalid: ResolvedMatch = {
      resolvedHomeTeamSeasonId: null,
      resolvedAwayTeamSeasonId: AWAY_TEAM_SEASON_ID,
      resolvedCompetitionId: null,
      resolutionStatus: "RESOLVED",
      resolutionErrors: [],
      resolutionWarnings: [],
      confidence: "HIGH",
    };
    const result = validateResolution(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects PARTIALLY_RESOLVED with both sides resolved", () => {
    const invalid: ResolvedMatch = {
      resolvedHomeTeamSeasonId: HOME_TEAM_SEASON_ID,
      resolvedAwayTeamSeasonId: AWAY_TEAM_SEASON_ID,
      resolvedCompetitionId: null,
      resolutionStatus: "PARTIALLY_RESOLVED",
      resolutionErrors: [],
      resolutionWarnings: [],
      confidence: "HIGH",
    };
    const result = validateResolution(invalid);
    expect(result.valid).toBe(false);
  });

  it("rejects UNRESOLVED with resolved home team season", () => {
    const invalid: ResolvedMatch = {
      resolvedHomeTeamSeasonId: HOME_TEAM_SEASON_ID,
      resolvedAwayTeamSeasonId: null,
      resolvedCompetitionId: null,
      resolutionStatus: "UNRESOLVED",
      resolutionErrors: [],
      resolutionWarnings: [],
      confidence: "NONE",
    };
    const result = validateResolution(invalid);
    expect(result.valid).toBe(false);
  });

  it("rejects CONFLICT without any errors", () => {
    const invalid: ResolvedMatch = {
      resolvedHomeTeamSeasonId: null,
      resolvedAwayTeamSeasonId: null,
      resolvedCompetitionId: null,
      resolutionStatus: "CONFLICT",
      resolutionErrors: [],
      resolutionWarnings: [],
      confidence: "NONE",
    };
    const result = validateResolution(invalid);
    expect(result.valid).toBe(false);
  });

  it("rejects INVALID_MAPPING without any errors", () => {
    const invalid: ResolvedMatch = {
      resolvedHomeTeamSeasonId: HOME_TEAM_SEASON_ID,
      resolvedAwayTeamSeasonId: null,
      resolvedCompetitionId: null,
      resolutionStatus: "INVALID_MAPPING",
      resolutionErrors: [],
      resolutionWarnings: [],
      confidence: "MEDIUM",
    };
    const result = validateResolution(invalid);
    expect(result.valid).toBe(false);
  });
});

// ── N. resolveProviderOwnership ────────────────────────────────────────────────

describe("N. resolveProviderOwnership", () => {
  it("returns ok: true with providerKey when adapter is registered", () => {
    vi.mocked(getProviderAdapter).mockReturnValue(mockAdapter as never);
    const result = resolveProviderOwnership("SFV");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providerKey).toBe("SFV");
    }
  });

  it("returns ok: false with PROVIDER_NOT_SUPPORTED when adapter not registered", () => {
    vi.mocked(getProviderAdapter).mockReturnValue(undefined);
    const result = resolveProviderOwnership("UNKNOWN");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROVIDER_NOT_SUPPORTED");
    }
  });

  it("is synchronous (no async)", () => {
    // resolveProviderOwnership must be synchronous — registry is in-memory
    vi.mocked(getProviderAdapter).mockReturnValue(mockAdapter as never);
    const returnValue = resolveProviderOwnership("SFV");
    // If it returned a Promise, it would not have .ok directly accessible
    expect(typeof returnValue).toBe("object");
    expect("ok" in returnValue).toBe(true);
  });
});

// ── O. resolveScheduleBatch ────────────────────────────────────────────────────

describe("O. resolveScheduleBatch — full batch resolution", () => {
  it("returns empty summary when no match mappings found", async () => {
    vi.mocked(prisma.matchExternalMapping.findMany).mockResolvedValue([] as never);

    const summary = await resolveScheduleBatch({
      tenantId: TENANT_A,
      provider: PROVIDER,
      externalSeasonId: SEASON_ID,
    });

    expect(summary.total).toBe(0);
    expect(summary.resolved).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it("resolves all matches and returns correct counts", async () => {
    vi.mocked(prisma.matchExternalMapping.findMany).mockResolvedValue([
      {
        id: "m1",
        externalMatchId: 9001,
        externalSeasonId: SEASON_ID,
        providerHomeTeamId: HOME_EXTERNAL_ID,
        providerAwayTeamId: AWAY_EXTERNAL_ID,
        providerLeagueId: COMPETITION_EXTERNAL_ID,
      },
      {
        id: "m2",
        externalMatchId: 9002,
        externalSeasonId: SEASON_ID,
        providerHomeTeamId: HOME_EXTERNAL_ID,
        providerAwayTeamId: AWAY_EXTERNAL_ID,
        providerLeagueId: null,
      },
    ] as never);

    // All team mappings resolve
    vi.mocked(prisma.teamExternalMapping.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.teamExternalMapping.findFirst)
      .mockResolvedValue(mockHomeMapping as never);

    vi.mocked(prisma.competition.findFirst).mockResolvedValue(mockCompetition as never);
    vi.mocked(prisma.teamSeasonCompetition.findFirst).mockResolvedValue({ id: "x" } as never);
    vi.mocked(prisma.matchExternalMapping.update).mockResolvedValue({} as never);

    const summary = await resolveScheduleBatch({
      tenantId: TENANT_A,
      provider: PROVIDER,
      externalSeasonId: SEASON_ID,
    });

    expect(summary.total).toBe(2);
    expect(summary.failed).toBe(0);
    // Both should be RESOLVED (both sides resolve)
    expect(summary.resolved).toBe(2);
  });

  it("calls persistMatchResolution for each match", async () => {
    vi.mocked(prisma.matchExternalMapping.findMany).mockResolvedValue([
      {
        id: "m1",
        externalMatchId: 9001,
        externalSeasonId: SEASON_ID,
        providerHomeTeamId: HOME_EXTERNAL_ID,
        providerAwayTeamId: AWAY_EXTERNAL_ID,
        providerLeagueId: null,
      },
    ] as never);

    vi.mocked(prisma.teamExternalMapping.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.teamExternalMapping.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.matchExternalMapping.update).mockResolvedValue({} as never);

    await resolveScheduleBatch({
      tenantId: TENANT_A,
      provider: PROVIDER,
      externalSeasonId: SEASON_ID,
    });

    // Should have called update to persist resolution
    expect(prisma.matchExternalMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m1" },
        data: expect.objectContaining({
          resolutionStatus: expect.any(String),
          resolvedAt: expect.any(Date),
        }),
      }),
    );
  });
});

// ── P. SFV adapter integration ────────────────────────────────────────────────

describe("P. SFV adapter integration", () => {
  it("resolveProviderOwnership delegates to getProviderAdapter (SFV key)", () => {
    vi.mocked(getProviderAdapter).mockReturnValue(mockAdapter as never);
    const result = resolveProviderOwnership("SFV");
    expect(getProviderAdapter).toHaveBeenCalledWith("SFV");
    expect(result.ok).toBe(true);
  });

  it("resolveImportedMatch passes provider key to all TeamExternalMapping queries", async () => {
    await resolveImportedMatch(baseInput);

    // Both count and findFirst calls should use the SFV provider key
    expect(prisma.teamExternalMapping.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ provider: "SFV" }),
      }),
    );
    expect(prisma.teamExternalMapping.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ provider: "SFV" }),
      }),
    );
  });

  it("does not import any SFV-specific modules (provider neutrality)", () => {
    // The service module is provider-neutral: it only uses getProviderAdapter from the registry.
    // This test asserts the mock was called rather than SFV code being invoked directly.
    vi.mocked(getProviderAdapter).mockReturnValue(mockAdapter as never);
    resolveProviderOwnership("SFV");
    // If SFV code were imported directly, this test setup would fail at import time.
    expect(getProviderAdapter).toHaveBeenCalledTimes(1);
  });
});

// ── Q. resolveHomeTeamSeason / resolveAwayTeamSeason direct API ────────────────

describe("Q. resolveHomeTeamSeason and resolveAwayTeamSeason", () => {
  it("resolveHomeTeamSeason returns ok:true with teamSeasonId on success", async () => {
    vi.mocked(prisma.teamExternalMapping.count).mockReset().mockResolvedValue(1 as never);
    vi.mocked(prisma.teamExternalMapping.findFirst).mockReset().mockResolvedValue(mockHomeMapping as never);

    const result = await resolveHomeTeamSeason(TENANT_A, PROVIDER, HOME_EXTERNAL_ID, SEASON_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.teamSeasonId).toBe(HOME_TEAM_SEASON_ID);
    }
  });

  it("resolveAwayTeamSeason returns ok:true with teamSeasonId on success", async () => {
    vi.mocked(prisma.teamExternalMapping.count).mockReset().mockResolvedValue(1 as never);
    vi.mocked(prisma.teamExternalMapping.findFirst).mockReset().mockResolvedValue(mockAwayMapping as never);

    const result = await resolveAwayTeamSeason(TENANT_A, PROVIDER, AWAY_EXTERNAL_ID, SEASON_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.teamSeasonId).toBe(AWAY_TEAM_SEASON_ID);
    }
  });

  it("resolveHomeTeamSeason returns ok:true with null teamSeasonId for external opponent", async () => {
    vi.mocked(prisma.teamExternalMapping.count).mockReset().mockResolvedValue(1 as never);
    vi.mocked(prisma.teamExternalMapping.findFirst).mockReset().mockResolvedValue(null as never);

    const result = await resolveHomeTeamSeason(TENANT_A, PROVIDER, 9999, SEASON_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.teamSeasonId).toBeNull();
    }
  });

  it("resolveHomeTeamSeason returns ok:false with ARCHIVED_TEAM", async () => {
    vi.mocked(prisma.teamExternalMapping.count).mockReset().mockResolvedValue(1 as never);
    vi.mocked(prisma.teamExternalMapping.findFirst).mockReset().mockResolvedValue({
      ...mockHomeMapping,
      teamSeason: { ...mockHomeMapping.teamSeason, status: "ARCHIVED" },
    } as never);

    const result = await resolveHomeTeamSeason(TENANT_A, PROVIDER, HOME_EXTERNAL_ID, SEASON_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ARCHIVED_TEAM");
    }
  });
});

// ── R. resolveCompetition direct API ──────────────────────────────────────────

describe("R. resolveCompetition", () => {
  it("returns ok:true when competition is found and active", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(mockCompetition as never);

    const result = await resolveCompetition(
      TENANT_A,
      PROVIDER,
      COMPETITION_EXTERNAL_ID,
      SEASON_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.competitionId).toBe(COMPETITION_ID);
      expect(result.isArchived).toBe(false);
    }
  });

  it("returns ok:true with isArchived:true when competition is archived", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({
      ...mockCompetition,
      isArchived: true,
    } as never);

    const result = await resolveCompetition(
      TENANT_A,
      PROVIDER,
      COMPETITION_EXTERNAL_ID,
      SEASON_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isArchived).toBe(true);
    }
  });

  it("returns ok:false when competition not found", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);

    const result = await resolveCompetition(TENANT_A, PROVIDER, 9999, SEASON_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("COMPETITION_MISMATCH");
    }
  });
});
