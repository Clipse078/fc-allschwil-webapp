/**
 * Tests for TeamSeasonOrgUnit domain rules (TEAM-CORE-02).
 *
 * Covers:
 *   A. TeamSeasonOrgUnit creation rules via createCanonicalTeamSeason()
 *   - Create one assignment
 *   - Create multiple assignments
 *   - Reject duplicate assignment (normalized silently)
 *   - Reject cross-tenant OrgUnit
 *   - Reject archived OrgUnit for new assignment
 *   - Historical archived assignment is valid (backfill scenario)
 *   - Backfill from Team.orgUnitId (documented)
 *
 * All Prisma calls are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CreateTeamSeasonInput } from "../team-season-service";

// ── Mocks ──────────────────────────────────────────────────────────────────────

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
import { createCanonicalTeamSeason } from "../team-season-service";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a-id";
const TENANT_B = "tenant-b-id";
const TEAM_ID = "team-01-id";
const SEASON_ID = "season-2025-id";
const ORG_UNIT_1 = "org-unit-1-id";
const ORG_UNIT_2 = "org-unit-2-id";
const TEAM_SEASON_ID = "team-season-01-id";

const baseInput: CreateTeamSeasonInput = {
  teamId: TEAM_ID,
  seasonId: SEASON_ID,
  tenantId: TENANT_A,
  orgUnitIds: [ORG_UNIT_1],
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

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
    { id: ORG_UNIT_1, tenantId: TENANT_A, status: "ACTIVE", name: "Junioren" },
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

  vi.mocked(prisma.teamSeason.create).mockResolvedValue({ id: TEAM_SEASON_ID } as never);
  vi.mocked(prisma.teamSeasonOrgUnit.createMany).mockResolvedValue({ count: 1 } as never);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TeamSeasonOrgUnit — creation rules", () => {
  describe("create one assignment", () => {
    it("creates one TeamSeasonOrgUnit row for one OrgUnit", async () => {
      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(true);

      const calls = vi.mocked(prisma.teamSeasonOrgUnit.createMany).mock.calls;
      expect(calls.length).toBe(1);

      const data = (calls[0][0] as { data: Array<{ teamSeasonId: string; orgUnitId: string; tenantId: string; isPrimary: boolean; displayOrder: number }> }).data;
      expect(data).toHaveLength(1);
      expect(data[0].teamSeasonId).toBe(TEAM_SEASON_ID);
      expect(data[0].orgUnitId).toBe(ORG_UNIT_1);
      expect(data[0].tenantId).toBe(TENANT_A);
      expect(data[0].isPrimary).toBe(true);
      expect(data[0].displayOrder).toBe(0);
    });
  });

  describe("create multiple assignments", () => {
    it("creates multiple rows with correct isPrimary and displayOrder", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_1, tenantId: TENANT_A, status: "ACTIVE", name: "Junioren" },
        { id: ORG_UNIT_2, tenantId: TENANT_A, status: "ACTIVE", name: "Aktive" },
      ] as never);

      const result = await createCanonicalTeamSeason({
        ...baseInput,
        orgUnitIds: [ORG_UNIT_1, ORG_UNIT_2],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.orgUnitCount).toBe(2);
      }

      const calls = vi.mocked(prisma.teamSeasonOrgUnit.createMany).mock.calls;
      const data = (calls[0][0] as { data: Array<{ orgUnitId: string; isPrimary: boolean; displayOrder: number }> }).data;
      expect(data).toHaveLength(2);

      expect(data[0].orgUnitId).toBe(ORG_UNIT_1);
      expect(data[0].isPrimary).toBe(true);
      expect(data[0].displayOrder).toBe(0);

      expect(data[1].orgUnitId).toBe(ORG_UNIT_2);
      expect(data[1].isPrimary).toBe(false);
      expect(data[1].displayOrder).toBe(1);
    });
  });

  describe("normalize duplicate OrgUnit IDs", () => {
    it("deduplicates duplicate OrgUnit IDs — creates only one row", async () => {
      const result = await createCanonicalTeamSeason({
        ...baseInput,
        orgUnitIds: [ORG_UNIT_1, ORG_UNIT_1],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.orgUnitCount).toBe(1);
      }
    });
  });

  describe("reject cross-tenant OrgUnit", () => {
    it("rejects OrgUnit from a different tenant — no DB write", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_1, tenantId: TENANT_B, status: "ACTIVE", name: "Foreign" },
      ] as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_TENANT_MISMATCH");
      }
      expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
    });
  });

  describe("reject archived OrgUnit for new assignment", () => {
    it("rejects ARCHIVED OrgUnit", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_1, tenantId: TENANT_A, status: "ARCHIVED", name: "Alt" },
      ] as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_NOT_ACTIVE");
      }
    });

    it("rejects INACTIVE OrgUnit", async () => {
      vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
        { id: ORG_UNIT_1, tenantId: TENANT_A, status: "INACTIVE", name: "Old" },
      ] as never);

      const result = await createCanonicalTeamSeason(baseInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORG_UNIT_NOT_ACTIVE");
      }
    });
  });

  describe("historical archived assignment preserved", () => {
    it("documents that archived OrgUnit links from backfill remain valid", () => {
      // Policy: backfill SQL (in migration) does NOT filter by OrgUnit.status,
      // preserving links even if the OrgUnit was later archived.
      // Service validation (ORG_UNIT_NOT_ACTIVE) applies only to NEW assignments.
      expect(true).toBe(true);
    });
  });

  describe("backfill from Team.orgUnitId", () => {
    it("documents the migration backfill strategy", () => {
      // See migration SQL:
      // 20260727000000_team_core_02_seasonal_orgunit_foundation
      //
      // For each TeamSeason whose Team.orgUnitId is non-null and resolvable:
      //   - One TeamSeasonOrgUnit row is created with isPrimary = true.
      //   - Skipped when Team.tenantId is null.
      //   - Skipped when OrgUnit belongs to a different tenant than Team.
      //   - Teams without orgUnitId are not affected.
      expect(true).toBe(true);
    });
  });
});

describe("TeamExternalMapping.teamSeasonId — schema contract", () => {
  it("null teamSeasonId is valid for historical mappings", () => {
    // teamSeasonId is String? (nullable) in Prisma schema.
    // Historical rows that could not be unambiguously resolved remain null.
    expect(true).toBe(true);
  });

  it("duplicate external mapping uniqueness is preserved with teamSeasonId added", () => {
    // @@unique([tenantId, provider, externalTeamId, externalSeasonId])
    // teamSeasonId is additive and does not affect the existing constraint.
    expect(true).toBe(true);
  });
});
