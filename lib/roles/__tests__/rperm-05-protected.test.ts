/**
 * RPERM-05 — Protected-role rules (lib/roles/protected.ts)
 *
 * Pure unit tests, no database. Covers the narrow protection model:
 *   P-01  isProtectedRole reflects Role.isSystem exactly
 *   P-02  Essential permissions cannot be removed from an isSystem role
 *   P-03  Non-essential permissions remain freely removable from an isSystem role
 *   P-04  Non-system roles have no locked permissions at all
 *   P-05  lockedPermissionKeysForRole only reports keys the role actually holds
 */

import { describe, it, expect } from "vitest";
import {
  ESSENTIAL_SYSTEM_ROLE_PERMISSIONS,
  findLockedPermissionRemovals,
  isProtectedRole,
  lockedPermissionKeysForRole,
} from "@/lib/roles/protected";

describe("RPERM-05 — isProtectedRole", () => {
  it("P-01: true only when isSystem is true", () => {
    expect(isProtectedRole({ isSystem: true })).toBe(true);
    expect(isProtectedRole({ isSystem: false })).toBe(false);
  });
});

describe("RPERM-05 — findLockedPermissionRemovals", () => {
  it("P-02: rejects removing an essential permission from a system role that currently holds it", () => {
    const locked = findLockedPermissionRemovals({
      isSystem: true,
      currentKeys: ["roles.manage", "teams.view"],
      requestedKeys: ["teams.view"],
    });
    expect(locked).toContain("roles.manage");
  });

  it("P-03: allows removing a non-essential permission from a system role", () => {
    const locked = findLockedPermissionRemovals({
      isSystem: true,
      currentKeys: ["roles.manage", "teams.view"],
      requestedKeys: ["roles.manage"],
    });
    expect(locked).toEqual([]);
  });

  it("P-04: non-system roles have no locked removals regardless of requested keys", () => {
    const locked = findLockedPermissionRemovals({
      isSystem: false,
      currentKeys: ["roles.manage", "roles.assign", "users.manage_memberships"],
      requestedKeys: [],
    });
    expect(locked).toEqual([]);
  });

  it("allows an empty removal set when the role never held any essential permission", () => {
    const locked = findLockedPermissionRemovals({
      isSystem: true,
      currentKeys: ["teams.view"],
      requestedKeys: [],
    });
    expect(locked).toEqual([]);
  });
});

describe("RPERM-05 — lockedPermissionKeysForRole", () => {
  it("P-05: only reports essential keys the role currently holds", () => {
    const locked = lockedPermissionKeysForRole({
      isSystem: true,
      currentKeys: ["roles.manage", "teams.view"],
    });
    expect(locked).toEqual(["roles.manage"]);
  });

  it("returns an empty array for non-system roles", () => {
    const locked = lockedPermissionKeysForRole({
      isSystem: false,
      currentKeys: [...ESSENTIAL_SYSTEM_ROLE_PERMISSIONS],
    });
    expect(locked).toEqual([]);
  });

  it("returns all three essential keys when a system role holds all of them", () => {
    const locked = lockedPermissionKeysForRole({
      isSystem: true,
      currentKeys: [...ESSENTIAL_SYSTEM_ROLE_PERMISSIONS, "teams.view"],
    });
    expect(locked.sort()).toEqual([...ESSENTIAL_SYSTEM_ROLE_PERMISSIONS].sort());
  });
});
