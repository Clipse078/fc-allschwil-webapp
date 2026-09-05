import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/lib/visibility/actor-context";

const mocks = vi.hoisted(() => ({
  meetingFindMany: vi.fn(),
  meetingFindFirst: vi.fn(),
  meetingDelete: vi.fn(),
  initiativeFindMany: vi.fn(),
  initiativeFindFirst: vi.fn(),
  initiativeDelete: vi.fn(),
  targetFindMany: vi.fn(),
  targetFindFirst: vi.fn(),
  targetDelete: vi.fn(),
  targetDataPointCount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    meeting: {
      findMany: mocks.meetingFindMany,
      findFirst: mocks.meetingFindFirst,
      delete: mocks.meetingDelete,
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
    },
    targetDataPoint: { count: mocks.targetDataPointCount },
  },
}));

import { getMeetings } from "@/lib/meetings/queries";
import { getInitiatives } from "@/lib/initiatives/queries";
import { getTargets } from "@/lib/targets/queries";
import { deleteMeetingPermanently } from "@/lib/meetings/meeting-delete-service";
import { deleteInitiativePermanently } from "@/lib/initiatives/initiative-delete-service";
import { deleteTargetPermanently } from "@/lib/targets/target-delete-service";

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
});
