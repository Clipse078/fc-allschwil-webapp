/**
 * lib/permissions/__tests__/admin-delete-03a-workspace-delete-permission-foundation.test.ts
 *
 * ADMIN-DELETE-03A — Verifies that:
 *   1. PERMISSIONS.WORKSPACE_DELETE resolves to the canonical "workspace.delete" key.
 *   2. The reconciliation module exports the correct permission definition.
 *   3. reconcileWorkspaceDeletePermission correctly performs upserts in apply mode.
 *   4. reconcileWorkspaceDeletePermission is idempotent (already_exists / already_assigned).
 *   5. dryRun=true makes no DB writes.
 *   6. Grants workspace.delete to every tenant Club Admin role found.
 */

import { describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  WORKSPACE_DELETE_PERMISSION_DEF,
  reconcileWorkspaceDeletePermission,
} from "@/lib/permissions/workspace-delete-permission-reconciliation";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PERM_OBJ = {
  id: "perm-1",
  name: "Permanently delete documents",
  module: "WORKSPACE",
  scope: "TENANT",
  grantableByAdmin: true,
};

const SUPER_ADMIN_ROLE = { id: "role-sa" };

/**
 * Builds a minimal mockPrisma that satisfies reconcileWorkspaceDeletePermission.
 * Each call is a fresh vi.fn() so tests don't share state.
 */
function buildMockPrisma({
  permissionExists = false,
  roleGrantExists = false,
  clubAdminRoles = [] as { key: string }[],
} = {}) {
  const permissionFindUnique = vi.fn().mockResolvedValue(
    permissionExists ? PERM_OBJ : null,
  );
  const permissionUpsert = vi.fn().mockResolvedValue(PERM_OBJ);

  const roleFindUnique = vi.fn().mockImplementation(
    ({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      const caRole = clubAdminRoles.find((r) => r.key === where.key);
      return Promise.resolve(caRole ? { id: `role-${where.key}` } : null);
    },
  );

  const roleFindMany = vi.fn().mockResolvedValue(clubAdminRoles);

  const rolePermissionFindUnique = vi.fn().mockResolvedValue(
    roleGrantExists ? { roleId: "role-sa" } : null,
  );
  const rolePermissionUpsert = vi.fn().mockResolvedValue({});

  return {
    prisma: {
      permission: { findUnique: permissionFindUnique, upsert: permissionUpsert },
      role: { findUnique: roleFindUnique, findMany: roleFindMany },
      rolePermission: { findUnique: rolePermissionFindUnique, upsert: rolePermissionUpsert },
    } as never,
    permissionFindUnique,
    permissionUpsert,
    rolePermissionUpsert,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PERMISSIONS constant — ADMIN-DELETE-03A", () => {
  it("1 — PERMISSIONS.WORKSPACE_DELETE is 'workspace.delete'", () => {
    expect(PERMISSIONS.WORKSPACE_DELETE).toBe("workspace.delete");
  });
});

describe("WORKSPACE_DELETE_PERMISSION_DEF", () => {
  it("2 — exports the canonical permission definition", () => {
    expect(WORKSPACE_DELETE_PERMISSION_DEF.key).toBe("workspace.delete");
    expect(WORKSPACE_DELETE_PERMISSION_DEF.name).toBe("Permanently delete documents");
    expect(WORKSPACE_DELETE_PERMISSION_DEF.module).toBe("WORKSPACE");
    expect(WORKSPACE_DELETE_PERMISSION_DEF.scope).toBe("TENANT");
    expect(WORKSPACE_DELETE_PERMISSION_DEF.grantableByAdmin).toBe(true);
  });
});

describe("reconcileWorkspaceDeletePermission", () => {
  it("3 — apply mode: creates Permission row and assigns to super_admin when neither exists", async () => {
    const { prisma, permissionFindUnique, permissionUpsert, rolePermissionUpsert } =
      buildMockPrisma({ permissionExists: false, roleGrantExists: false });

    // After upsert, subsequent permission lookups (inside assignPermissionToRole)
    // must find the permission — override to return PERM_OBJ after the first null.
    let permCallCount = 0;
    permissionFindUnique.mockImplementation(() => {
      permCallCount++;
      return Promise.resolve(permCallCount === 1 ? null : PERM_OBJ);
    });

    const result = await reconcileWorkspaceDeletePermission(prisma, false);

    expect(permissionUpsert).toHaveBeenCalledOnce();
    expect(permissionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "workspace.delete" } }),
    );
    expect(result.permission.action).toBe("created");
    expect(result.superAdmin.action).toBe("assigned");
    expect(rolePermissionUpsert).toHaveBeenCalled();
  });

  it("4 — already_exists / already_assigned: idempotent when permission and role grant both exist", async () => {
    const { prisma, permissionUpsert, rolePermissionUpsert } = buildMockPrisma({
      permissionExists: true,
      roleGrantExists: true,
    });

    const result = await reconcileWorkspaceDeletePermission(prisma, false);

    // Permission row already matches — upsert still called (upsert is always
    // called in apply mode regardless of outcome classification).
    expect(result.permission.action).toBe("already_exists");
    expect(result.superAdmin.action).toBe("already_assigned");
    // Upsert is still called — it is intentionally idempotent (update: {}).
    expect(rolePermissionUpsert).toHaveBeenCalled();
    void permissionUpsert; // accessed but action check is sufficient
  });

  it("5 — dryRun=true: no DB writes (no upsert calls)", async () => {
    const { prisma, permissionUpsert, rolePermissionUpsert } = buildMockPrisma({
      permissionExists: false,
      roleGrantExists: false,
    });

    await reconcileWorkspaceDeletePermission(prisma, true);

    expect(permissionUpsert).not.toHaveBeenCalled();
    expect(rolePermissionUpsert).not.toHaveBeenCalled();
  });

  it("6 — grants workspace.delete to every tenant Club Admin role found", async () => {
    const clubAdminRoles = [
      { key: "club_admin__fc-allschwil" },
      { key: "club_admin__sc-binningen" },
    ];
    const { prisma, permissionFindUnique } = buildMockPrisma({
      permissionExists: false,
      clubAdminRoles,
    });

    let permCallCount = 0;
    permissionFindUnique.mockImplementation(() => {
      permCallCount++;
      return Promise.resolve(permCallCount === 1 ? null : PERM_OBJ);
    });

    const result = await reconcileWorkspaceDeletePermission(prisma, false);

    expect(result.tenantClubAdminRoles).toHaveLength(2);
    expect(result.tenantClubAdminRoles[0].action).toBe("assigned");
    expect(result.tenantClubAdminRoles[1].action).toBe("assigned");
  });
});
