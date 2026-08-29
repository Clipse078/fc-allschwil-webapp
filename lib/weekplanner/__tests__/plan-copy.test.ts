/**
 * lib/weekplanner/__tests__/plan-copy.test.ts
 *
 * WOCHENPLAN-2.0-01H-C — copy weekly operational state tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlan: { findFirst: vi.fn() },
    weekplannerPlan: { findFirst: vi.fn() },
    $transaction: vi.fn(),
    weekplannerPlanAllocation: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    weekplannerPlanActivityOverride: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/wochenplan/public-plan-resolution", () => ({
  findLinkedWeekplannerPlan: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { findLinkedWeekplannerPlan } from "@/lib/wochenplan/public-plan-resolution";
import { copyWeekplannerOperationalState } from "../plan-copy";
import { WochenplanPlanArchivedError, WochenplanPlanNotFoundError } from "@/lib/wochenplan/plan-errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const WEEK_ID = "2026-08-25";
const SOURCE_WCP = "wcp-source";
const TARGET_WP = "wp-target";
const SOURCE_WP = "wp-source";

describe("copyWeekplannerOperationalState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: SOURCE_WCP,
      isDefault: false,
      archivedAt: null,
    } as never);
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({
      id: TARGET_WP,
      weekId: WEEK_ID,
    } as never);
    vi.mocked(findLinkedWeekplannerPlan).mockResolvedValue({ id: SOURCE_WP });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        weekplannerPlanAllocation: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          findMany: vi.fn().mockResolvedValue([
            {
              activityType: "TRAINING",
              activityId: "session-1",
              allocationGroup: "PITCH_HALL",
              participantId: "",
              facilityResourceId: "pitch-2",
              notes: null,
              displayOrder: 0,
            },
          ]),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        weekplannerPlanActivityOverride: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          findMany: vi.fn().mockResolvedValue([
            {
              activityType: "TRAINING",
              activityId: "session-1",
              overrideStartAt: new Date("2026-08-26T15:30:00.000Z"),
              overrideEndAt: new Date("2026-08-26T17:00:00.000Z"),
            },
          ]),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      } as never),
    );
  });

  it("copies allocation and time override rows from a materialized source plan", async () => {
    await copyWeekplannerOperationalState(TENANT_A, WEEK_ID, SOURCE_WCP, TARGET_WP);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(findLinkedWeekplannerPlan).toHaveBeenCalledWith(TENANT_A, WEEK_ID, SOURCE_WCP);
  });

  it("does nothing when source is the default Standardplan definition", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: SOURCE_WCP,
      isDefault: true,
      archivedAt: null,
    } as never);

    await copyWeekplannerOperationalState(TENANT_A, WEEK_ID, SOURCE_WCP, TARGET_WP);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing when source has no materialized week instance", async () => {
    vi.mocked(findLinkedWeekplannerPlan).mockResolvedValue(null);

    await copyWeekplannerOperationalState(TENANT_A, WEEK_ID, SOURCE_WCP, TARGET_WP);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects archived source plans", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: SOURCE_WCP,
      isDefault: false,
      archivedAt: new Date(),
    } as never);

    await expect(
      copyWeekplannerOperationalState(TENANT_A, WEEK_ID, SOURCE_WCP, TARGET_WP),
    ).rejects.toBeInstanceOf(WochenplanPlanArchivedError);
  });

  it("rejects cross-tenant source plans", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(null);

    await expect(
      copyWeekplannerOperationalState(TENANT_B, WEEK_ID, SOURCE_WCP, TARGET_WP),
    ).rejects.toBeInstanceOf(WochenplanPlanNotFoundError);
  });
});
