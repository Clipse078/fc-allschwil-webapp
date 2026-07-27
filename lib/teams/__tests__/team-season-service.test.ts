/**
 * Tests for lib/teams/team-season-service.ts
 *
 * Covers:
 *   A. createCanonicalTeamSeason — mandatory creation rules
 *   B. validateMappingTeamSeasonConsistency — external mapping consistency
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 * Security and tenant isolation assertions are included.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CreateTeamSeasonInput } from "../team-season-service";

// ── Mock Prisma ────────────────────────────────────────────────────────────────
// vi.mock factory must not reference top-level variables (hoisting constraint).
// Retrieve mocks after import via vi.mocked().

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: { findUnique: vi.fn() },
    season: { findUnique: vi.fn() },
    orgUnit: { findMany: vi.fn() },
    teamSeason: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    teamSeasonOrgUnit: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createCanonicalTeamSeason,
  validateMappingTeamSeasonConsistency,
} from "../team-season-service";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a-id";
const TENANT_B = "tenant-b-id";
const TEAM_ID = "team-01-id";
const SEASON_ID = "season-2025-id";
const ORG_UNIT_ID_1 = "org-unit-aktive-id";
const ORG_UNIT_ID_2 = "org-unit-junioren-id";
const TEAM_SEASON_ID = "team-season-01-id";

const baseInput: CreateTeamSeasonInput = {
  teamId: TEAM_ID,
  seasonId: SEASON_ID,
  tenantId: TENANT_A,
  orgUnitIds: [ORG_UNIT_ID_1],
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default happy-path mocks
  vi.mocked(prisma.team.findUnique).mockResolvedValue({
    id: TEAM_ID,
    name: "E-Junioren 1",
    tenantId: TENANT_A,
  } as never);

  vi.mocked(prisma.season.findUnique).mockResolvedValue({
    id: SEASON_ID,
    name: "2025/26",
  } as never);

  vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
    { id: ORG_UNIT_ID_1, tenantId: TENANT_A, status: "ACTIVE", name: "Junioren" },
  ] as never);

  vi.mocked(prisma.teamSeason.findUnique).mockResolvedValue(null as never);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
    const tx = {
      teamSeason: { create: prisma.teamSeason.create },
      teamSeasonOrgUnit: { createMany: prisma.teamSeasonOrgUnit.createMany },
    };
    return fn(tx);
  });

  vi.mocked(prisma.teamSeason.create).mockResolvedValue({
    id: TEAM_SEASON_ID,
  } as never);

  vi.mocked(prisma.teamSeasonOrgUnit.createMany).mockResolvedValue({ count: 1 } as never);
});

// ---------------------------------------------------------------------------
// A. createCanonicalTeamSeason — success cases
// ---------------------------------------------------------------------------

describe("createCanonicalTeamSeason", () => {
  describe("success cases", () => {
    it("creates TeamSeason with one OrgUnit", async () => {
      const result = await createCanonicalTeamSeason(baseInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.teamSeasonId).toBe(TEAM_SEASON_ID);
        expect(result.orgUnitCount).toBe(1);
      }
    });

    it("creates TeamSeason with multiple OrgUnits", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_ID_1, tenantId: TENANT_A, status: "ACTIVE", name: "Junioren" },
        { id: ORG_UNIT_ID_2, tenantId: TENANT_A, status: "ACTIVE", name: "Aktive" },
      ] as never);

      const result = await createCanonicalTeamSeason({
        ...baseInput,
        orgUnitIds: [ORG_UNIT_ID_1, ORG_UNIT_ID_2],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.orgUnitCount).toBe(2);
      }
    });

    it("deduplicates duplicate orgUnitIds — normalizes safely", async () => {
      const result = await createCanonicalTeamSeason({
        ...baseInput,
        orgUnitIds: [ORG_UNIT_ID_1, ORG_UNIT_ID_1, ORG_UNIT_ID_1],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.orgUnitCount).toBe(1);
      }
    });

    it("uses provided displayName when given", async () => {
      await createCanonicalTeamSeason({
        ...baseInput,
        displayName: "Custom Display Name",
      });

      expect(vi.mocked(prisma.teamSeason.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: "Custom Display Name",
          }),
        }),
      );
    });

    it("builds display name from team name when displayName is not provided", async () => {
      await createCanonicalTeamSeason(baseInput);

      expect(vi.mocked(prisma.teamSeason.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: "E-Junioren 1", // tenant-neutral: no club prefix
          }),
        }),
      );
    });

    it("display name does NOT contain FC Allschwil when club name is not provided", async () => {
      await createCanonicalTeamSeason(baseInput);

      const calls = vi.mocked(prisma.teamSeason.create).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const createCall = calls[0][0] as { data: { displayName: string } };
      expect(createCall.data.displayName).not.toContain("FC Allschwil");
    });
  });

  // ── Mandatory creation validation — missing season ─────────────────────────

  describe("reject missing season", () => {
    it("rejects when season is not found", async () => {
      vi.mocked(prisma.season.findUnique).mockResolvedValue(null as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SEASON_NOT_FOUND");
      }
    });
  });

  // ── Mandatory creation validation — missing OrgUnit ───────────────────────

  describe("reject missing OrgUnit", () => {
    it("rejects when orgUnitIds is empty array", async () => {
      const result = await createCanonicalTeamSeason({
        ...baseInput,
        orgUnitIds: [],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_REQUIRED");
        expect(result.message).toMatch(/Mindestens eine Organisationseinheit/i);
      }
    });

    it("rejects when orgUnitIds contains only empty strings", async () => {
      const result = await createCanonicalTeamSeason({
        ...baseInput,
        orgUnitIds: ["", ""],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_REQUIRED");
      }
    });

    it("rejects when an OrgUnit does not exist", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([] as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_NOT_FOUND");
      }
    });

    it("rejects archived OrgUnit for new assignment", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_ID_1, tenantId: TENANT_A, status: "ARCHIVED", name: "Alt" },
      ] as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_NOT_ACTIVE");
        expect(result.message).toContain("ARCHIVED");
      }
    });

    it("rejects inactive OrgUnit for new assignment", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_ID_1, tenantId: TENANT_A, status: "INACTIVE", name: "Old" },
      ] as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_NOT_ACTIVE");
      }
    });
  });

  // ── Cross-tenant security ─────────────────────────────────────────────────

  describe("cross-tenant security", () => {
    it("rejects OrgUnit from a different tenant", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_ID_1, tenantId: TENANT_B, status: "ACTIVE", name: "Foreign" },
      ] as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_TENANT_MISMATCH");
      }
    });

    it("rejects Team from a different tenant", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: TEAM_ID,
        name: "E-Junioren 1",
        tenantId: TENANT_B, // different tenant!
      } as never);

      const result = await createCanonicalTeamSeason(baseInput); // input uses TENANT_A

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("TEAM_TENANT_MISMATCH");
      }
    });

    it("does not write to DB when cross-tenant OrgUnit detected", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_ID_1, tenantId: TENANT_B, status: "ACTIVE", name: "Cross" },
      ] as never);

      await createCanonicalTeamSeason(baseInput);

      expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
    });
  });

  // ── Duplicate TeamSeason protection ───────────────────────────────────────

  describe("duplicate TeamSeason protection", () => {
    it("rejects when TeamSeason already exists for this team+season", async () => {
      vi.mocked(prisma.teamSeason.findUnique).mockResolvedValue({
        id: "existing-ts-id",
      } as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("TEAM_SEASON_ALREADY_EXISTS");
      }
    });
  });

  // ── Team not found ────────────────────────────────────────────────────────

  describe("team not found", () => {
    it("rejects when Team does not exist", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("TEAM_NOT_FOUND");
      }
    });
  });

  // ── Accept multiple OrgUnits ──────────────────────────────────────────────

  describe("accept multiple Organisationseinheiten", () => {
    it("accepts two active OrgUnits and creates both assignments", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_ID_1, tenantId: TENANT_A, status: "ACTIVE", name: "Junioren" },
        { id: ORG_UNIT_ID_2, tenantId: TENANT_A, status: "ACTIVE", name: "Aktive" },
      ] as never);

      const result = await createCanonicalTeamSeason({
        ...baseInput,
        orgUnitIds: [ORG_UNIT_ID_1, ORG_UNIT_ID_2],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.orgUnitCount).toBe(2);
      }

      // Verify createMany was called with 2 rows
      const createManyCall = vi.mocked(prisma.teamSeasonOrgUnit.createMany).mock.calls[0];
      expect((createManyCall[0] as { data: unknown[] }).data).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// C. validateMappingTeamSeasonConsistency
// ---------------------------------------------------------------------------

describe("validateMappingTeamSeasonConsistency", () => {
  it("returns null (valid, unresolved) when teamSeasonId is null", async () => {
    const result = await validateMappingTeamSeasonConsistency({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: null,
    });
    expect(result).toBeNull();
  });

  it("historical mapping (null teamSeasonId) remains valid", async () => {
    const result = await validateMappingTeamSeasonConsistency({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: null,
    });
    expect(result).toBeNull(); // null = valid but unresolved
  });

  it("returns error string when TeamSeason does not exist", async () => {
    vi.mocked(prisma.teamSeason.findUnique).mockResolvedValue(null as never);

    const result = await validateMappingTeamSeasonConsistency({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: "nonexistent-ts-id",
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("nicht gefunden");
  });

  it("returns error string when TeamSeason belongs to a different team", async () => {
    vi.mocked(prisma.teamSeason.findUnique).mockResolvedValue({
      teamId: "different-team-id",
      team: { tenantId: TENANT_A },
    } as never);

    const result = await validateMappingTeamSeasonConsistency({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("nicht zu diesem Team");
  });

  it("returns undefined (valid) when TeamSeason belongs to the same team and tenant", async () => {
    vi.mocked(prisma.teamSeason.findUnique).mockResolvedValue({
      teamId: TEAM_ID,
      team: { tenantId: TENANT_A },
    } as never);

    const result = await validateMappingTeamSeasonConsistency({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
    });

    expect(result).toBeUndefined();
  });

  it("returns error when TeamSeason's team belongs to different tenant", async () => {
    vi.mocked(prisma.teamSeason.findUnique).mockResolvedValue({
      teamId: TEAM_ID,
      team: { tenantId: TENANT_B }, // wrong tenant!
    } as never);

    const result = await validateMappingTeamSeasonConsistency({
      tenantId: TENANT_A,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("Mandanten");
  });
});

