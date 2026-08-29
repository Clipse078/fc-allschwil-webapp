/**
 * lib/weekplanner/__tests__/plan-service.test.ts
 *
 * WEEKPLANNER-01B — focused tests for the WeekplannerPlan /
 * WeekplannerPlanAllocation domain service. Covers:
 *   - create alternative plan (+ validation, name-conflict, tenant/week scoping)
 *   - rename / archive / delete lifecycle (delete-where-safe)
 *   - tenant isolation on every read/write
 *   - Training / Match / Tournament allocation override creation
 *   - dressing-room (Garderobe) participant validation
 *   - canonical activity/resource validation never mutates the canonical
 *     TrainingSession/Event/FacilityResource records themselves
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/wochenplan/plan-service", () => ({
  getActiveWochenplanPlan: vi.fn(),
}));

vi.mock("@/lib/wochenplan/public-plan-resolution", () => ({
  resolvePublicWeekplannerPlan: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    weekplannerPlan: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
    weekplannerPlanAllocation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    weekplannerPlanActivityOverride: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    wochenplanPlan: { findFirst: vi.fn() },
    trainingSession: { findFirst: vi.fn() },
    event: { findFirst: vi.fn() },
    tournamentParticipant: { findFirst: vi.fn() },
    facilityResource: { findFirst: vi.fn() },
  },
}));

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getActiveWochenplanPlan } from "@/lib/wochenplan/plan-service";
import { resolvePublicWeekplannerPlan } from "@/lib/wochenplan/public-plan-resolution";
import {
  listWeekplannerPlans,
  getWeekplannerPlan,
  createWeekplannerPlan,
  renameWeekplannerPlan,
  archiveWeekplannerPlan,
  deleteWeekplannerPlan,
  activateWeekplannerPlan,
  deactivateWeekplannerPlan,
  getOperationalWeekplannerPlan,
  createWeekplannerPlanAllocation,
  deleteWeekplannerPlanAllocation,
  setWeekplannerPlanActivityTimeOverride,
  clearWeekplannerPlanActivityTimeOverride,
  getWeekplannerPlanActivityOverride,
} from "../plan-service";
import {
  WeekplannerPlanNotFoundError,
  WeekplannerPlanValidationError,
  WeekplannerPlanNameConflictError,
  WeekplannerPlanArchivedError,
  WeekplannerPlanActivationConflictError,
  WeekplannerPlanDeleteUnsafeError,
  WeekplannerPlanAllocationNotFoundError,
  WeekplannerPlanAllocationActivityNotFoundError,
  WeekplannerPlanAllocationInvalidParticipantError,
  WeekplannerPlanAllocationGroupMismatchError,
  WeekplannerPlanAllocationDuplicateError,
  WeekplannerPlanTimeOverrideInvalidRangeError,
} from "../plan-errors";

function prismaUniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the constraint: `WeekplannerPlan_tenantId_weekId_isActive_unique`",
    { code: "P2002", clientVersion: "test", meta: { target: ["WeekplannerPlan_tenantId_weekId_isActive_unique"] } },
  );
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const WEEK_ID = "2026-08-10";
const PLAN_ID = "plan-1";

function planRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    tenantId: TENANT_A,
    weekId: WEEK_ID,
    name: "Schlechtwetterplan",
    createdByUserId: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    archivedAt: null,
    isActive: false,
    wochenplanPlanId: null,
    ...overrides,
  };
}

const PITCH_RESOURCE = {
  id: "res-pitch-1",
  type: "FULL_PITCH",
  status: "ACTIVE",
  facility: { id: "fac-1", status: "ACTIVE" },
};
const ROOM_RESOURCE = {
  id: "res-room-1",
  type: "DRESSING_ROOM",
  status: "ACTIVE",
  facility: { id: "fac-2", status: "ACTIVE" },
};

function allocationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "alloc-1",
    tenantId: TENANT_A,
    weekplannerPlanId: PLAN_ID,
    activityType: "TRAINING",
    activityId: "session-1",
    allocationGroup: "PITCH_HALL",
    participantId: "",
    facilityResourceId: PITCH_RESOURCE.id,
    notes: null,
    displayOrder: 0,
    occupancyBeforeMinutes: 0,
    occupancyAfterMinutes: 0,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    facilityResource: {
      name: "Kunstrasen 1",
      code: "KR1",
      type: "FULL_PITCH",
      facilityId: "fac-1",
      facility: { name: "Sportanlage" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (arg) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const mockTx = {
      weekplannerPlan: {
        update: prisma.weekplannerPlan.update,
        updateMany: prisma.weekplannerPlan.updateMany,
        findFirst: prisma.weekplannerPlan.findFirst,
      },
    };
    return (arg as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
  });
});

describe("A. createWeekplannerPlan", () => {
  it("A1: creates a new alternative plan for a tenant+week", async () => {
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([]);
    vi.mocked(prisma.weekplannerPlan.create).mockResolvedValue(planRow() as never);

    const plan = await createWeekplannerPlan(TENANT_A, { weekId: WEEK_ID, name: "Schlechtwetterplan" });

    expect(plan.name).toBe("Schlechtwetterplan");
    expect(plan.weekId).toBe(WEEK_ID);
    expect(prisma.weekplannerPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_A, weekId: WEEK_ID, name: "Schlechtwetterplan" }) }),
    );
  });

  it("A2: rejects an empty name", async () => {
    await expect(createWeekplannerPlan(TENANT_A, { weekId: WEEK_ID, name: "   " })).rejects.toThrow(
      WeekplannerPlanValidationError,
    );
    expect(prisma.weekplannerPlan.create).not.toHaveBeenCalled();
  });

  it("A3: rejects a malformed weekId", async () => {
    await expect(createWeekplannerPlan(TENANT_A, { weekId: "not-a-date", name: "X" })).rejects.toThrow(
      WeekplannerPlanValidationError,
    );
  });

  it("A4: rejects a duplicate active plan name for the same tenant+week", async () => {
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([
      planRow({ id: "existing", name: "Schlechtwetterplan" }),
    ] as never);

    await expect(
      createWeekplannerPlan(TENANT_A, { weekId: WEEK_ID, name: "schlechtwetterplan" }),
    ).rejects.toThrow(WeekplannerPlanNameConflictError);
    expect(prisma.weekplannerPlan.create).not.toHaveBeenCalled();
  });

  it("A5: the SAME name is allowed again once the earlier plan is archived (name check scoped to archivedAt: null)", async () => {
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([]);
    vi.mocked(prisma.weekplannerPlan.create).mockResolvedValue(planRow() as never);

    await createWeekplannerPlan(TENANT_A, { weekId: WEEK_ID, name: "Schlechtwetterplan" });

    expect(prisma.weekplannerPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A, weekId: WEEK_ID, archivedAt: null }) }),
    );
  });

  it("A6: links a week plan to a tenant-level WochenplanPlan via wochenplanPlanId", async () => {
    const WCP_PLAN_ID = "wcp-alt-1";
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([]);
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: WCP_PLAN_ID,
      isDefault: false,
    } as never);
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.weekplannerPlan.create).mockResolvedValue(
      planRow({ wochenplanPlanId: WCP_PLAN_ID }) as never,
    );

    const plan = await createWeekplannerPlan(TENANT_A, {
      weekId: WEEK_ID,
      name: "Schlechtwetterplan",
      wochenplanPlanId: WCP_PLAN_ID,
    });

    expect(plan.wochenplanPlanId).toBe(WCP_PLAN_ID);
    expect(prisma.weekplannerPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ wochenplanPlanId: WCP_PLAN_ID }),
      }),
    );
  });

  it("A7: rejects linking to a default WochenplanPlan", async () => {
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([]);
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: "wcp-default",
      isDefault: true,
    } as never);

    await expect(
      createWeekplannerPlan(TENANT_A, {
        weekId: WEEK_ID,
        name: "X",
        wochenplanPlanId: "wcp-default",
      }),
    ).rejects.toThrow(WeekplannerPlanValidationError);
    expect(prisma.weekplannerPlan.create).not.toHaveBeenCalled();
  });

  it("A8: rejects duplicate wochenplanPlanId link for same tenant+week", async () => {
    const WCP_PLAN_ID = "wcp-alt-1";
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([]);
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: WCP_PLAN_ID,
      isDefault: false,
    } as never);
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({ id: "existing" } as never);

    await expect(
      createWeekplannerPlan(TENANT_A, {
        weekId: WEEK_ID,
        name: "Schlechtwetterplan",
        wochenplanPlanId: WCP_PLAN_ID,
      }),
    ).rejects.toThrow(WeekplannerPlanValidationError);
    expect(prisma.weekplannerPlan.create).not.toHaveBeenCalled();
  });
});

describe("B. listWeekplannerPlans — tenant/week isolation", () => {
  it("B1: scopes the query by both tenantId and weekId, excludes archived", async () => {
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([planRow()] as never);

    const plans = await listWeekplannerPlans(TENANT_A, WEEK_ID);

    expect(plans).toHaveLength(1);
    expect(prisma.weekplannerPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A, weekId: WEEK_ID, archivedAt: null } }),
    );
  });

  it("B2: a plan created for one week never appears for a different week (isolation is a DB-query concern; assert the filter is present)", async () => {
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([]);
    const plans = await listWeekplannerPlans(TENANT_A, "2026-08-17");
    expect(plans).toEqual([]);
    expect(prisma.weekplannerPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ weekId: "2026-08-17" }) }),
    );
  });

  it("B3: getWeekplannerPlan treats a cross-tenant id as not found", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    await expect(getWeekplannerPlan(TENANT_B, PLAN_ID)).rejects.toThrow(WeekplannerPlanNotFoundError);
    expect(prisma.weekplannerPlan.findFirst).toHaveBeenCalledWith({ where: { id: PLAN_ID, tenantId: TENANT_B } });
  });
});

describe("C. renameWeekplannerPlan / archiveWeekplannerPlan / deleteWeekplannerPlan lifecycle", () => {
  it("C1: renames an active plan", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([]);
    vi.mocked(prisma.weekplannerPlan.update).mockResolvedValue(planRow({ name: "Winterplan" }) as never);

    const plan = await renameWeekplannerPlan(TENANT_A, PLAN_ID, "Winterplan");
    expect(plan.name).toBe("Winterplan");
  });

  it("C2: rejects renaming an archived plan", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow({ archivedAt: new Date() }) as never);

    await expect(renameWeekplannerPlan(TENANT_A, PLAN_ID, "Neuer Name")).rejects.toThrow(
      WeekplannerPlanArchivedError,
    );
    expect(prisma.weekplannerPlan.update).not.toHaveBeenCalled();
  });

  it("C3: rejects renaming to a name already used by another active plan in the same week", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.weekplannerPlan.findMany).mockResolvedValue([
      planRow({ id: "other-plan", name: "Winterplan" }),
    ] as never);

    await expect(renameWeekplannerPlan(TENANT_A, PLAN_ID, "Winterplan")).rejects.toThrow(
      WeekplannerPlanNameConflictError,
    );
  });

  it("C4: archives an active plan", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.weekplannerPlan.update).mockResolvedValue(planRow({ archivedAt: new Date() }) as never);

    const plan = await archiveWeekplannerPlan(TENANT_A, PLAN_ID);
    expect(plan.archivedAt).not.toBeNull();
    expect(prisma.weekplannerPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PLAN_ID }, data: expect.objectContaining({ archivedAt: expect.any(Date) }) }),
    );
  });

  it("C5: deletes a plan with zero overrides (safe delete)", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.weekplannerPlanAllocation.count).mockResolvedValue(0);
    vi.mocked(prisma.weekplannerPlan.delete).mockResolvedValue({} as never);

    await deleteWeekplannerPlan(TENANT_A, PLAN_ID);

    expect(prisma.weekplannerPlan.delete).toHaveBeenCalledWith({ where: { id: PLAN_ID } });
  });

  it("C6: refuses to delete a plan that still has overrides — guides towards archiving instead", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.weekplannerPlanAllocation.count).mockResolvedValue(2);

    await expect(deleteWeekplannerPlan(TENANT_A, PLAN_ID)).rejects.toThrow(WeekplannerPlanDeleteUnsafeError);
    expect(prisma.weekplannerPlan.delete).not.toHaveBeenCalled();
  });

  it("C7: archiving/deleting a cross-tenant plan id is treated as not found", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    await expect(archiveWeekplannerPlan(TENANT_B, PLAN_ID)).rejects.toThrow(WeekplannerPlanNotFoundError);
    await expect(deleteWeekplannerPlan(TENANT_B, PLAN_ID)).rejects.toThrow(WeekplannerPlanNotFoundError);
  });
});

describe("D. createWeekplannerPlanAllocation — Training/Match/Tournament overrides", () => {
  it("D1: creates a Training Spielfeld/Halle override", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(PITCH_RESOURCE as never);
    vi.mocked(prisma.weekplannerPlanAllocation.aggregate).mockResolvedValue({ _max: { displayOrder: null } } as never);
    vi.mocked(prisma.weekplannerPlanAllocation.create).mockResolvedValue(allocationRow() as never);

    const allocation = await createWeekplannerPlanAllocation(TENANT_A, {
      weekplannerPlanId: PLAN_ID,
      activityType: "TRAINING",
      activityId: "session-1",
      allocationGroup: "PITCH_HALL",
      facilityResourceId: PITCH_RESOURCE.id,
    });

    expect(allocation.activityType).toBe("TRAINING");
    expect(allocation.participantId).toBe("");
    expect(prisma.trainingSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "session-1", tenantId: TENANT_A } }),
    );
  });

  it("D2: creates a HOME Match Garderobe override", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: "match-1" } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(ROOM_RESOURCE as never);
    vi.mocked(prisma.weekplannerPlanAllocation.aggregate).mockResolvedValue({ _max: { displayOrder: null } } as never);
    vi.mocked(prisma.weekplannerPlanAllocation.create).mockResolvedValue(
      allocationRow({ activityType: "MATCH", activityId: "match-1", allocationGroup: "DRESSING_ROOM", facilityResourceId: ROOM_RESOURCE.id }) as never,
    );

    const allocation = await createWeekplannerPlanAllocation(TENANT_A, {
      weekplannerPlanId: PLAN_ID,
      activityType: "MATCH",
      activityId: "match-1",
      allocationGroup: "DRESSING_ROOM",
      facilityResourceId: ROOM_RESOURCE.id,
    });

    expect(allocation.activityType).toBe("MATCH");
    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "match-1", tenantId: TENANT_A, type: "MATCH" } }),
    );
  });

  it("D3: creates a HOME Tournament participant Garderobe override — requires a valid participantId", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: "tournament-1" } as never);
    vi.mocked(prisma.tournamentParticipant.findFirst).mockResolvedValue({ id: "participant-1" } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(ROOM_RESOURCE as never);
    vi.mocked(prisma.weekplannerPlanAllocation.aggregate).mockResolvedValue({ _max: { displayOrder: null } } as never);
    vi.mocked(prisma.weekplannerPlanAllocation.create).mockResolvedValue(
      allocationRow({
        activityType: "TOURNAMENT",
        activityId: "tournament-1",
        allocationGroup: "DRESSING_ROOM",
        participantId: "participant-1",
        facilityResourceId: ROOM_RESOURCE.id,
      }) as never,
    );

    const allocation = await createWeekplannerPlanAllocation(TENANT_A, {
      weekplannerPlanId: PLAN_ID,
      activityType: "TOURNAMENT",
      activityId: "tournament-1",
      allocationGroup: "DRESSING_ROOM",
      participantId: "participant-1",
      facilityResourceId: ROOM_RESOURCE.id,
    });

    expect(allocation.participantId).toBe("participant-1");
    expect(prisma.tournamentParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "participant-1", tenantId: TENANT_A, eventId: "tournament-1" } }),
    );
  });

  it("D4: rejects a TOURNAMENT+DRESSING_ROOM override without a participantId", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: "tournament-1" } as never);

    await expect(
      createWeekplannerPlanAllocation(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TOURNAMENT",
        activityId: "tournament-1",
        allocationGroup: "DRESSING_ROOM",
        facilityResourceId: ROOM_RESOURCE.id,
      }),
    ).rejects.toThrow(WeekplannerPlanAllocationInvalidParticipantError);
  });

  it("D5: rejects a participantId supplied for TRAINING/PITCH_HALL (not allowed there)", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: "session-1" } as never);

    await expect(
      createWeekplannerPlanAllocation(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        allocationGroup: "PITCH_HALL",
        participantId: "unexpected",
        facilityResourceId: PITCH_RESOURCE.id,
      }),
    ).rejects.toThrow(WeekplannerPlanAllocationInvalidParticipantError);
  });

  it("D6: rejects overriding a TrainingSession that does not belong to this tenant", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(
      createWeekplannerPlanAllocation(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-cross-tenant",
        allocationGroup: "PITCH_HALL",
        facilityResourceId: PITCH_RESOURCE.id,
      }),
    ).rejects.toThrow(WeekplannerPlanAllocationActivityNotFoundError);
  });

  it("D7: rejects a resource/group mismatch (e.g. a dressing room for PITCH_HALL)", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(ROOM_RESOURCE as never);

    await expect(
      createWeekplannerPlanAllocation(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        allocationGroup: "PITCH_HALL",
        facilityResourceId: ROOM_RESOURCE.id,
      }),
    ).rejects.toThrow(WeekplannerPlanAllocationGroupMismatchError);
  });

  it("D8: rejects a duplicate override for the same activity+group+resource", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(PITCH_RESOURCE as never);
    vi.mocked(prisma.weekplannerPlanAllocation.aggregate).mockResolvedValue({ _max: { displayOrder: 0 } } as never);
    vi.mocked(prisma.weekplannerPlanAllocation.create).mockRejectedValue(
      new Error("Unique constraint failed"),
    );

    await expect(
      createWeekplannerPlanAllocation(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        allocationGroup: "PITCH_HALL",
        facilityResourceId: PITCH_RESOURCE.id,
      }),
    ).rejects.toThrow(WeekplannerPlanAllocationDuplicateError);
  });

  it("D9: rejects overrides on an archived plan", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow({ archivedAt: new Date() }) as never);

    await expect(
      createWeekplannerPlanAllocation(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        allocationGroup: "PITCH_HALL",
        facilityResourceId: PITCH_RESOURCE.id,
      }),
    ).rejects.toThrow(WeekplannerPlanArchivedError);
  });
});

describe("E. deleteWeekplannerPlanAllocation", () => {
  it("E1: deletes an existing override row", async () => {
    vi.mocked(prisma.weekplannerPlanAllocation.findFirst).mockResolvedValue(allocationRow() as never);
    vi.mocked(prisma.weekplannerPlanAllocation.delete).mockResolvedValue({} as never);

    await deleteWeekplannerPlanAllocation(TENANT_A, "alloc-1");

    expect(prisma.weekplannerPlanAllocation.delete).toHaveBeenCalledWith({ where: { id: "alloc-1" } });
  });

  it("E2: a cross-tenant allocation id is treated as not found", async () => {
    vi.mocked(prisma.weekplannerPlanAllocation.findFirst).mockResolvedValue(null);

    await expect(deleteWeekplannerPlanAllocation(TENANT_B, "alloc-1")).rejects.toThrow(
      WeekplannerPlanAllocationNotFoundError,
    );
    expect(prisma.weekplannerPlanAllocation.delete).not.toHaveBeenCalled();
  });
});

// ── F. WeekplannerPlanActivityOverride — WEEKPLANNER-01D time overrides ────

const TRAINING_SESSION_WINDOW = {
  startAt: new Date("2026-08-10T16:00:00.000Z"),
  endAt: new Date("2026-08-10T17:30:00.000Z"),
};
const MATCH_EVENT_WINDOW = {
  startAt: new Date("2026-08-15T13:00:00.000Z"),
  endAt: new Date("2026-08-15T14:30:00.000Z"),
};
const TOURNAMENT_EVENT_WINDOW = {
  startAt: new Date("2026-08-15T08:00:00.000Z"),
  endAt: new Date("2026-08-15T16:00:00.000Z"),
};

function timeOverrideRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "time-override-1",
    tenantId: TENANT_A,
    weekplannerPlanId: PLAN_ID,
    activityType: "TRAINING",
    activityId: "session-1",
    overrideStartAt: new Date("2026-08-10T17:00:00.000Z"),
    overrideEndAt: new Date("2026-08-10T18:00:00.000Z"),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("F. setWeekplannerPlanActivityTimeOverride", () => {
  it("F1: sets a start/end time override for a TRAINING activity, replacing the canonical Standardplan time for THIS plan only", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(TRAINING_SESSION_WINDOW as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.upsert).mockResolvedValue(timeOverrideRow() as never);

    const override = await setWeekplannerPlanActivityTimeOverride(TENANT_A, {
      weekplannerPlanId: PLAN_ID,
      activityType: "TRAINING",
      activityId: "session-1",
      overrideStartAt: "2026-08-10T17:00:00.000Z",
      overrideEndAt: "2026-08-10T18:00:00.000Z",
    });

    expect(override?.overrideStartAt).toBe("2026-08-10T17:00:00.000Z");
    expect(override?.overrideEndAt).toBe("2026-08-10T18:00:00.000Z");
    // Never mutates the canonical TrainingSession — only findFirst is ever called on it.
    expect(prisma.trainingSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "session-1", tenantId: TENANT_A } }),
    );
  });

  it("F2: sets a time override for a HOME MATCH activity", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue(MATCH_EVENT_WINDOW as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.upsert).mockResolvedValue(
      timeOverrideRow({
        activityType: "MATCH",
        activityId: "match-1",
        overrideStartAt: new Date("2026-08-15T14:00:00.000Z"),
        overrideEndAt: new Date("2026-08-15T15:30:00.000Z"),
      }) as never,
    );

    const override = await setWeekplannerPlanActivityTimeOverride(TENANT_A, {
      weekplannerPlanId: PLAN_ID,
      activityType: "MATCH",
      activityId: "match-1",
      overrideStartAt: "2026-08-15T14:00:00.000Z",
      overrideEndAt: "2026-08-15T15:30:00.000Z",
    });

    expect(override?.activityType).toBe("MATCH");
    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "match-1", tenantId: TENANT_A, type: "MATCH" } }),
    );
  });

  it("F3: sets a time override for a HOME TOURNAMENT activity", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue(TOURNAMENT_EVENT_WINDOW as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.upsert).mockResolvedValue(
      timeOverrideRow({
        activityType: "TOURNAMENT",
        activityId: "tournament-1",
        overrideStartAt: new Date("2026-08-15T09:00:00.000Z"),
        overrideEndAt: null,
      }) as never,
    );

    const override = await setWeekplannerPlanActivityTimeOverride(TENANT_A, {
      weekplannerPlanId: PLAN_ID,
      activityType: "TOURNAMENT",
      activityId: "tournament-1",
      overrideStartAt: "2026-08-15T09:00:00.000Z",
    });

    expect(override?.activityType).toBe("TOURNAMENT");
    expect(override?.overrideEndAt).toBeNull();
    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tournament-1", tenantId: TENANT_A, type: "TOURNAMENT" } }),
    );
  });

  it("F4: rejects an override that would move the activity to a different calendar day (anti-drift)", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(TRAINING_SESSION_WINDOW as never);

    await expect(
      setWeekplannerPlanActivityTimeOverride(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        // Canonical day is 2026-08-10 (Europe/Zurich) — this instant is the NEXT day.
        overrideStartAt: "2026-08-11T17:00:00.000Z",
      }),
    ).rejects.toThrow(WeekplannerPlanTimeOverrideInvalidRangeError);
    expect(prisma.weekplannerPlanActivityOverride.upsert).not.toHaveBeenCalled();
  });

  it("F5: rejects an override where the effective end is not after the effective start", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(TRAINING_SESSION_WINDOW as never);

    await expect(
      setWeekplannerPlanActivityTimeOverride(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        overrideStartAt: "2026-08-10T18:00:00.000Z",
        overrideEndAt: "2026-08-10T17:00:00.000Z",
      }),
    ).rejects.toThrow(WeekplannerPlanTimeOverrideInvalidRangeError);
    expect(prisma.weekplannerPlanActivityOverride.upsert).not.toHaveBeenCalled();
  });

  it("F6: rejects overriding an activity that does not belong to this tenant", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(
      setWeekplannerPlanActivityTimeOverride(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-cross-tenant",
        overrideStartAt: "2026-08-10T17:00:00.000Z",
      }),
    ).rejects.toThrow(WeekplannerPlanAllocationActivityNotFoundError);
  });

  it("F7: rejects a time override on an archived plan", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow({ archivedAt: new Date() }) as never);

    await expect(
      setWeekplannerPlanActivityTimeOverride(TENANT_A, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        overrideStartAt: "2026-08-10T17:00:00.000Z",
      }),
    ).rejects.toThrow(WeekplannerPlanArchivedError);
  });

  it("F8: passing no start/end clears any existing override — 'Standardzeit verwenden' by omission", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(TRAINING_SESSION_WINDOW as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.delete).mockResolvedValue({} as never);

    const result = await setWeekplannerPlanActivityTimeOverride(TENANT_A, {
      weekplannerPlanId: PLAN_ID,
      activityType: "TRAINING",
      activityId: "session-1",
    });

    expect(result).toBeNull();
    expect(prisma.weekplannerPlanActivityOverride.delete).toHaveBeenCalledWith({
      where: { weekplannerPlanId_activityType_activityId: { weekplannerPlanId: PLAN_ID, activityType: "TRAINING", activityId: "session-1" } },
    });
    expect(prisma.weekplannerPlanActivityOverride.upsert).not.toHaveBeenCalled();
  });
});

describe("G. clearWeekplannerPlanActivityTimeOverride — 'Standardzeit verwenden'", () => {
  it("G1: removes an existing override, restoring the canonical Standardplan time", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.delete).mockResolvedValue({} as never);

    await clearWeekplannerPlanActivityTimeOverride(TENANT_A, PLAN_ID, "TRAINING", "session-1");

    expect(prisma.weekplannerPlanActivityOverride.delete).toHaveBeenCalledWith({
      where: { weekplannerPlanId_activityType_activityId: { weekplannerPlanId: PLAN_ID, activityType: "TRAINING", activityId: "session-1" } },
    });
  });

  it("G2: is idempotent — clearing when no override exists does not throw", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.delete).mockRejectedValue(new Error("Record not found"));

    await expect(
      clearWeekplannerPlanActivityTimeOverride(TENANT_A, PLAN_ID, "TRAINING", "session-1"),
    ).resolves.toBeUndefined();
  });
});

describe("H. getWeekplannerPlanActivityOverride — tenant isolation", () => {
  it("H1: returns null when no override row exists for this activity", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.findFirst).mockResolvedValue(null);

    const override = await getWeekplannerPlanActivityOverride(TENANT_A, PLAN_ID, "TRAINING", "session-1");
    expect(override).toBeNull();
  });

  it("H2: a cross-tenant plan id is treated as not found, never leaking another tenant's override", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    await expect(
      getWeekplannerPlanActivityOverride(TENANT_B, PLAN_ID, "TRAINING", "session-1"),
    ).rejects.toThrow(WeekplannerPlanNotFoundError);
    expect(prisma.weekplannerPlanActivityOverride.findFirst).not.toHaveBeenCalled();
  });
});

// ── I. WEEKPLANNER-01E — Operational Plan Activation Foundation ───────────

describe("I. getOperationalWeekplannerPlan — read resolver", () => {
  it("I1: no linked materialized plan → resolver returns null (Standardplan operationally active)", async () => {
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue({
      id: "wcp-default",
      tenantId: TENANT_A,
      name: "Standardplan",
      description: null,
      isDefault: true,
      isActive: true,
      displayOrder: 0,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      archivedAt: null,
    });
    vi.mocked(resolvePublicWeekplannerPlan).mockResolvedValue({
      weekplannerPlanId: null,
      activeWochenplanPlan: null,
      usedStandardplanFallback: false,
    });

    const result = await getOperationalWeekplannerPlan(TENANT_A, WEEK_ID);

    expect(result).toBeNull();
    expect(getActiveWochenplanPlan).toHaveBeenCalledWith(TENANT_A);
    expect(resolvePublicWeekplannerPlan).toHaveBeenCalledWith(TENANT_A, WEEK_ID, expect.any(Object));
  });

  it("I2: returns the linked materialized plan for the active alternative", async () => {
    const activePlan = {
      id: "wcp-alt",
      tenantId: TENANT_A,
      name: "Schlechtwetterplan",
      description: null,
      isDefault: false,
      isActive: true,
      displayOrder: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      archivedAt: null,
    };
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue(activePlan);
    vi.mocked(resolvePublicWeekplannerPlan).mockResolvedValue({
      weekplannerPlanId: PLAN_ID,
      activeWochenplanPlan: activePlan,
      usedStandardplanFallback: false,
    });
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow({ isActive: false }) as never);

    const result = await getOperationalWeekplannerPlan(TENANT_A, WEEK_ID);

    expect(result?.id).toBe(PLAN_ID);
    expect(resolvePublicWeekplannerPlan).toHaveBeenCalledWith(TENANT_A, WEEK_ID, activePlan);
  });

  it("I3: different weeks resolve independently (query is scoped by weekId)", async () => {
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue(null);
    vi.mocked(resolvePublicWeekplannerPlan).mockResolvedValue({
      weekplannerPlanId: null,
      activeWochenplanPlan: null,
      usedStandardplanFallback: false,
    });

    await getOperationalWeekplannerPlan(TENANT_A, "2026-08-17");

    expect(resolvePublicWeekplannerPlan).toHaveBeenCalledWith(TENANT_A, "2026-08-17", null);
  });

  it("I4: different tenants resolve independently (query is scoped by tenantId)", async () => {
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue(null);
    vi.mocked(resolvePublicWeekplannerPlan).mockResolvedValue({
      weekplannerPlanId: null,
      activeWochenplanPlan: null,
      usedStandardplanFallback: false,
    });

    await getOperationalWeekplannerPlan(TENANT_B, WEEK_ID);

    expect(getActiveWochenplanPlan).toHaveBeenCalledWith(TENANT_B);
    expect(resolvePublicWeekplannerPlan).toHaveBeenCalledWith(TENANT_B, WEEK_ID, null);
  });
});

describe("J. activateWeekplannerPlan", () => {
  it("J1: activates Plan A — no prior active plan in this tenant+week", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst)
      .mockResolvedValueOnce(planRow() as never) // requireActivePlan (pre-transaction)
      .mockResolvedValueOnce(planRow({ isActive: true }) as never); // final read inside tx
    vi.mocked(prisma.weekplannerPlan.updateMany)
      .mockResolvedValueOnce({ count: 0 } as never) // clear-others
      .mockResolvedValueOnce({ count: 1 } as never); // activate target

    const plan = await activateWeekplannerPlan(TENANT_A, PLAN_ID);

    expect(plan.isActive).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.weekplannerPlan.updateMany).toHaveBeenNthCalledWith(1, {
      where: { tenantId: TENANT_A, weekId: WEEK_ID, isActive: true, archivedAt: null, NOT: { id: PLAN_ID } },
      data: { isActive: false },
    });
    // FINDING 1 fix — the final activation is a conditional updateMany that
    // RE-CHECKS archivedAt: null at write time, not a blind `update`.
    expect(prisma.weekplannerPlan.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: PLAN_ID, tenantId: TENANT_A, weekId: WEEK_ID, archivedAt: null },
      data: { isActive: true },
    });
    expect(prisma.weekplannerPlan.update).not.toHaveBeenCalled();
  });

  it("J2: activating Plan B while Plan A is active deactivates Plan A atomically — never two active plans", async () => {
    const PLAN_B = "plan-2";
    vi.mocked(prisma.weekplannerPlan.findFirst)
      .mockResolvedValueOnce(planRow({ id: PLAN_B, isActive: false }) as never)
      .mockResolvedValueOnce(planRow({ id: PLAN_B, isActive: true }) as never);
    vi.mocked(prisma.weekplannerPlan.updateMany)
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 1 } as never);

    const plan = await activateWeekplannerPlan(TENANT_A, PLAN_B);

    expect(plan.id).toBe(PLAN_B);
    expect(plan.isActive).toBe(true);
    // Plan A (and any other active plan in this tenant+week) is cleared BEFORE Plan B is set.
    expect(prisma.weekplannerPlan.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A, weekId: WEEK_ID, isActive: true, NOT: { id: PLAN_B } }),
        data: { isActive: false },
      }),
    );
  });

  it("J3: archived plans cannot be activated (pre-transaction guard)", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow({ archivedAt: new Date() }) as never);

    await expect(activateWeekplannerPlan(TENANT_A, PLAN_ID)).rejects.toThrow(WeekplannerPlanArchivedError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("J4: cross-tenant activation is rejected as not found", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    await expect(activateWeekplannerPlan(TENANT_B, PLAN_ID)).rejects.toThrow(WeekplannerPlanNotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("J5: activation never mutates canonical Training/Match/Tournament data — only WeekplannerPlan rows are touched", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst)
      .mockResolvedValueOnce(planRow() as never)
      .mockResolvedValueOnce(planRow({ isActive: true }) as never);
    vi.mocked(prisma.weekplannerPlan.updateMany)
      .mockResolvedValueOnce({ count: 0 } as never)
      .mockResolvedValueOnce({ count: 1 } as never);

    await activateWeekplannerPlan(TENANT_A, PLAN_ID);

    expect(prisma.trainingSession.findFirst).not.toHaveBeenCalled();
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  // ── WEEKPLANNER-01E-C1 — Finding 1: archive/activate race regression ────

  it("J6: FINDING 1 — target archived between the pre-check and the final write is surfaced as WeekplannerPlanArchivedError, never isActive=true", async () => {
    // requireActivePlan() sees the plan as still active/non-archived...
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValueOnce(planRow() as never);
    // ...but a concurrent archiveWeekplannerPlan() commits before this
    // transaction's final conditional write, so the archivedAt: null
    // predicate now matches zero rows.
    vi.mocked(prisma.weekplannerPlan.updateMany)
      .mockResolvedValueOnce({ count: 0 } as never) // clear-others
      .mockResolvedValueOnce({ count: 0 } as never); // activate target — 0 rows: became archived

    await expect(activateWeekplannerPlan(TENANT_A, PLAN_ID)).rejects.toThrow(WeekplannerPlanArchivedError);

    // The final write re-checked archivedAt: null explicitly.
    expect(prisma.weekplannerPlan.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: PLAN_ID, tenantId: TENANT_A, weekId: WEEK_ID, archivedAt: null },
      data: { isActive: true },
    });
    // No unconditional `update` call could ever force isActive=true on an archived row.
    expect(prisma.weekplannerPlan.update).not.toHaveBeenCalled();
  });

  it("J7: FINDING 1 — transaction rollback: when the target activation fails because it became archived, the interactive transaction callback throws so Prisma rolls back the WHOLE transaction, including the earlier deactivation of the previously active plan", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValueOnce(planRow() as never);
    vi.mocked(prisma.weekplannerPlan.updateMany)
      .mockResolvedValueOnce({ count: 1 } as never) // a previously active plan WAS cleared in this tx...
      .mockResolvedValueOnce({ count: 0 } as never); // ...but activating the target failed (archived)

    // vi.mocked($transaction)'s test-harness implementation (see beforeEach)
    // invokes the callback directly and propagates any thrown error exactly
    // like Prisma's real interactive transaction does on rollback — the
    // callback's own earlier writes are not separately observable as
    // "committed" once the callback rejects.
    await expect(activateWeekplannerPlan(TENANT_A, PLAN_ID)).rejects.toThrow(WeekplannerPlanArchivedError);

    // The final read (which would return the "successfully activated" row)
    // must never be reached once the conditional write signalled failure.
    expect(prisma.weekplannerPlan.findFirst).toHaveBeenCalledTimes(1);
  });

  // ── WEEKPLANNER-01E-C1 — Finding 2: concurrent A/B activation (P2002) ────

  it("J8: FINDING 2 — a concurrent activation of a DIFFERENT plan that commits first surfaces as WeekplannerPlanActivationConflictError (P2002 mapped, not an uncontrolled throw)", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValueOnce(planRow() as never);
    vi.mocked(prisma.weekplannerPlan.updateMany).mockResolvedValueOnce({ count: 0 } as never);
    // The DB's partial unique index rejects the final activation write
    // because a different plan in the same tenant+week was just committed
    // as active by a concurrent activateWeekplannerPlan() call.
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(prismaUniqueViolation());

    await expect(activateWeekplannerPlan(TENANT_A, PLAN_ID)).rejects.toThrow(WeekplannerPlanActivationConflictError);
  });

  it("J9: FINDING 2 — an unrelated Prisma error code is never converted to WeekplannerPlanActivationConflictError", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValueOnce(planRow() as never);
    const unrelated = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "test",
    });
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(unrelated);

    await expect(activateWeekplannerPlan(TENANT_A, PLAN_ID)).rejects.toBe(unrelated);
  });

  it("J10: FINDING 2 — a non-Prisma error from the transaction is never converted to WeekplannerPlanActivationConflictError", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValueOnce(planRow() as never);
    const genericFailure = new Error("connection reset");
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(genericFailure);

    await expect(activateWeekplannerPlan(TENANT_A, PLAN_ID)).rejects.toBe(genericFailure);
  });

  it("J11: the DB remains the ultimate enforcement point — the service never itself decides which of two racing activations wins, it only relays the DB's verdict", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValueOnce(planRow() as never);
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(prismaUniqueViolation());

    await expect(activateWeekplannerPlan(TENANT_A, PLAN_ID)).rejects.toThrow(
      /could not be activated — another plan was activated concurrently/,
    );
  });
});

describe("K. deactivateWeekplannerPlan", () => {
  it("K1: deactivates the active plan — no active alternative remains (Standardplan operationally active)", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow({ isActive: true }) as never);
    vi.mocked(prisma.weekplannerPlan.update).mockResolvedValue(planRow({ isActive: false }) as never);

    const plan = await deactivateWeekplannerPlan(TENANT_A, PLAN_ID);

    expect(plan.isActive).toBe(false);
    expect(prisma.weekplannerPlan.update).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
      data: { isActive: false },
    });
  });

  it("K2: cross-tenant deactivation is rejected as not found", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    await expect(deactivateWeekplannerPlan(TENANT_B, PLAN_ID)).rejects.toThrow(WeekplannerPlanNotFoundError);
    expect(prisma.weekplannerPlan.update).not.toHaveBeenCalled();
  });
});

describe("L. archiveWeekplannerPlan — activation interaction", () => {
  it("L1: archiving the active plan clears isActive in the same update — Standardplan becomes operationally effective", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(planRow({ isActive: true }) as never);
    vi.mocked(prisma.weekplannerPlan.update).mockResolvedValue(
      planRow({ isActive: false, archivedAt: new Date() }) as never,
    );

    const plan = await archiveWeekplannerPlan(TENANT_A, PLAN_ID);

    expect(plan.isActive).toBe(false);
    expect(plan.archivedAt).not.toBeNull();
    expect(prisma.weekplannerPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PLAN_ID }, data: expect.objectContaining({ isActive: false, archivedAt: expect.any(Date) }) }),
    );
  });
});
