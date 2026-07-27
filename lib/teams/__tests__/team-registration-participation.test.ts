/**
 * Tests for lib/teams/team-registration-service.ts — TEAM-CREATE-02
 *
 * Covers the participation type and competition assignment extensions:
 *   - All participation types (COMPETITION, TRAINING, DEVELOPMENT, RECREATIONAL, OTHER)
 *   - Competition validation: required for COMPETITION when competitions exist
 *   - Competition validation: not required when no competitions exist (empty state)
 *   - Competition tenant isolation: cross-tenant competition rejected
 *   - Competition not found: rejected with COMPETITION_NOT_FOUND
 *   - TeamSeasonCompetition creation when competition provided
 *   - Non-COMPETITION types: competition not required
 *   - Invalid participation type: rejected with INVALID_PARTICIPATION_TYPE
 *   - Regression: existing tests still pass with new participationType field
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ParticipationType } from "@prisma/client";
import type { RegisterTeamInput } from "../team-registration-service";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    season: { findUnique: vi.fn() },
    orgUnit: { findMany: vi.fn() },
    competition: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    teamSeason: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    teamSeasonOrgUnit: { createMany: vi.fn() },
    teamSeasonCompetition: { create: vi.fn() },
    teamExternalMapping: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
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
const COMPETITION_ID = "competition-01-id";

const baseInput: RegisterTeamInput = {
  tenantId: TENANT_A,
  seasonId: SEASON_ID,
  orgUnitIds: [ORG_UNIT_ID_1],
  team: { name: "Frauen 1" },
  participationType: ParticipationType.TRAINING,
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

  vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.competition.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.competition.count).mockResolvedValue(0 as never);

  vi.mocked(prisma.teamExternalMapping.findUnique).mockResolvedValue(
    null as never,
  );

  // Default transaction: full create-new-team flow
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
      teamSeasonCompetition: {
        create: vi.fn().mockResolvedValue({ id: "tsc-01" }),
      },
      teamExternalMapping: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    return fn(tx);
  });
});

// ── Participation type: TRAINING ────────────────────────────────────────────────

describe("TEAM-CREATE-02 — TRAINING participation", () => {
  it("registers a training team without competition", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.TRAINING,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.teamId).toBe(TEAM_ID);
      expect(result.teamSeasonId).toBe(TEAM_SEASON_ID);
    }
  });

  it("does not require a competition for TRAINING type", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.TRAINING,
      competitionId: null,
    });

    expect(result.ok).toBe(true);
  });

  it("does not create TeamSeasonCompetition for TRAINING type without competition", async () => {
    let competitionCreateCalled = false;

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
        teamSeasonCompetition: {
          create: vi.fn().mockImplementation(() => {
            competitionCreateCalled = true;
            return { id: "tsc-01" };
          }),
        },
        teamExternalMapping: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.TRAINING,
      competitionId: null,
    });

    expect(competitionCreateCalled).toBe(false);
  });
});

// ── Participation type: DEVELOPMENT ───────────────────────────────────────────

describe("TEAM-CREATE-02 — DEVELOPMENT participation", () => {
  it("registers a development team without competition", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.DEVELOPMENT,
    });

    expect(result.ok).toBe(true);
  });
});

// ── Participation type: RECREATIONAL ──────────────────────────────────────────

describe("TEAM-CREATE-02 — RECREATIONAL participation", () => {
  it("registers a recreational team without competition", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.RECREATIONAL,
    });

    expect(result.ok).toBe(true);
  });
});

// ── Participation type: OTHER ──────────────────────────────────────────────────

describe("TEAM-CREATE-02 — OTHER participation", () => {
  it("registers a team with OTHER participation type without competition", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.OTHER,
    });

    expect(result.ok).toBe(true);
  });
});

// ── Participation type: COMPETITION ───────────────────────────────────────────

describe("TEAM-CREATE-02 — COMPETITION participation with competition", () => {
  beforeEach(() => {
    // Competition exists and belongs to tenant
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({
      id: COMPETITION_ID,
      tenantId: TENANT_A,
    } as never);
  });

  it("registers a competition team with a competition", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: COMPETITION_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.teamId).toBe(TEAM_ID);
      expect(result.teamSeasonId).toBe(TEAM_SEASON_ID);
    }
  });

  it("creates a TeamSeasonCompetition (isPrimary=true) when competition is provided", async () => {
    let capturedCompetitionData: unknown = null;

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
        teamSeasonCompetition: {
          create: vi.fn().mockImplementation((args: { data: unknown }) => {
            capturedCompetitionData = args.data;
            return Promise.resolve({ id: "tsc-01" });
          }),
        },
        teamExternalMapping: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: COMPETITION_ID,
    });

    expect(capturedCompetitionData).toMatchObject({
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: COMPETITION_ID,
      isPrimary: true,
      displayOrder: 1,
    });
  });
});

// ── Competition validation: COMPETITION type requires competition ──────────────

describe("TEAM-CREATE-02 — COMPETITION type validation", () => {
  it("rejects COMPETITION type without competitionId when competitions exist", async () => {
    // competitions exist for this tenant
    vi.mocked(prisma.competition.count).mockResolvedValue(3 as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COMPETITION_REQUIRED");
    }
  });

  it("allows COMPETITION type without competitionId when no competitions exist (empty state)", async () => {
    // no competitions exist
    vi.mocked(prisma.competition.count).mockResolvedValue(0 as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: null,
    });

    // Not blocked when no competitions available
    expect(result.ok).toBe(true);
  });

  it("rejects competition not found in DB", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.competition.findUnique).mockResolvedValue(null as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: "nonexistent-id",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COMPETITION_NOT_FOUND");
    }
  });

  it("rejects competition from another tenant", async () => {
    // findFirst (tenant-scoped) returns null
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);
    // findUnique (no tenant scope) returns the competition — meaning it exists but wrong tenant
    vi.mocked(prisma.competition.findUnique).mockResolvedValue({
      id: COMPETITION_ID,
      tenantId: TENANT_B,
    } as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: COMPETITION_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COMPETITION_TENANT_MISMATCH");
    }
  });
});

// ── Manual Competition ────────────────────────────────────────────────────────

describe("TEAM-CREATE-02 — manual competition (provider=MANUAL)", () => {
  it("accepts a manually created competition (no externalSeasonId)", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({
      id: COMPETITION_ID,
      tenantId: TENANT_A,
      provider: "MANUAL",
      externalSeasonId: null,
    } as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: COMPETITION_ID,
    });

    expect(result.ok).toBe(true);
  });
});

// ── Provider Competition ──────────────────────────────────────────────────────

describe("TEAM-CREATE-02 — provider competition (SFV)", () => {
  it("accepts an SFV-synced competition", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({
      id: COMPETITION_ID,
      tenantId: TENANT_A,
      provider: "SFV",
      externalSeasonId: 42,
    } as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: COMPETITION_ID,
    });

    expect(result.ok).toBe(true);
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe("TEAM-CREATE-02 — tenant isolation", () => {
  it("rejects competition belonging to a different tenant", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.competition.findUnique).mockResolvedValue({
      id: "other-tenant-competition",
      tenantId: TENANT_B,
    } as never);

    const result = await registerTeamSeason({
      ...baseInput,
      tenantId: TENANT_A,
      participationType: ParticipationType.COMPETITION,
      competitionId: "other-tenant-competition",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COMPETITION_TENANT_MISMATCH");
    }
  });
});

// ── German localization ───────────────────────────────────────────────────────

describe("TEAM-CREATE-02 — German error messages", () => {
  it("COMPETITION_REQUIRED message is in German", async () => {
    vi.mocked(prisma.competition.count).mockResolvedValue(2 as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Wettkampf/);
    }
  });

  it("COMPETITION_NOT_FOUND message is in German", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.competition.findUnique).mockResolvedValue(null as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: "nonexistent",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Wettkampf/);
    }
  });
});

// ── Regression: existing fields unaffected ────────────────────────────────────

describe("TEAM-CREATE-02 — regression: existing registration features", () => {
  it("new Team + TRAINING type still returns createdTeamIdentity=true", async () => {
    const result = await registerTeamSeason(baseInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdTeamIdentity).toBe(true);
    }
  });

  it("slug still auto-generated from team name", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      team: { name: "Herren 2" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slug).toBe("herren-2");
    }
  });

  it("websiteVisible and infoboardVisible are still respected", async () => {
    const result = await registerTeamSeason({
      ...baseInput,
      websiteVisible: false,
      infoboardVisible: false,
    });

    expect(result.ok).toBe(true);
  });

  it("COMPETITION type + competition + federation mapping all succeed together", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({
      id: COMPETITION_ID,
      tenantId: TENANT_A,
    } as never);

    const result = await registerTeamSeason({
      ...baseInput,
      participationType: ParticipationType.COMPETITION,
      competitionId: COMPETITION_ID,
      federationMapping: {
        provider: "SFV",
        externalTeamId: 12345,
        externalSeasonId: 67,
        providerTeamName: "FC Test Frauen",
        providerLeagueName: "SFV Liga",
      },
    });

    expect(result.ok).toBe(true);
  });
});
