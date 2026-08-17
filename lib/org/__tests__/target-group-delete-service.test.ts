/**
 * ADMIN-HARD-DELETE-UI — TargetGroup delete service unit tests.
 *
 * Covers:
 *   TG-01  getTargetGroupDeletionImpact returns null for non-existent group
 *   TG-02  getTargetGroupDeletionImpact returns null for wrong tenant
 *   TG-03  getTargetGroupDeletionImpact returns impact with linkedRegistrations count
 *   TG-04  deleteTargetGroupPermanently calls prisma.targetGroup.delete on success
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    targetGroup: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  getTargetGroupDeletionImpact,
  deleteTargetGroupPermanently,
} from "@/lib/org/target-group-delete-service";

const mockPrisma = prisma as unknown as {
  targetGroup: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
};

const TENANT_ID = "tenant-abc";

describe("ADMIN-HARD-DELETE-UI — target-group-delete-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TG-01: returns null for non-existent target group", async () => {
    mockPrisma.targetGroup.findUnique.mockResolvedValueOnce(null);
    expect(await getTargetGroupDeletionImpact(TENANT_ID, "no-tg")).toBeNull();
  });

  it("TG-02: returns null for target group belonging to a different tenant", async () => {
    mockPrisma.targetGroup.findUnique.mockResolvedValueOnce({
      tenantId: "other-tenant",
      _count: { registrations: 5 },
    });
    expect(await getTargetGroupDeletionImpact(TENANT_ID, "tg-1")).toBeNull();
  });

  it("TG-03: returns correct impact for valid target group", async () => {
    mockPrisma.targetGroup.findUnique.mockResolvedValueOnce({
      tenantId: TENANT_ID,
      _count: { registrations: 7 },
    });
    const result = await getTargetGroupDeletionImpact(TENANT_ID, "tg-2");
    expect(result).toEqual({ linkedRegistrations: 7 });
  });

  it("TG-03b: null tenantId (global tg) is treated as matching any tenant", async () => {
    mockPrisma.targetGroup.findUnique.mockResolvedValueOnce({
      tenantId: null,
      _count: { registrations: 3 },
    });
    const result = await getTargetGroupDeletionImpact(TENANT_ID, "tg-global");
    expect(result).toEqual({ linkedRegistrations: 3 });
  });

  it("TG-04: calls prisma.targetGroup.delete on success", async () => {
    mockPrisma.targetGroup.findUnique.mockResolvedValueOnce({
      tenantId: TENANT_ID,
      name: "U14 Gruppe",
      key: "u14",
      _count: { registrations: 2 },
    });
    mockPrisma.targetGroup.delete.mockResolvedValueOnce({});

    const result = await deleteTargetGroupPermanently(TENANT_ID, "tg-3");
    expect(mockPrisma.targetGroup.delete).toHaveBeenCalledWith({ where: { id: "tg-3" } });
    expect(result).toMatchObject({
      targetGroupId: "tg-3",
      name: "U14 Gruppe",
      key: "u14",
      impact: { linkedRegistrations: 2 },
    });
  });
});
