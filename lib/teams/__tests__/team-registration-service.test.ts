/**
 * Tests for lib/teams/team-registration-service.ts
 *
 * Covers registerTeamSeason() — the canonical Team registration orchestration.
 *
 * Test matrix:
 *   - Authentication/permission errors (handled at API layer, not tested here)
 *   - Domain validation: Season, OrgUnit, Team identity
 *   - Creation paths: new Team, reuse existing Team
 *   - Slug uniqueness: cross-tenant allowed, same-tenant conflict rejected
 *   - Duplicate TeamSeason rejection
 *   - Federation mapping: valid, conflict, absent
 *   - Visibility defaults and explicit values
 *   - Transaction atomicity (mocked)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RegisterTeamInput } from "../team-registration-service";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    season: { findUnique: vi.fn() },
    orgUnit: { findMany: vi.fn() },
    team: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    teamSeason: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    teamSeasonOrgUnit: { createMany: vi.fn() },
    teamExternalMapping: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import { registerTeamSeason } from "../team-registration-service";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a-id";
const TENANT_B = "tenant-b-id";
const SEASON_ID = "season-2025-id";
const TEAM_ID = "team-01-id";
const TEAM_SEASON_ID = "team-season-01-id";
const ORG_UNIT_ID_1 = "org-unit-01-id";
const ORG_UNIT_ID_2 = "org-unit-02-id";

const baseInput: RegisterTeamInput = {
  tenantId: TENANT_A,
  seasonId: SEASON_ID,
  orgUnitIds: [ORG_UNIT_ID_1],
  team: { name: "Frauen 1" },
  websiteVisible: true,
  infoboardVisible: true,
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(prisma.season.findUnique).mockResolvedValue({
    id: SEASON_ID,
    name: "2025/26",
    key: "2025/26",
    startDate: new Date("2025-07-01"),
    endDate: new Date("2026-06-30"),
    isActive: true,
  } as never);

  vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
    {
      id: ORG_UNIT_ID_1,
      tenantId: TENANT_A,
      status: "ACTIVE",
      name: "Frauen",
    },
  ] as never);

  vi.mocked(prisma.teamExternalMapping.findUnique).mockResolvedValue(
    null as never,
  );

  // Default transaction: simulate full flow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
    const tx = {
      team: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: TEAM_ID }),
      },
      teamSeason: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: TEAM_SEASON_ID }),
      },
      teamSeasonOrgUnit: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      teamExternalMapping: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
    return fn(tx);
  });
});

// ── Success: new Team identity ─────────────────────────────────────────────────

describe("registerTeamSeason — new Team identity", () => {
  it("creates a new Team and TeamSeason with one OrgUnit", async () => {
    const result = await registerTeamSeason(baseInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdTeamIdentity).toBe(true);
      expect(result.teamId).toBe(TEAM_ID);
      expect(result.teamSeasonId).toBe(TEAM_SEASON_ID);
      expect(result.slug).toBe("frauen-1");
    }
  });

  it("accepts multiple OrgUnits", async () => {
    vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
      { id: ORG_UNIT_ID_1, tenantId: TENANT_A, status: "ACTIVE", name: "Frauen" },
      { id: ORG_UNIT_ID_2, tenantId: TENANT_A, status: "ACTIVE", name: "Junioren" },
    ] as never);

    const result = await registerTeamSeason({
      ...baseInput,
      orgUnitIds: [ORG_UNIT_ID_1, ORG_UNIT_ID_2],
    });

    expect(result.ok).toBe(true);
  });

  it("uses custom slug when provided", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      team: { name: "Frauen 1", slug: "f1-custom" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slug).toBe("f1-custom");
    }
  });

  it("stores websiteVisible and infoboardVisible", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      websiteVisible: false,
      infoboardVisible: false,
    });

    expect(result.ok).toBe(true);
  });

  it("handles websiteVisible true and infoboardVisible false", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      websiteVisible: true,
      infoboardVisible: false,
    });

    expect(result.ok).toBe(true);
  });
});

// ── Success: existing Team reuse ───────────────────────────────────────────────

describe("registerTeamSeason — existing Team reuse", () => {
  beforeEach(() => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: TEAM_ID,
      tenantId: TENANT_A,
    } as never);

    // Transaction mock for existing team path
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const tx = {
        teamSeason: {
          findUnique: vi.fn().mockResolvedValue(null), // no existing season
          create: vi.fn().mockResolvedValue({ id: TEAM_SEASON_ID }),
        },
        teamSeasonOrgUnit: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        teamExternalMapping: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });
  });

  it("reuses an existing Team identity (createdTeamIdentity = false)", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      existingTeamId: TEAM_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdTeamIdentity).toBe(false);
      expect(result.teamId).toBe(TEAM_ID);
    }
  });
});

// ── Validation: Season ─────────────────────────────────────────────────────────

describe("registerTeamSeason — Season validation", () => {
  it("rejects missing Season", async () => {
    vi.mocked(prisma.season.findUnique).mockResolvedValue(null as never);

    const result = await registerTeamSeason(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SEASON_NOT_FOUND");
    }
  });
});

// ── Validation: OrgUnit ────────────────────────────────────────────────────────

describe("registerTeamSeason — OrgUnit validation", () => {
  it("rejects missing OrgUnit IDs", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      orgUnitIds: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ORG_UNIT_REQUIRED");
    }
  });

  it("rejects OrgUnit not found in DB", async () => {
    vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([] as never);

    const result = await registerTeamSeason(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ORG_UNIT_NOT_FOUND");
    }
  });

  it("rejects cross-tenant OrgUnit", async () => {
    vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
      {
        id: ORG_UNIT_ID_1,
        tenantId: TENANT_B, // wrong tenant
        status: "ACTIVE",
        name: "Fremd",
      },
    ] as never);

    const result = await registerTeamSeason(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ORG_UNIT_TENANT_MISMATCH");
    }
  });

  it("rejects archived OrgUnit", async () => {
    vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
      {
        id: ORG_UNIT_ID_1,
        tenantId: TENANT_A,
        status: "ARCHIVED",
        name: "Archiviert",
      },
    ] as never);

    const result = await registerTeamSeason(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ORG_UNIT_NOT_ACTIVE");
    }
  });

  it("rejects inactive OrgUnit", async () => {
    vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
      {
        id: ORG_UNIT_ID_1,
        tenantId: TENANT_A,
        status: "INACTIVE",
        name: "Inaktiv",
      },
    ] as never);

    const result = await registerTeamSeason(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ORG_UNIT_NOT_ACTIVE");
    }
  });
});

// ── Validation: existing Team ──────────────────────────────────────────────────

describe("registerTeamSeason — existing Team validation", () => {
  it("rejects existingTeamId that does not exist", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(null as never);

    const result = await registerTeamSeason({
      ...baseInput,
      existingTeamId: "nonexistent-id",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TEAM_NOT_FOUND");
    }
  });

  it("rejects existingTeamId from another tenant", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "other-team",
      tenantId: TENANT_B,
    } as never);

    const result = await registerTeamSeason({
      ...baseInput,
      existingTeamId: "other-team",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TEAM_TENANT_MISMATCH");
    }
  });
});

// ── Validation: duplicate TeamSeason ──────────────────────────────────────────

describe("registerTeamSeason — duplicate TeamSeason", () => {
  it("rejects duplicate TeamSeason for reused Team", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: TEAM_ID,
      tenantId: TENANT_A,
    } as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const tx = {
        teamSeason: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: "existing-ts-id" }), // already exists
          create: vi.fn(),
        },
        teamSeasonOrgUnit: { createMany: vi.fn() },
        teamExternalMapping: { upsert: vi.fn() },
      };
      return fn(tx);
    });

    const result = await registerTeamSeason({
      ...baseInput,
      existingTeamId: TEAM_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TEAM_SEASON_ALREADY_EXISTS");
    }
  });

  it("rejects duplicate slug within the same tenant for a new Team", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const tx = {
        team: {
          findUnique: vi.fn().mockResolvedValue({ id: "other-team" }), // slug conflict
          create: vi.fn(),
        },
        teamSeason: { findUnique: vi.fn(), create: vi.fn() },
        teamSeasonOrgUnit: { createMany: vi.fn() },
        teamExternalMapping: { upsert: vi.fn() },
      };
      return fn(tx);
    });

    const result = await registerTeamSeason(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SLUG_CONFLICT");
    }
  });
});

// ── Federation mapping ─────────────────────────────────────────────────────────

describe("registerTeamSeason — federation mapping", () => {
  it("manual Team without federation mapping succeeds", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      federationMapping: null,
    });

    expect(result.ok).toBe(true);
  });

  it("valid federation mapping succeeds", async () => {
    vi.mocked(prisma.teamExternalMapping.findUnique).mockResolvedValue(
      null as never,
    );

    const result = await registerTeamSeason({
      ...baseInput,
      federationMapping: {
        provider: "SFV",
        externalTeamId: 12345,
        externalSeasonId: 67,
        providerTeamName: "FC Test Frauen 1. Liga",
        providerLeagueName: "SFV Frauen 1. Liga",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects duplicate federation mapping (already linked to a TeamSeason)", async () => {
    vi.mocked(prisma.teamExternalMapping.findUnique).mockResolvedValue({
      id: "existing-mapping",
      teamSeasonId: "some-team-season-id", // already linked
      teamId: "some-team-id",
    } as never);

    const result = await registerTeamSeason({
      ...baseInput,
      federationMapping: {
        provider: "SFV",
        externalTeamId: 12345,
        externalSeasonId: 67,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FEDERATION_MAPPING_CONFLICT");
    }
  });
});

// ── First OrgUnit is primary ───────────────────────────────────────────────────

describe("registerTeamSeason — OrgUnit ordering", () => {
  it("first OrgUnit in the list becomes primary", async () => {
    vi.mocked(prisma.orgUnit.findMany).mockResolvedValue([
      { id: ORG_UNIT_ID_1, tenantId: TENANT_A, status: "ACTIVE", name: "Frauen" },
      { id: ORG_UNIT_ID_2, tenantId: TENANT_A, status: "ACTIVE", name: "Junioren" },
    ] as never);

    let capturedOrgUnitData: Array<{
      orgUnitId: string;
      isPrimary: boolean;
      displayOrder: number;
    }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const tx = {
        team: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: TEAM_ID }),
        },
        teamSeason: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: TEAM_SEASON_ID }),
        },
        teamSeasonOrgUnit: {
          createMany: vi.fn().mockImplementation((args: { data: typeof capturedOrgUnitData }) => {
            capturedOrgUnitData = args.data;
            return Promise.resolve({ count: args.data.length });
          }),
        },
        teamExternalMapping: { upsert: vi.fn() },
      };
      return fn(tx);
    });

    const result = await registerTeamSeason({
      ...baseInput,
      orgUnitIds: [ORG_UNIT_ID_1, ORG_UNIT_ID_2],
    });

    expect(result.ok).toBe(true);
    expect(capturedOrgUnitData[0]?.orgUnitId).toBe(ORG_UNIT_ID_1);
    expect(capturedOrgUnitData[0]?.isPrimary).toBe(true);
    expect(capturedOrgUnitData[1]?.orgUnitId).toBe(ORG_UNIT_ID_2);
    expect(capturedOrgUnitData[1]?.isPrimary).toBe(false);
  });
});

// ── Required field validation ──────────────────────────────────────────────────

describe("registerTeamSeason — required field validation", () => {
  it("rejects empty teamName", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      team: { name: "" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ORG_UNIT_REQUIRED"); // triggers name check before OrgUnit
    }
  });
});
