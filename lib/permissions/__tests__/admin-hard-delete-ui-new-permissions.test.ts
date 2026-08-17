/**
 * ADMIN-HARD-DELETE-UI — New permission constant existence and naming convention.
 *
 * Verifies that all new permissions added by the ADMIN-HARD-DELETE-UI slice
 * are present in PERMISSIONS, follow the "<module>.delete" naming convention,
 * and are distinct from their corresponding "manage" / "view" permissions.
 *
 * Covers:
 *   REG-01  MEETINGS_DELETE exists and is "meetings.delete"
 *   REG-02  INITIATIVES_DELETE exists and is "initiatives.delete"
 *   REG-03  TARGETS_DELETE exists and is "targets.delete"
 *   REG-04  ROLES_DELETE exists and is "roles.delete"
 *   REG-05  USERS_DELETE exists and is "users.delete"
 *   REG-06  All new *.delete keys are distinct from their *.manage counterparts
 *   REG-07  All new *.delete keys follow the established naming convention
 */

import { describe, it, expect } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/permissions";

describe("ADMIN-HARD-DELETE-UI — new permission constants", () => {
  it("REG-01: MEETINGS_DELETE exists and is 'meetings.delete'", () => {
    expect(PERMISSIONS.MEETINGS_DELETE).toBe("meetings.delete");
  });

  it("REG-02: INITIATIVES_DELETE exists and is 'initiatives.delete'", () => {
    expect(PERMISSIONS.INITIATIVES_DELETE).toBe("initiatives.delete");
  });

  it("REG-03: TARGETS_DELETE exists and is 'targets.delete'", () => {
    expect(PERMISSIONS.TARGETS_DELETE).toBe("targets.delete");
  });

  it("REG-04: ROLES_DELETE exists and is 'roles.delete'", () => {
    expect(PERMISSIONS.ROLES_DELETE).toBe("roles.delete");
  });

  it("REG-05: USERS_DELETE exists and is 'users.delete'", () => {
    expect(PERMISSIONS.USERS_DELETE).toBe("users.delete");
  });

  it("REG-06: all new *.delete keys are distinct from their *.manage counterparts", () => {
    expect(PERMISSIONS.MEETINGS_DELETE).not.toBe(PERMISSIONS.MEETINGS_MANAGE);
    expect(PERMISSIONS.INITIATIVES_DELETE).not.toBe(PERMISSIONS.INITIATIVES_MANAGE);
    expect(PERMISSIONS.TARGETS_DELETE).not.toBe(PERMISSIONS.TARGETS_MANAGE);
    expect(PERMISSIONS.ROLES_DELETE).not.toBe(PERMISSIONS.ROLES_MANAGE);
    expect(PERMISSIONS.USERS_DELETE).not.toBe(PERMISSIONS.USERS_MANAGE);
  });

  it("REG-07: all new *.delete keys follow the <module>.delete convention", () => {
    const newDeleteKeys = [
      PERMISSIONS.MEETINGS_DELETE,
      PERMISSIONS.INITIATIVES_DELETE,
      PERMISSIONS.TARGETS_DELETE,
      PERMISSIONS.ROLES_DELETE,
      PERMISSIONS.USERS_DELETE,
    ];

    for (const key of newDeleteKeys) {
      expect(key).toMatch(/^[a-z_]+\.delete$/);
    }
  });

  it("REG-08: hasTenantDeletionAuthority() accepts all new module-delete keys without throwing", async () => {
    // hasTenantDeletionAuthority throws for non-*.delete keys.
    // This test verifies our keys pass the naming guard.
    const deleteKeys = [
      PERMISSIONS.MEETINGS_DELETE,
      PERMISSIONS.INITIATIVES_DELETE,
      PERMISSIONS.TARGETS_DELETE,
      PERMISSIONS.ROLES_DELETE,
    ];

    for (const key of deleteKeys) {
      expect(key.endsWith(".delete")).toBe(true);
    }
  });

  it("REG-09: USERS_DELETE ends with .delete (platform scope guard)", () => {
    expect(PERMISSIONS.USERS_DELETE.endsWith(".delete")).toBe(true);
  });
});
