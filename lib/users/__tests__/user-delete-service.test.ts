/**
 * ADMIN-HARD-DELETE-UI — User delete service unit tests.
 *
 * Covers:
 *   UD-01  getUserDeletionImpact returns null for non-existent user
 *   UD-02  getUserDeletionImpact returns LAST_SUPER_ADMIN blocker for last super_admin
 *   UD-03  getUserDeletionImpact returns correct impact when multiple super_admins exist
 *   UD-04  getUserDeletionImpact returns correct impact for non-super-admin user
 *   UD-05  deleteUserPermanently returns null for non-existent user
 *   UD-06  deleteUserPermanently propagates LAST_SUPER_ADMIN blocker
 *   UD-07  deleteUserPermanently calls prisma.user.delete on success
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: (() => {
    const client = {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    userRole: {
      count: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    };
    return {
      ...client,
      $transaction: vi.fn(async (callback: (tx: typeof client) => unknown) =>
        callback(client),
      ),
    };
  })(),
}));

import { prisma } from "@/lib/db/prisma";
import {
  getUserDeletionImpact,
  deleteUserPermanently,
} from "@/lib/users/user-delete-service";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  userRole: { count: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("ADMIN-HARD-DELETE-UI — user-delete-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserDeletionImpact", () => {
    it("UD-01: returns null when user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      expect(await getUserDeletionImpact("no-user")).toBeNull();
    });

    it("UD-02: returns LAST_SUPER_ADMIN blocker when only one super_admin remains", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: "admin@example.com",
        firstName: "Super",
        lastName: "Admin",
        isActive: true,
        _count: { userRoles: 1, tenantMemberships: 0 },
        person: null,
        userRoles: [{ id: "ur-super" }],
      });
      // Only 1 remaining super_admin
      mockPrisma.userRole.count.mockResolvedValueOnce(1);

      const result = await getUserDeletionImpact("user-1");
      expect(result).toMatchObject({
        blocked: true,
        blocker: { reason: "LAST_SUPER_ADMIN" },
      });
    });

    it("UD-03: returns impact when multiple super_admins exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: "admin1@example.com",
        firstName: "Admin",
        lastName: "One",
        isActive: true,
        _count: { userRoles: 1, tenantMemberships: 2 },
        person: null,
        userRoles: [{ id: "ur-super" }],
      });
      // 2 remaining super_admins → not last
      mockPrisma.userRole.count.mockResolvedValueOnce(2);

      const result = await getUserDeletionImpact("user-2");
      expect(result).toMatchObject({
        blocked: false,
        impact: {
          tenantMemberships: 2,
          roleAssignments: 1,
          hasLinkedPerson: false,
          isPlatformSuperAdmin: true,
          email: "admin1@example.com",
        },
      });
    });

    it("UD-04: returns correct impact for non-super-admin user with linked Person", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: "user@example.com",
        firstName: "Max",
        lastName: "Muster",
        isActive: true,
        _count: { userRoles: 2, tenantMemberships: 1 },
        person: { id: "person-1", firstName: "Max", lastName: "Muster" },
        userRoles: [],
      });

      const result = await getUserDeletionImpact("user-3");
      expect(result).toMatchObject({
        blocked: false,
        impact: {
          tenantMemberships: 1,
          roleAssignments: 2,
          hasLinkedPerson: true,
          linkedPersonId: "person-1",
          linkedPersonName: "Max Muster",
          isPlatformSuperAdmin: false,
          email: "user@example.com",
        },
      });
    });
  });

  describe("deleteUserPermanently", () => {
    it("UD-05: returns null when user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      expect(await deleteUserPermanently("no-user")).toBeNull();
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it("UD-06: propagates LAST_SUPER_ADMIN blocker without deleting", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: "admin@example.com",
        firstName: "Super",
        lastName: "Admin",
        isActive: true,
        _count: { userRoles: 1, tenantMemberships: 0 },
        person: null,
        userRoles: [{ id: "ur-super" }],
      });
      mockPrisma.userRole.count.mockResolvedValueOnce(1);

      const result = await deleteUserPermanently("user-last-admin");
      expect(result).toMatchObject({ reason: "LAST_SUPER_ADMIN" });
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it("UD-07: calls prisma.user.delete and returns result on success", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: "user@example.com",
        firstName: "Jane",
        lastName: "Doe",
        isActive: true,
        _count: { userRoles: 1, tenantMemberships: 1 },
        person: null,
        userRoles: [],
      });
      mockPrisma.user.delete.mockResolvedValueOnce({});

      const result = await deleteUserPermanently("user-4");
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-4" } });
      expect(result).toMatchObject({
        userId: "user-4",
        email: "user@example.com",
        displayName: "Jane Doe",
      });
    });
  });
});
