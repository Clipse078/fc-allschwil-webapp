/**
 * ADMIN-HARD-DELETE-UI — Role delete service unit tests.
 *
 * Covers:
 *   RS-01  getRoleDeletionImpact returns null for non-existent role
 *   RS-02  getRoleDeletionImpact returns WRONG_TENANT blocker for cross-tenant role
 *   RS-03  getRoleDeletionImpact returns PLATFORM_ROLE blocker for platform-scoped roles
 *   RS-04  getRoleDeletionImpact returns SYSTEM_ROLE blocker for system roles
 *   RS-05  getRoleDeletionImpact returns correct impact for non-system tenant roles
 *   RS-06  deleteRolePermanently returns null for non-existent role
 *   RS-07  deleteRolePermanently propagates blocker for system role
 *   RS-08  deleteRolePermanently calls prisma.role.delete on success
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    role: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    userRole: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  getRoleDeletionImpact,
  deleteRolePermanently,
} from "@/lib/roles/role-delete-service";

const mockPrisma = prisma as unknown as {
  role: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  userRole: { count: ReturnType<typeof vi.fn> };
};

const TENANT_ID = "tenant-abc";

describe("ADMIN-HARD-DELETE-UI — role-delete-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRoleDeletionImpact", () => {
    it("RS-01: returns null when role does not exist", async () => {
      mockPrisma.role.findUnique.mockResolvedValueOnce(null);
      expect(await getRoleDeletionImpact(TENANT_ID, "no-role")).toBeNull();
    });

    it("RS-02: returns WRONG_TENANT blocker for cross-tenant role", async () => {
      mockPrisma.role.findUnique.mockResolvedValueOnce({
        tenantId: "other-tenant",
        scope: "TENANT",
        isSystem: false,
        name: "SomeRole",
        key: "some_role",
        _count: { userRoles: 0, rolePermissions: 0, workflowRules: 0 },
      });

      const result = await getRoleDeletionImpact(TENANT_ID, "role-1");
      expect(result).toMatchObject({ blocked: true, blocker: { reason: "WRONG_TENANT" } });
    });

    it("RS-03: returns PLATFORM_ROLE blocker for platform-scoped roles", async () => {
      mockPrisma.role.findUnique.mockResolvedValueOnce({
        tenantId: TENANT_ID,
        scope: "PLATFORM",
        isSystem: false,
        name: "PlatformRole",
        key: "platform_role",
        _count: { userRoles: 0, rolePermissions: 0, workflowRules: 0 },
      });

      const result = await getRoleDeletionImpact(TENANT_ID, "role-2");
      expect(result).toMatchObject({ blocked: true, blocker: { reason: "PLATFORM_ROLE" } });
    });

    it("RS-04: returns SYSTEM_ROLE blocker for system roles", async () => {
      mockPrisma.role.findUnique.mockResolvedValueOnce({
        tenantId: TENANT_ID,
        scope: "TENANT",
        isSystem: true,
        name: "Club Admin",
        key: "club_admin",
        _count: { userRoles: 2, rolePermissions: 30, workflowRules: 0 },
      });

      const result = await getRoleDeletionImpact(TENANT_ID, "role-3");
      expect(result).toMatchObject({ blocked: true, blocker: { reason: "SYSTEM_ROLE" } });
    });

    it("RS-05: returns correct impact for non-system tenant role", async () => {
      mockPrisma.role.findUnique.mockResolvedValueOnce({
        tenantId: TENANT_ID,
        scope: "TENANT",
        isSystem: false,
        name: "Custom Role",
        key: "custom_role",
        _count: { userRoles: 4, rolePermissions: 8, workflowRules: 2 },
      });
      mockPrisma.userRole.count.mockResolvedValueOnce(3);

      const result = await getRoleDeletionImpact(TENANT_ID, "role-4");
      expect(result).toMatchObject({
        blocked: false,
        impact: {
          activeUserCount: 3,
          totalUserRoleCount: 4,
          permissionCount: 8,
          workflowRuleCount: 2,
        },
      });
    });
  });

  describe("deleteRolePermanently", () => {
    it("RS-06: returns null when role does not exist", async () => {
      mockPrisma.role.findUnique.mockResolvedValueOnce(null);
      expect(await deleteRolePermanently(TENANT_ID, "no-role")).toBeNull();
      expect(mockPrisma.role.delete).not.toHaveBeenCalled();
    });

    it("RS-07: propagates blocker for system role (no delete called)", async () => {
      mockPrisma.role.findUnique.mockResolvedValueOnce({
        tenantId: TENANT_ID,
        scope: "TENANT",
        isSystem: true,
        name: "Club Admin",
        key: "club_admin",
        _count: { userRoles: 1, rolePermissions: 20, workflowRules: 0 },
      });

      const result = await deleteRolePermanently(TENANT_ID, "role-sys");
      expect(result).toMatchObject({ reason: "SYSTEM_ROLE" });
      expect(mockPrisma.role.delete).not.toHaveBeenCalled();
    });

    it("RS-08: calls prisma.role.delete for non-system role and returns result", async () => {
      // First call: getRoleDeletionImpact (in deleteRolePermanently)
      mockPrisma.role.findUnique
        .mockResolvedValueOnce({
          tenantId: TENANT_ID,
          scope: "TENANT",
          isSystem: false,
          name: "Custom",
          key: "custom",
          _count: { userRoles: 0, rolePermissions: 5, workflowRules: 0 },
        })
        // Second call: the findUnique inside deleteRolePermanently for name/key
        .mockResolvedValueOnce({ name: "Custom", key: "custom" });

      mockPrisma.userRole.count.mockResolvedValueOnce(0);
      mockPrisma.role.delete.mockResolvedValueOnce({});

      const result = await deleteRolePermanently(TENANT_ID, "role-5");

      expect(mockPrisma.role.delete).toHaveBeenCalledWith({ where: { id: "role-5" } });
      expect(result).toMatchObject({
        roleId: "role-5",
        roleName: "Custom",
        roleKey: "custom",
      });
    });
  });
});
