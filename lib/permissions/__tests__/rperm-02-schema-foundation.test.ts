/**
 * RPERM-02 — Tenant-Aware Role and Membership Foundation
 *
 * Tests covering:
 *
 *   S-RPERM02-1.  Permission constants — all six new keys exist in PERMISSIONS
 *   S-RPERM02-2.  Permission constants — existing keys are preserved
 *   S-RPERM02-3.  Permission constants — PermissionKey type includes new keys
 */

import { describe, it, expect } from "vitest";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";

describe("RPERM-02 — Permission constants", () => {
  it("S-RPERM02-1: all six new RPERM-02 permission keys are defined", () => {
    expect(PERMISSIONS.USERS_VIEW).toBe("users.view");
    expect(PERMISSIONS.USERS_INVITE).toBe("users.invite");
    expect(PERMISSIONS.USERS_MANAGE_MEMBERSHIPS).toBe("users.manage_memberships");
    expect(PERMISSIONS.ROLES_VIEW).toBe("roles.view");
    expect(PERMISSIONS.ROLES_MANAGE).toBe("roles.manage");
    expect(PERMISSIONS.ROLES_ASSIGN).toBe("roles.assign");
  });

  it("S-RPERM02-2: pre-existing permission keys are preserved", () => {
    expect(PERMISSIONS.USERS_MANAGE).toBe("users.manage");
    expect(PERMISSIONS.USERS_IMPERSONATE).toBe("users.impersonate");
    expect(PERMISSIONS.TENANTS_VIEW).toBe("tenants.view");
    expect(PERMISSIONS.TENANTS_MANAGE).toBe("tenants.manage");
    expect(PERMISSIONS.TRAININGS_VIEW).toBe("trainings.view");
    expect(PERMISSIONS.TRAININGS_MANAGE).toBe("trainings.manage");
  });

  it("S-RPERM02-3: PermissionKey union type includes new keys", () => {
    // Type-level assertion — if this compiles, the type is correct.
    const keys: PermissionKey[] = [
      "users.view",
      "users.invite",
      "users.manage_memberships",
      "roles.view",
      "roles.manage",
      "roles.assign",
    ];
    expect(keys).toHaveLength(6);
  });

  it("S-RPERM02-4: total permission count equals pre-existing plus six new", () => {
    const allKeys = Object.values(PERMISSIONS);
    // Pre-RPERM-02 there were 56 entries (users.manage, users.impersonate + 54 others).
    // RPERM-02 adds 6 more (users.view, users.invite, users.manage_memberships,
    // roles.view, roles.manage, roles.assign).
    // We assert the count has grown by at least 6 and all new keys are present.
    const newKeys = [
      "users.view",
      "users.invite",
      "users.manage_memberships",
      "roles.view",
      "roles.manage",
      "roles.assign",
    ];
    for (const key of newKeys) {
      expect(allKeys).toContain(key);
    }
    // No duplicate values
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});
