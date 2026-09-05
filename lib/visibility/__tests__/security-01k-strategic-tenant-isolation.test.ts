import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/lib/visibility/actor-context";

const mocks = vi.hoisted(() => ({
  meetingFindMany: vi.fn(),
  meetingFindFirst: vi.fn(),
  meetingDelete: vi.fn(),
  meetingCount: vi.fn(),
  meetingActionCount: vi.fn(),
  initiativeFindMany: vi.fn(),
  initiativeFindFirst: vi.fn(),
  initiativeDelete: vi.fn(),
  targetFindMany: vi.fn(),
  targetFindFirst: vi.fn(),
  targetDelete: vi.fn(),
  targetCount: vi.fn(),
  targetDataPointCount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    meeting: {
      findMany: mocks.meetingFindMany,
      findFirst: mocks.meetingFindFirst,
      delete: mocks.meetingDelete,
      count: mocks.meetingCount,
    },
    initiative: {
      findMany: mocks.initiativeFindMany,
      findFirst: mocks.initiativeFindFirst,
      delete: mocks.initiativeDelete,
    },
    target: {
      findMany: mocks.targetFindMany,
      findFirst: mocks.targetFindFirst,
      delete: mocks.targetDelete,
      count: mocks.targetCount,
    },
    meetingAction: { count: mocks.meetingActionCount },
    targetDataPoint: { count: mocks.targetDataPointCount },
  },
}));

import { getMeetings } from "@/lib/meetings/queries";
import { getInitiatives } from "@/lib/initiatives/queries";
import { getTargets } from "@/lib/targets/queries";
import { deleteMeetingPermanently } from "@/lib/meetings/meeting-delete-service";
import { deleteInitiativePermanently } from "@/lib/initiatives/initiative-delete-service";
import { deleteTargetPermanently } from "@/lib/targets/target-delete-service";
import {
  getDashboardMeetingSummary,
  getOperativeStrategicCounts,
} from "@/lib/dashboard/strategic-summary";

const actor: ActorContext = {
  userId: "actor-a",
  tenantId: "tenant-a",
  roleKeys: [],
  permissionKeys: [
    "meetings.view",
    "initiatives.view",
    "targets.view",
  ],
  orgUnitIds: [],
  targetGroupIds: [],
};

describe("SECURITY-GO-LIVE-01K-A strategic tenant ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.meetingFindMany.mockResolvedValue([]);
    mocks.initiativeFindMany.mockResolvedValue([]);
    mocks.targetFindMany.mockResolvedValue([]);
  });

  it("scopes every strategic list read to the active tenant", async () => {
    await getMeetings(actor);
    await getInitiatives(actor);
    await getTargets(actor);

    expect(mocks.meetingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
    );
    expect(mocks.initiativeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
    );
    expect(mocks.targetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
    );
  });

  it.each([
    [
      "Meeting",
      mocks.meetingFindFirst,
      mocks.meetingDelete,
      () => deleteMeetingPermanently("tenant-b-object", "tenant-a"),
    ],
    [
      "Initiative",
      mocks.initiativeFindFirst,
      mocks.initiativeDelete,
      () => deleteInitiativePermanently("tenant-b-object", "tenant-a"),
    ],
    [
      "Target",
      mocks.targetFindFirst,
      mocks.targetDelete,
      () => deleteTargetPermanently("tenant-b-object", "tenant-a"),
    ],
  ])(
    "fails a swapped foreign %s id safely before mutation",
    async (_model, findFirst, deleteRecord, execute) => {
      findFirst.mockResolvedValueOnce(null);

      await expect(execute()).resolves.toBeNull();
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "tenant-b-object", tenantId: "tenant-a" },
        }),
      );
      expect(deleteRecord).not.toHaveBeenCalled();
    },
  );

  it("scopes dashboard strategic summaries to the live actor tenant", async () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    mocks.meetingCount.mockResolvedValueOnce(2);
    mocks.meetingActionCount.mockResolvedValueOnce(3);
    mocks.targetCount.mockResolvedValueOnce(4);

    await getDashboardMeetingSummary(actor, now);
    await expect(getOperativeStrategicCounts(actor, now)).resolves.toEqual({
      activeTargetCount: 4,
      plannedMeetingCount: 2,
      overdueActionCount: 3,
    });

    expect(mocks.meetingFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.meetingFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { tenantId: "tenant-a" } }),
    );
    expect(mocks.meetingFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
    );
    expect(mocks.targetCount).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", status: "ACTIVE" },
    });
    expect(mocks.meetingCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
    );
    expect(mocks.meetingActionCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          meeting: expect.objectContaining({ tenantId: "tenant-a" }),
        }),
      }),
    );
  });

  it("does not query strategic summaries without current permissions", async () => {
    const unauthorizedActor = { ...actor, permissionKeys: [] };

    await expect(
      getDashboardMeetingSummary(unauthorizedActor),
    ).resolves.toEqual({ recentMeetings: [], upcomingMeetings: [] });
    await expect(
      getOperativeStrategicCounts(unauthorizedActor),
    ).resolves.toEqual({
      activeTargetCount: 0,
      plannedMeetingCount: 0,
      overdueActionCount: 0,
    });

    expect(mocks.meetingFindMany).not.toHaveBeenCalled();
    expect(mocks.meetingCount).not.toHaveBeenCalled();
    expect(mocks.meetingActionCount).not.toHaveBeenCalled();
    expect(mocks.targetCount).not.toHaveBeenCalled();
  });
});
