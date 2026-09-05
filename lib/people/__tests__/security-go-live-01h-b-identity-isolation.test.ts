import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  personFindFirst: vi.fn(),
  personFindUnique: vi.fn(),
  personUpdateMany: vi.fn(),
  membershipFindUnique: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: {
      findFirst: mocks.personFindFirst,
      findUnique: mocks.personFindUnique,
      updateMany: mocks.personUpdateMany,
    },
    tenantMembership: { findUnique: mocks.membershipFindUnique },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.logAction }));

import { linkPersonToUser, unlinkPersonFromUser } from "@/lib/people/mutations";
import {
  PersonNotFoundError,
  UserNotEligibleError,
} from "@/lib/people/errors";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.personFindFirst.mockResolvedValue({ id: "person-a", userId: null });
  mocks.membershipFindUnique.mockResolvedValue({
    isActive: true,
    user: { id: "user-a", isActive: true },
  });
  mocks.personFindUnique.mockResolvedValue(null);
  mocks.personUpdateMany.mockResolvedValue({ count: 1 });
  mocks.logAction.mockResolvedValue(undefined);
});

describe("SECURITY-GO-LIVE-01H-B Person ↔ User isolation", () => {
  it("11. links a Tenant A Person to an eligible Tenant A User", async () => {
    const result = await linkPersonToUser({
      personId: "person-a",
      userId: "user-a",
      tenantId: "tenant-a",
      actorUserId: "actor-a",
    });

    expect(result).toEqual({ personId: "person-a", userId: "user-a" });
    expect(mocks.personFindFirst).toHaveBeenCalledWith({
      where: { id: "person-a", tenantId: "tenant-a" },
      select: { id: true, userId: true },
    });
    expect(mocks.personUpdateMany).toHaveBeenCalledWith({
      where: { id: "person-a", tenantId: "tenant-a", userId: null },
      data: { userId: "user-a" },
    });
  });

  it("12/14. treats a Tenant B or nonexistent Person as not found before user lookup", async () => {
    mocks.personFindFirst.mockResolvedValue(null);

    await expect(
      linkPersonToUser({
        personId: "foreign-or-missing-person",
        userId: "user-a",
        tenantId: "tenant-a",
      }),
    ).rejects.toBeInstanceOf(PersonNotFoundError);
    expect(mocks.membershipFindUnique).not.toHaveBeenCalled();
    expect(mocks.personUpdateMany).not.toHaveBeenCalled();
  });

  it("13. rejects a Tenant B-only or inactive User with one fail-closed error", async () => {
    mocks.membershipFindUnique.mockResolvedValue(null);

    await expect(
      linkPersonToUser({
        personId: "person-a",
        userId: "user-b",
        tenantId: "tenant-a",
      }),
    ).rejects.toBeInstanceOf(UserNotEligibleError);
    expect(mocks.personUpdateMany).not.toHaveBeenCalled();
  });

  it("uses the same user error for nonexistent IDs and never probes the global User table", async () => {
    mocks.membershipFindUnique.mockResolvedValue(null);

    await expect(
      linkPersonToUser({
        personId: "person-a",
        userId: "missing-user",
        tenantId: "tenant-a",
      }),
    ).rejects.toBeInstanceOf(UserNotEligibleError);
  });

  it("15. unlinks only the Tenant A-owned Person using a conditional mutation", async () => {
    mocks.personFindFirst.mockResolvedValue({ id: "person-a", userId: "user-a" });

    const result = await unlinkPersonFromUser({
      personId: "person-a",
      tenantId: "tenant-a",
      actorUserId: "actor-a",
    });

    expect(result).toEqual({ unlinked: true });
    expect(mocks.personUpdateMany).toHaveBeenCalledWith({
      where: { id: "person-a", tenantId: "tenant-a", userId: "user-a" },
      data: { userId: null },
    });
  });

  it("16/17. cannot distinguish or unlink a Tenant B Person versus a nonexistent Person", async () => {
    mocks.personFindFirst.mockResolvedValue(null);

    const unlink = (personId: string) =>
      unlinkPersonFromUser({ personId, tenantId: "tenant-a" });

    await expect(unlink("person-b")).rejects.toMatchObject({
      code: "PERSON_NOT_FOUND",
      status: 404,
    });
    await expect(unlink("missing-person")).rejects.toMatchObject({
      code: "PERSON_NOT_FOUND",
      status: 404,
    });
    expect(mocks.personUpdateMany).not.toHaveBeenCalled();
  });
});
