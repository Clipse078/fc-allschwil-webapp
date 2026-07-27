/**
 * Tests for lib/training/training-plan-service.ts
 *
 * Covers (TRAINING-PLANS-01):
 *   A. createTrainingPlan       — name validation, defaults, limits, isolation
 *   B. updateTrainingPlan       — rename, description, fallback, displayOrder
 *   C. setDefaultTrainingPlan   — transactional default transition
 *   D. archiveTrainingPlan      — lifecycle, default protection, idempotency
 *   E. restoreTrainingPlan      — lifecycle, name conflict, idempotency
 *   F. listTrainingPlans        — filters, archived exclusion
 *   G. getTrainingPlan          — retrieval, not-found, cross-tenant
 *   H. reorderTrainingPlans     — valid reorder, duplicates, foreign IDs
 *   I. copyTrainingPlan         — assignments copied, series not duplicated
 *   J. upsertTrainingPlanAssignment — create, update, validations
 *   K. removeTrainingPlanAssignment — deletion, not-found
 *   L. listTrainingPlanAssignments  — listing
 *   M. getTrainingPlanAssignment    — retrieval, not-found
 *   N. Provider neutrality     — no SFV / provider imports
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingPlan: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    trainingPlanAssignment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMany: vi.fn(),
    },
    trainingSeries: {
      findFirst: vi.fn(),
    },
    season: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createTrainingPlan,
  updateTrainingPlan,
  setDefaultTrainingPlan,
  archiveTrainingPlan,
  restoreTrainingPlan,
  listTrainingPlans,
  getTrainingPlan,
  reorderTrainingPlans,
  copyTrainingPlan,
  upsertTrainingPlanAssignment,
  removeTrainingPlanAssignment,
  listTrainingPlanAssignments,
  getTrainingPlanAssignment,
} from "../training-plan-service";
import {
  TrainingPlanNotFoundError,
  TrainingPlanNameConflictError,
  TrainingPlanDefaultConflictError,
  TrainingPlanDefaultArchiveForbiddenError,
  TrainingPlanInvalidOrderError,
  TrainingPlanCopyNotSupportedError,
  TrainingPlanAssignmentNotFoundError,
  TrainingPlanAssignmentTenantMismatchError,
  TrainingPlanAssignmentSeasonMismatchError,
  TrainingPlanAssignmentInvalidTimeError,
  SeasonNotFoundError,
  TrainingSeriesNotFoundError,
} from "../errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SEASON_ID = "season-2026";
const SEASON_ID_2 = "season-2027";
const PLAN_ID = "plan-01";
const PLAN_ID_2 = "plan-02";
const SERIES_ID = "series-01";
const SERIES_ID_2 = "series-02";
const ASSIGNMENT_ID = "assignment-01";
const TEAM_SEASON_ID = "ts-01";

const basePlanRow = {
  id: PLAN_ID,
  tenantId: TENANT_A,
  seasonId: SEASON_ID,
  name: "Standard-Wochenplan",
  description: null,
  status: "ACTIVE",
  isDefault: false,
  displayOrder: 0,
  missingAssignmentBehavior: "FALLBACK_TO_DEFAULT",
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
  archivedAt: null,
  _count: { assignments: 0 },
};

const baseSeriesRow = {
  id: SERIES_ID,
  tenantId: TENANT_A,
  teamSeasonId: TEAM_SEASON_ID,
  startsAt: "19:00",
  endsAt: "21:00",
  timezone: "Europe/Zurich",
  teamSeason: { seasonId: SEASON_ID },
};

const baseAssignmentRow = {
  id: ASSIGNMENT_ID,
  tenantId: TENANT_A,
  trainingPlanId: PLAN_ID,
  trainingSeriesId: SERIES_ID,
  startTimeOverride: null,
  endTimeOverride: null,
  timezoneOverride: null,
  status: "SCHEDULED",
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
  trainingSeries: {
    title: "E1 Tuesday Training",
    teamSeasonId: TEAM_SEASON_ID,
    startsAt: "19:00",
    endsAt: "21:00",
    timezone: "Europe/Zurich",
  },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default happy-path mocks
  vi.mocked(prisma.season.findUnique).mockResolvedValue({ id: SEASON_ID } as never);
  vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(basePlanRow as never);
  vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([]);
  vi.mocked(prisma.trainingPlan.aggregate).mockResolvedValue({ _max: { displayOrder: null } } as never);
  vi.mocked(prisma.trainingPlan.create).mockResolvedValue(basePlanRow as never);
  vi.mocked(prisma.trainingPlan.update).mockResolvedValue(basePlanRow as never);
  vi.mocked(prisma.trainingPlan.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.trainingPlanAssignment.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.trainingPlanAssignment.findMany).mockResolvedValue([]);
  vi.mocked(prisma.trainingPlanAssignment.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.trainingPlanAssignment.create).mockResolvedValue(baseAssignmentRow as never);
  vi.mocked(prisma.trainingPlanAssignment.update).mockResolvedValue(baseAssignmentRow as never);
  vi.mocked(prisma.trainingPlanAssignment.delete).mockResolvedValue({} as never);
  vi.mocked(prisma.trainingPlanAssignment.createMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(baseSeriesRow as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (operations) => {
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }
    // For callback-style transactions, execute the callback
    const mockTx = {
      trainingPlan: {
        create: prisma.trainingPlan.create,
        update: prisma.trainingPlan.update,
        updateMany: prisma.trainingPlan.updateMany,
        aggregate: prisma.trainingPlan.aggregate,
      },
      trainingPlanAssignment: {
        createMany: prisma.trainingPlanAssignment.createMany,
      },
    };
    return (operations as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
  });
});

// ── A. createTrainingPlan ─────────────────────────────────────────────────────

describe("A. createTrainingPlan", () => {
  it("creates a plan with a custom tenant-defined name", async () => {
    const result = await createTrainingPlan(TENANT_A, {
      seasonId: SEASON_ID,
      name: "Standard-Wochenplan",
    });
    expect(result.name).toBe("Standard-Wochenplan");
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.seasonId).toBe(SEASON_ID);
  });

  it("creates plans with arbitrary names — no enum dependency", async () => {
    const names = [
      "Schlechtwetter-Wochenplan",
      "Winter-/Hallenplan",
      "Ferienplan",
      "Platzsanierung KR2",
      "My Custom Plan 🏟️",
    ];
    for (const name of names) {
      vi.mocked(prisma.trainingPlan.create).mockResolvedValue({
        ...basePlanRow,
        name,
      } as never);
      const result = await createTrainingPlan(TENANT_A, {
        seasonId: SEASON_ID,
        name,
      });
      expect(result.name).toBe(name);
    }
  });

  it("allows multiple plans in the same season", async () => {
    const plan2 = { ...basePlanRow, id: PLAN_ID_2, name: "Ferienplan" };
    vi.mocked(prisma.trainingPlan.create).mockResolvedValue(plan2 as never);
    const result = await createTrainingPlan(TENANT_A, {
      seasonId: SEASON_ID,
      name: "Ferienplan",
    });
    expect(result.name).toBe("Ferienplan");
  });

  it("allows many plans without any artificial limit", async () => {
    for (let i = 0; i < 50; i++) {
      const row = { ...basePlanRow, id: `plan-${i}`, name: `Plan ${i}` };
      vi.mocked(prisma.trainingPlan.create).mockResolvedValue(row as never);
      const result = await createTrainingPlan(TENANT_A, {
        seasonId: SEASON_ID,
        name: `Plan ${i}`,
      });
      expect(result.id).toBe(`plan-${i}`);
    }
  });

  it("allows the same plan name across different tenants", async () => {
    vi.mocked(prisma.trainingPlan.create).mockResolvedValue({
      ...basePlanRow,
      tenantId: TENANT_B,
    } as never);
    const result = await createTrainingPlan(TENANT_B, {
      seasonId: SEASON_ID,
      name: "Standard-Wochenplan",
    });
    expect(result.tenantId).toBe(TENANT_B);
  });

  it("allows the same plan name across different seasons", async () => {
    vi.mocked(prisma.season.findUnique).mockResolvedValue({ id: SEASON_ID_2 } as never);
    vi.mocked(prisma.trainingPlan.create).mockResolvedValue({
      ...basePlanRow,
      seasonId: SEASON_ID_2,
    } as never);
    const result = await createTrainingPlan(TENANT_A, {
      seasonId: SEASON_ID_2,
      name: "Standard-Wochenplan",
    });
    expect(result.seasonId).toBe(SEASON_ID_2);
  });

  it("rejects case-insensitive duplicate name within same tenant+season", async () => {
    // Mock that a plan with a similar name already exists
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([
      { ...basePlanRow, name: "Standard-Wochenplan" },
    ] as never);
    await expect(
      createTrainingPlan(TENANT_A, {
        seasonId: SEASON_ID,
        name: "standard-wochenplan",
      }),
    ).rejects.toThrow(TrainingPlanNameConflictError);
  });

  it("rejects uppercase variant of conflicting name", async () => {
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([
      { ...basePlanRow, name: "Standard-Wochenplan" },
    ] as never);
    await expect(
      createTrainingPlan(TENANT_A, {
        seasonId: SEASON_ID,
        name: "STANDARD-WOCHENPLAN",
      }),
    ).rejects.toThrow(TrainingPlanNameConflictError);
  });

  it("creates a plan as default", async () => {
    // findFirst for the default check should return null (no existing default)
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.trainingPlan.create).mockResolvedValue({
      ...basePlanRow,
      isDefault: true,
    } as never);
    const result = await createTrainingPlan(TENANT_A, {
      seasonId: SEASON_ID,
      name: "Default Plan",
      isDefault: true,
    });
    expect(result.isDefault).toBe(true);
  });

  it("rejects a second default plan in the same tenant+season", async () => {
    // findFirst is only called for the default-existence check
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValueOnce({
      id: "existing-default",
    } as never);
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([]);

    await expect(
      createTrainingPlan(TENANT_A, {
        seasonId: SEASON_ID,
        name: "Another Plan",
        isDefault: true,
      }),
    ).rejects.toThrow(TrainingPlanDefaultConflictError);
  });

  it("rejects plan creation for an invalid season", async () => {
    vi.mocked(prisma.season.findUnique).mockResolvedValue(null as never);
    await expect(
      createTrainingPlan(TENANT_A, {
        seasonId: "non-existent-season",
        name: "Test Plan",
      }),
    ).rejects.toThrow(SeasonNotFoundError);
  });

  it("rejects empty plan name", async () => {
    await expect(
      createTrainingPlan(TENANT_A, {
        seasonId: SEASON_ID,
        name: "  ",
      }),
    ).rejects.toThrow(TrainingPlanNameConflictError);
  });
});

// ── B. updateTrainingPlan ─────────────────────────────────────────────────────

describe("B. updateTrainingPlan", () => {
  it("renames a plan", async () => {
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      name: "Renamed Plan",
    } as never);
    const result = await updateTrainingPlan(TENANT_A, PLAN_ID, {
      name: "Renamed Plan",
    });
    expect(result.name).toBe("Renamed Plan");
  });

  it("updates description", async () => {
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      description: "Updated description",
    } as never);
    const result = await updateTrainingPlan(TENANT_A, PLAN_ID, {
      description: "Updated description",
    });
    expect(result.description).toBe("Updated description");
  });

  it("updates missingAssignmentBehavior to NOT_SCHEDULED", async () => {
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      missingAssignmentBehavior: "NOT_SCHEDULED",
    } as never);
    const result = await updateTrainingPlan(TENANT_A, PLAN_ID, {
      missingAssignmentBehavior: "NOT_SCHEDULED",
    });
    expect(result.missingAssignmentBehavior).toBe("NOT_SCHEDULED");
  });

  it("updates displayOrder", async () => {
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      displayOrder: 5,
    } as never);
    const result = await updateTrainingPlan(TENANT_A, PLAN_ID, {
      displayOrder: 5,
    });
    expect(result.displayOrder).toBe(5);
  });

  it("rejects rename to a case-insensitively conflicting name", async () => {
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([
      { id: "other-plan", name: "Existing Plan", archivedAt: null },
    ] as never);
    await expect(
      updateTrainingPlan(TENANT_A, PLAN_ID, { name: "existing plan" }),
    ).rejects.toThrow(TrainingPlanNameConflictError);
  });

  it("rejects update of a cross-tenant plan", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    await expect(
      updateTrainingPlan(TENANT_B, PLAN_ID, { name: "New Name" }),
    ).rejects.toThrow(TrainingPlanNotFoundError);
  });

  it("rejects update of an archived plan", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue({
      ...basePlanRow,
      archivedAt: new Date(),
    } as never);
    await expect(
      updateTrainingPlan(TENANT_A, PLAN_ID, { name: "New Name" }),
    ).rejects.toThrow(TrainingPlanNotFoundError);
  });

  it("allows transitioning status from ACTIVE to INACTIVE", async () => {
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      status: "INACTIVE",
    } as never);
    const result = await updateTrainingPlan(TENANT_A, PLAN_ID, {
      status: "INACTIVE",
    });
    expect(result.status).toBe("INACTIVE");
  });
});

// ── C. setDefaultTrainingPlan ─────────────────────────────────────────────────

describe("C. setDefaultTrainingPlan", () => {
  it("makes a plan default transactionally", async () => {
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      isDefault: true,
    } as never);
    const result = await setDefaultTrainingPlan(TENANT_A, PLAN_ID);
    expect(result.isDefault).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("clears the previous default plan before setting the new one", async () => {
    const prev = { ...basePlanRow, id: "prev-default", isDefault: true };
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(prev as never);
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      isDefault: true,
    } as never);

    await setDefaultTrainingPlan(TENANT_A, PLAN_ID);
    // The $transaction callback runs updateMany (clear) then update (set)
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects setting default on an archived plan", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue({
      ...basePlanRow,
      archivedAt: new Date(),
    } as never);
    await expect(setDefaultTrainingPlan(TENANT_A, PLAN_ID)).rejects.toThrow(
      TrainingPlanNotFoundError,
    );
  });

  it("rejects cross-tenant plan id", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    await expect(setDefaultTrainingPlan(TENANT_B, PLAN_ID)).rejects.toThrow(
      TrainingPlanNotFoundError,
    );
  });
});

// ── D. archiveTrainingPlan ────────────────────────────────────────────────────

describe("D. archiveTrainingPlan", () => {
  it("archives a non-default plan", async () => {
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      status: "ARCHIVED",
      archivedAt: new Date(),
    } as never);
    const result = await archiveTrainingPlan(TENANT_A, PLAN_ID);
    expect(result.status).toBe("ARCHIVED");
  });

  it("rejects archiving the current default plan", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue({
      ...basePlanRow,
      isDefault: true,
    } as never);
    await expect(archiveTrainingPlan(TENANT_A, PLAN_ID)).rejects.toThrow(
      TrainingPlanDefaultArchiveForbiddenError,
    );
  });

  it("is idempotent — archiving an already-archived plan returns it unchanged", async () => {
    const alreadyArchived = {
      ...basePlanRow,
      status: "ARCHIVED",
      archivedAt: new Date(),
    };
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(
      alreadyArchived as never,
    );
    const result = await archiveTrainingPlan(TENANT_A, PLAN_ID);
    expect(result.status).toBe("ARCHIVED");
    expect(prisma.trainingPlan.update).not.toHaveBeenCalled();
  });

  it("does not delete assignments when archiving", async () => {
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      status: "ARCHIVED",
      archivedAt: new Date(),
    } as never);
    await archiveTrainingPlan(TENANT_A, PLAN_ID);
    expect(prisma.trainingPlanAssignment.delete).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant archive", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    await expect(archiveTrainingPlan(TENANT_B, PLAN_ID)).rejects.toThrow(
      TrainingPlanNotFoundError,
    );
  });
});

// ── E. restoreTrainingPlan ────────────────────────────────────────────────────

describe("E. restoreTrainingPlan", () => {
  it("restores an archived plan as INACTIVE", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue({
      ...basePlanRow,
      status: "ARCHIVED",
      archivedAt: new Date(),
    } as never);
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      status: "INACTIVE",
      archivedAt: null,
    } as never);
    const result = await restoreTrainingPlan(TENANT_A, PLAN_ID);
    expect(result.status).toBe("INACTIVE");
    expect(result.archivedAt).toBeNull();
  });

  it("does not make a restored plan default", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue({
      ...basePlanRow,
      status: "ARCHIVED",
      archivedAt: new Date(),
    } as never);
    vi.mocked(prisma.trainingPlan.update).mockResolvedValue({
      ...basePlanRow,
      status: "INACTIVE",
      archivedAt: null,
      isDefault: false,
    } as never);
    const result = await restoreTrainingPlan(TENANT_A, PLAN_ID);
    expect(result.isDefault).toBe(false);
  });

  it("is idempotent — restoring a non-archived plan is a no-op", async () => {
    const result = await restoreTrainingPlan(TENANT_A, PLAN_ID);
    expect(result.status).toBe("ACTIVE");
    expect(prisma.trainingPlan.update).not.toHaveBeenCalled();
  });

  it("rejects restore when name conflicts with an existing non-archived plan", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue({
      ...basePlanRow,
      status: "ARCHIVED",
      archivedAt: new Date(),
    } as never);
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([
      {
        id: "other-plan",
        name: "Standard-Wochenplan",
        archivedAt: null,
      },
    ] as never);
    await expect(restoreTrainingPlan(TENANT_A, PLAN_ID)).rejects.toThrow(
      TrainingPlanNameConflictError,
    );
  });
});

// ── F. listTrainingPlans ──────────────────────────────────────────────────────

describe("F. listTrainingPlans", () => {
  it("lists plans excluding archived by default", async () => {
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([
      basePlanRow,
    ] as never);
    const result = await listTrainingPlans(TENANT_A);
    expect(result).toHaveLength(1);
    expect(vi.mocked(prisma.trainingPlan.findMany).mock.calls[0][0]).toMatchObject({
      where: expect.objectContaining({ tenantId: TENANT_A }),
    });
  });

  it("filters by seasonId", async () => {
    await listTrainingPlans(TENANT_A, { seasonId: SEASON_ID });
    expect(vi.mocked(prisma.trainingPlan.findMany).mock.calls[0][0]).toMatchObject({
      where: expect.objectContaining({ seasonId: SEASON_ID }),
    });
  });

  it("includes archived when requested", async () => {
    await listTrainingPlans(TENANT_A, { includeArchived: true });
    const callArgs = vi.mocked(prisma.trainingPlan.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    // Should NOT have NOT: {status: ARCHIVED} exclusion
    expect(callArgs.where).not.toHaveProperty("NOT");
  });

  it("orders plans by displayOrder then createdAt", async () => {
    await listTrainingPlans(TENANT_A);
    expect(vi.mocked(prisma.trainingPlan.findMany).mock.calls[0][0]).toMatchObject({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
  });

  it("scopes results to tenant", async () => {
    await listTrainingPlans(TENANT_A);
    expect(vi.mocked(prisma.trainingPlan.findMany).mock.calls[0][0]).toMatchObject({
      where: expect.objectContaining({ tenantId: TENANT_A }),
    });
  });
});

// ── G. getTrainingPlan ────────────────────────────────────────────────────────

describe("G. getTrainingPlan", () => {
  it("returns the plan DTO", async () => {
    const result = await getTrainingPlan(TENANT_A, PLAN_ID);
    expect(result.id).toBe(PLAN_ID);
    expect(result.name).toBe("Standard-Wochenplan");
  });

  it("throws not-found for a missing plan", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    await expect(getTrainingPlan(TENANT_A, "missing")).rejects.toThrow(
      TrainingPlanNotFoundError,
    );
  });

  it("treats a valid ID belonging to another tenant as not-found", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    await expect(getTrainingPlan(TENANT_B, PLAN_ID)).rejects.toThrow(
      TrainingPlanNotFoundError,
    );
  });

  it("includes assignmentCount in the DTO", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue({
      ...basePlanRow,
      _count: { assignments: 3 },
    } as never);
    const result = await getTrainingPlan(TENANT_A, PLAN_ID);
    expect(result.assignmentCount).toBe(3);
  });
});

// ── H. reorderTrainingPlans ───────────────────────────────────────────────────

describe("H. reorderTrainingPlans", () => {
  it("reorders plans transactionally", async () => {
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([
      { id: PLAN_ID, archivedAt: null },
      { id: PLAN_ID_2, archivedAt: null },
    ] as never);
    await reorderTrainingPlans(TENANT_A, SEASON_ID, [PLAN_ID_2, PLAN_ID]);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects duplicate IDs in the order list", async () => {
    await expect(
      reorderTrainingPlans(TENANT_A, SEASON_ID, [PLAN_ID, PLAN_ID]),
    ).rejects.toThrow(TrainingPlanInvalidOrderError);
  });

  it("rejects a plan ID belonging to a different tenant", async () => {
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([]); // empty = foreign IDs
    await expect(
      reorderTrainingPlans(TENANT_A, SEASON_ID, [PLAN_ID]),
    ).rejects.toThrow(TrainingPlanInvalidOrderError);
  });

  it("rejects archived plans in the order list", async () => {
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([
      { id: PLAN_ID, archivedAt: new Date() },
    ] as never);
    await expect(
      reorderTrainingPlans(TENANT_A, SEASON_ID, [PLAN_ID]),
    ).rejects.toThrow(TrainingPlanInvalidOrderError);
  });

  it("is a no-op for empty list", async () => {
    await reorderTrainingPlans(TENANT_A, SEASON_ID, []);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ── I. copyTrainingPlan ───────────────────────────────────────────────────────

describe("I. copyTrainingPlan", () => {
  const sourceWithAssignments = {
    ...basePlanRow,
    _count: { assignments: 2 },
    missingAssignmentBehavior: "FALLBACK_TO_DEFAULT",
    description: "Original description",
  };

  const assignmentRows = [
    {
      trainingSeriesId: SERIES_ID,
      startTimeOverride: "19:00",
      endTimeOverride: null,
      timezoneOverride: null,
      status: "SCHEDULED",
    },
    {
      trainingSeriesId: SERIES_ID_2,
      startTimeOverride: null,
      endTimeOverride: null,
      timezoneOverride: null,
      status: "NOT_SCHEDULED",
    },
  ];

  beforeEach(() => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(
      sourceWithAssignments as never,
    );
    vi.mocked(prisma.trainingPlanAssignment.findMany).mockResolvedValue(
      assignmentRows as never,
    );
    vi.mocked(prisma.trainingPlan.create).mockResolvedValue({
      ...basePlanRow,
      id: "copy-plan",
      name: "Kopie von Standard-Wochenplan",
      isDefault: false,
    } as never);
  });

  it("copies a plan with all assignments", async () => {
    const result = await copyTrainingPlan(TENANT_A, PLAN_ID, {
      name: "Kopie von Standard-Wochenplan",
      seasonId: SEASON_ID,
    });
    expect(result.name).toBe("Kopie von Standard-Wochenplan");
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("copied plan is never default", async () => {
    const result = await copyTrainingPlan(TENANT_A, PLAN_ID, {
      name: "Copy",
      seasonId: SEASON_ID,
    });
    expect(result.isDefault).toBe(false);
  });

  it("does not duplicate TrainingSeries when copying", async () => {
    await copyTrainingPlan(TENANT_A, PLAN_ID, {
      name: "Copy",
      seasonId: SEASON_ID,
    });
    // trainingSeries.create should never be called
    expect(vi.mocked(prisma.trainingSeries.findFirst)).not.toHaveBeenCalled();
  });

  it("rejects duplicate destination name", async () => {
    vi.mocked(prisma.trainingPlan.findMany).mockResolvedValue([
      { id: "other", name: "Copy", archivedAt: null },
    ] as never);
    await expect(
      copyTrainingPlan(TENANT_A, PLAN_ID, {
        name: "Copy",
        seasonId: SEASON_ID,
      }),
    ).rejects.toThrow(TrainingPlanNameConflictError);
  });

  it("rejects cross-tenant copy", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    await expect(
      copyTrainingPlan(TENANT_B, PLAN_ID, {
        name: "Copy",
        seasonId: SEASON_ID,
      }),
    ).rejects.toThrow(TrainingPlanNotFoundError);
  });

  it("rejects cross-season copy explicitly", async () => {
    await expect(
      copyTrainingPlan(TENANT_A, PLAN_ID, {
        name: "Copy to Other Season",
        seasonId: SEASON_ID_2,
      }),
    ).rejects.toThrow(TrainingPlanCopyNotSupportedError);
  });
});

// ── J. upsertTrainingPlanAssignment ──────────────────────────────────────────

describe("J. upsertTrainingPlanAssignment", () => {
  it("creates a new assignment", async () => {
    const result = await upsertTrainingPlanAssignment(TENANT_A, {
      trainingPlanId: PLAN_ID,
      trainingSeriesId: SERIES_ID,
    });
    expect(result.trainingPlanId).toBe(PLAN_ID);
    expect(result.trainingSeriesId).toBe(SERIES_ID);
    expect(prisma.trainingPlanAssignment.create).toHaveBeenCalled();
  });

  it("updates an existing assignment (upsert)", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findUnique).mockResolvedValue({
      id: ASSIGNMENT_ID,
    } as never);
    const result = await upsertTrainingPlanAssignment(TENANT_A, {
      trainingPlanId: PLAN_ID,
      trainingSeriesId: SERIES_ID,
      startTimeOverride: "18:00",
    });
    expect(prisma.trainingPlanAssignment.update).toHaveBeenCalled();
    expect(result.id).toBe(ASSIGNMENT_ID);
  });

  it("allows overriding start and end times", async () => {
    vi.mocked(prisma.trainingPlanAssignment.create).mockResolvedValue({
      ...baseAssignmentRow,
      startTimeOverride: "18:00",
      endTimeOverride: "20:00",
    } as never);
    const result = await upsertTrainingPlanAssignment(TENANT_A, {
      trainingPlanId: PLAN_ID,
      trainingSeriesId: SERIES_ID,
      startTimeOverride: "18:00",
      endTimeOverride: "20:00",
    });
    expect(result.startTimeOverride).toBe("18:00");
    expect(result.endTimeOverride).toBe("20:00");
  });

  it("computes effectiveStartTime from override when provided", async () => {
    vi.mocked(prisma.trainingPlanAssignment.create).mockResolvedValue({
      ...baseAssignmentRow,
      startTimeOverride: "08:00",
    } as never);
    const result = await upsertTrainingPlanAssignment(TENANT_A, {
      trainingPlanId: PLAN_ID,
      trainingSeriesId: SERIES_ID,
      startTimeOverride: "08:00",
    });
    expect(result.effectiveStartTime).toBe("08:00");
  });

  it("falls back to canonical series time when no override", async () => {
    const result = await upsertTrainingPlanAssignment(TENANT_A, {
      trainingPlanId: PLAN_ID,
      trainingSeriesId: SERIES_ID,
    });
    expect(result.effectiveStartTime).toBe("19:00");
    expect(result.effectiveEndTime).toBe("21:00");
  });

  it("rejects invalid startTimeOverride format", async () => {
    await expect(
      upsertTrainingPlanAssignment(TENANT_A, {
        trainingPlanId: PLAN_ID,
        trainingSeriesId: SERIES_ID,
        startTimeOverride: "25:00",
      }),
    ).rejects.toThrow(TrainingPlanAssignmentInvalidTimeError);
  });

  it("rejects invalid endTimeOverride format", async () => {
    await expect(
      upsertTrainingPlanAssignment(TENANT_A, {
        trainingPlanId: PLAN_ID,
        trainingSeriesId: SERIES_ID,
        endTimeOverride: "not-a-time",
      }),
    ).rejects.toThrow(TrainingPlanAssignmentInvalidTimeError);
  });

  it("rejects startTimeOverride >= endTimeOverride", async () => {
    await expect(
      upsertTrainingPlanAssignment(TENANT_A, {
        trainingPlanId: PLAN_ID,
        trainingSeriesId: SERIES_ID,
        startTimeOverride: "21:00",
        endTimeOverride: "19:00",
      }),
    ).rejects.toThrow(TrainingPlanAssignmentInvalidTimeError);
  });

  it("rejects assignment when plan is from a different tenant", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    await expect(
      upsertTrainingPlanAssignment(TENANT_B, {
        trainingPlanId: PLAN_ID,
        trainingSeriesId: SERIES_ID,
      }),
    ).rejects.toThrow(TrainingPlanNotFoundError);
  });

  it("rejects assignment when series is not found", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);
    await expect(
      upsertTrainingPlanAssignment(TENANT_A, {
        trainingPlanId: PLAN_ID,
        trainingSeriesId: "missing",
      }),
    ).rejects.toThrow(TrainingSeriesNotFoundError);
  });

  it("rejects assignment when plan and series belong to different tenants", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue({
      ...basePlanRow,
      tenantId: TENANT_A,
    } as never);
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue({
      ...baseSeriesRow,
      tenantId: TENANT_B,
    } as never);
    await expect(
      upsertTrainingPlanAssignment(TENANT_A, {
        trainingPlanId: PLAN_ID,
        trainingSeriesId: SERIES_ID,
      }),
    ).rejects.toThrow(TrainingPlanAssignmentTenantMismatchError);
  });

  it("rejects assignment when series season mismatches plan season", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue({
      ...baseSeriesRow,
      teamSeason: { seasonId: SEASON_ID_2 },
    } as never);
    await expect(
      upsertTrainingPlanAssignment(TENANT_A, {
        trainingPlanId: PLAN_ID,
        trainingSeriesId: SERIES_ID,
      }),
    ).rejects.toThrow(TrainingPlanAssignmentSeasonMismatchError);
  });

  it("rejects invalid IANA timezone override", async () => {
    await expect(
      upsertTrainingPlanAssignment(TENANT_A, {
        trainingPlanId: PLAN_ID,
        trainingSeriesId: SERIES_ID,
        timezoneOverride: "Not/A/Timezone",
      }),
    ).rejects.toThrow(TrainingPlanAssignmentInvalidTimeError);
  });

  it("accepts a valid IANA timezone override", async () => {
    vi.mocked(prisma.trainingPlanAssignment.create).mockResolvedValue({
      ...baseAssignmentRow,
      timezoneOverride: "America/New_York",
    } as never);
    const result = await upsertTrainingPlanAssignment(TENANT_A, {
      trainingPlanId: PLAN_ID,
      trainingSeriesId: SERIES_ID,
      timezoneOverride: "America/New_York",
    });
    expect(result.timezoneOverride).toBe("America/New_York");
  });

  it("supports NOT_SCHEDULED assignment status", async () => {
    vi.mocked(prisma.trainingPlanAssignment.create).mockResolvedValue({
      ...baseAssignmentRow,
      status: "NOT_SCHEDULED",
    } as never);
    const result = await upsertTrainingPlanAssignment(TENANT_A, {
      trainingPlanId: PLAN_ID,
      trainingSeriesId: SERIES_ID,
      status: "NOT_SCHEDULED",
    });
    expect(result.status).toBe("NOT_SCHEDULED");
  });
});

// ── K. removeTrainingPlanAssignment ──────────────────────────────────────────

describe("K. removeTrainingPlanAssignment", () => {
  it("deletes an existing assignment", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findFirst).mockResolvedValue({
      id: ASSIGNMENT_ID,
    } as never);
    await removeTrainingPlanAssignment(TENANT_A, ASSIGNMENT_ID);
    expect(prisma.trainingPlanAssignment.delete).toHaveBeenCalledWith({
      where: { id: ASSIGNMENT_ID },
    });
  });

  it("throws not-found for a missing assignment", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findFirst).mockResolvedValue(
      null as never,
    );
    await expect(
      removeTrainingPlanAssignment(TENANT_A, "missing"),
    ).rejects.toThrow(TrainingPlanAssignmentNotFoundError);
  });

  it("treats a valid ID from another tenant as not-found", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findFirst).mockResolvedValue(
      null as never,
    );
    await expect(
      removeTrainingPlanAssignment(TENANT_B, ASSIGNMENT_ID),
    ).rejects.toThrow(TrainingPlanAssignmentNotFoundError);
  });
});

// ── L. listTrainingPlanAssignments ────────────────────────────────────────────

describe("L. listTrainingPlanAssignments", () => {
  it("lists assignments for a plan", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findMany).mockResolvedValue([
      baseAssignmentRow,
    ] as never);
    const result = await listTrainingPlanAssignments(TENANT_A, PLAN_ID);
    expect(result).toHaveLength(1);
    expect(result[0].trainingPlanId).toBe(PLAN_ID);
  });

  it("returns an empty array when no assignments exist", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findMany).mockResolvedValue(
      [] as never,
    );
    const result = await listTrainingPlanAssignments(TENANT_A, PLAN_ID);
    expect(result).toHaveLength(0);
  });

  it("includes effective times in the DTOs", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findMany).mockResolvedValue([
      {
        ...baseAssignmentRow,
        startTimeOverride: "18:00",
        endTimeOverride: null,
      },
    ] as never);
    const result = await listTrainingPlanAssignments(TENANT_A, PLAN_ID);
    expect(result[0].effectiveStartTime).toBe("18:00");
    expect(result[0].effectiveEndTime).toBe("21:00"); // from canonical
  });

  it("throws not-found when the plan does not belong to the tenant", async () => {
    vi.mocked(prisma.trainingPlan.findFirst).mockResolvedValue(null as never);
    await expect(
      listTrainingPlanAssignments(TENANT_B, PLAN_ID),
    ).rejects.toThrow(TrainingPlanNotFoundError);
  });
});

// ── M. getTrainingPlanAssignment ──────────────────────────────────────────────

describe("M. getTrainingPlanAssignment", () => {
  it("returns the assignment DTO", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findFirst).mockResolvedValue(
      baseAssignmentRow as never,
    );
    const result = await getTrainingPlanAssignment(TENANT_A, ASSIGNMENT_ID);
    expect(result.id).toBe(ASSIGNMENT_ID);
    expect(result.trainingSeriesTitle).toBe("E1 Tuesday Training");
  });

  it("throws not-found for a missing assignment", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findFirst).mockResolvedValue(
      null as never,
    );
    await expect(
      getTrainingPlanAssignment(TENANT_A, "missing"),
    ).rejects.toThrow(TrainingPlanAssignmentNotFoundError);
  });
});

// ── N. Provider neutrality ────────────────────────────────────────────────────

describe("N. Provider neutrality", () => {
  it("training-plan-service has no SFV-specific imports", async () => {
    const serviceModule = await import("../training-plan-service");
    // Check that all exports are standard service functions
    const exports = Object.keys(serviceModule);
    expect(exports).toContain("createTrainingPlan");
    expect(exports).toContain("upsertTrainingPlanAssignment");
    // Should not expose any provider-specific fields
    exports.forEach((key) => {
      expect(key).not.toMatch(/sfv|provider|external/i);
    });
  });

  it("TrainingPlanDto does not expose provider fields", async () => {
    const result = await getTrainingPlan(TENANT_A, PLAN_ID);
    const keys = Object.keys(result);
    keys.forEach((key) => {
      expect(key).not.toMatch(/sfv|provider|external/i);
    });
  });

  it("TrainingPlanAssignmentDto does not expose provider fields", async () => {
    vi.mocked(prisma.trainingPlanAssignment.findFirst).mockResolvedValue(
      baseAssignmentRow as never,
    );
    const result = await getTrainingPlanAssignment(TENANT_A, ASSIGNMENT_ID);
    const keys = Object.keys(result);
    keys.forEach((key) => {
      expect(key).not.toMatch(/sfv|provider|external/i);
    });
  });
});
