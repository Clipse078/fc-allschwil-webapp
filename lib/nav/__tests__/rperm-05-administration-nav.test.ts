/**
 * RPERM-05 — Administration navigation visibility
 *
 * Pure unit tests against lib/nav/nav-config.ts (no database). Covers:
 *   N-01  Documents ("Dokumente") nav item hidden without workspace.view/manage
 *   N-02  Documents nav item visible once workspace.manage is granted
 *   N-03  Tenant "Rollen & Berechtigungen" entry hidden for a platform-only session
 *   N-04  Tenant "Rollen & Berechtigungen" entry visible with roles.view/roles.manage
 *   N-05  The platform-only "Rollen" entry and the tenant entry are independent
 */

import { describe, expect, it } from "vitest";
import { getVisibleNavSections, flattenNavSections } from "@/lib/nav/nav-config";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";

function visibleLabels(permissionKeys: PermissionKey[]): string[] {
  return flattenNavSections(getVisibleNavSections(permissionKeys)).map((i) => i.label);
}

describe("RPERM-05 — Documents module navigation", () => {
  it("N-01: hidden without workspace.view/workspace.manage", () => {
    expect(visibleLabels([PERMISSIONS.TEAMS_VIEW])).not.toContain("Dokumente");
  });

  it("N-02: visible once workspace.manage is granted", () => {
    expect(visibleLabels([PERMISSIONS.WORKSPACE_MANAGE])).toContain("Dokumente");
  });

  it("visible with workspace.view alone too", () => {
    expect(visibleLabels([PERMISSIONS.WORKSPACE_VIEW])).toContain("Dokumente");
  });
});

describe("RPERM-05 — tenant Roles & Permissions navigation", () => {
  it("N-03: hidden for a platform-only session (USERS_MANAGE only)", () => {
    expect(visibleLabels([PERMISSIONS.USERS_MANAGE])).not.toContain("Rollen & Berechtigungen");
  });

  it("N-04: visible with roles.view", () => {
    expect(visibleLabels([PERMISSIONS.ROLES_VIEW])).toContain("Rollen & Berechtigungen");
  });

  it("N-04b: visible with roles.manage", () => {
    expect(visibleLabels([PERMISSIONS.ROLES_MANAGE])).toContain("Rollen & Berechtigungen");
  });

  it("N-05: the platform-only 'Rollen' entry requires USERS_MANAGE independently of tenant roles.*", () => {
    const tenantOnly = visibleLabels([PERMISSIONS.ROLES_VIEW]);
    expect(tenantOnly).toContain("Rollen & Berechtigungen");
    expect(tenantOnly).not.toContain("Rollen");

    const platformOnly = visibleLabels([PERMISSIONS.USERS_MANAGE]);
    expect(platformOnly).toContain("Rollen");
    expect(platformOnly).not.toContain("Rollen & Berechtigungen");
  });
});
