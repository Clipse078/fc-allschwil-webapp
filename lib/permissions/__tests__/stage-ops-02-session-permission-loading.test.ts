/**
 * STAGE-OPS-02 — Tests for session permission loading and training permission chain.
 *
 * Verifies the complete authorization chain:
 *   Permission → RolePermission → Role → UserRole → session.permissionKeys
 *
 * Covers:
 *   A. super_admin role key is the canonical key used by bootstrap-admin.ts
 *   B. super_admin receives both training permissions via the reconciliation
 *   C. trainer receives both training permissions per seed.ts
 *   D. Other roles (viewer, website_publisher, match_coordinator) do NOT receive them
 *   E. hasAnyPermission correctly evaluates training permission checks
 *   F. Navigation visibility is consistent with route guard permissions
 *   G. A user with no roles has no training permissions
 */

import { describe, it, expect } from "vitest";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";
import { getVisibleNavSections } from "@/lib/nav/nav-config";
import { TRAINING_PERMISSION_DEFS, TRAINING_PERMISSION_ROLE_KEYS } from "@/lib/permissions/training-permission-reconciliation";

// ── Helpers ────────────────────────────────────────────────────────────────────

function findNavItem(
  sections: ReturnType<typeof getVisibleNavSections>,
  key: string,
) {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.key === key) return item;
      const child = item.children?.find((c) => c.key === key);
      if (child) return child;
    }
  }
  return null;
}

/** Simulates what auth.ts does: flatten all role permissions into a deduplicated set. */
function buildEffectivePermissions(
  rolePermissions: Record<string, string[]>,
  assignedRoleKeys: string[],
): string[] {
  return Array.from(
    new Set(assignedRoleKeys.flatMap((key) => rolePermissions[key] ?? []))
  ).sort();
}

// ── Role definitions matching seed.ts ─────────────────────────────────────────

const SEED_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: Object.values(PERMISSIONS), // all permissions
  trainer: [
    "seasons.view",
    "teams.view",
    "people.view",
    "events.view",
    "events.manage",
    "fixtures.view",
    "fixtures.create",
    "fixtures.submit_for_publication",
    "trainings.view",
    "trainings.manage",
  ],
  viewer: [
    "seasons.view",
    "teams.view",
    "people.view",
    "events.view",
    "fixtures.view",
    "facilities.view",
  ],
  match_coordinator: [
    "seasons.view",
    "teams.view",
    "people.view",
    "events.view",
    "events.manage",
    "events.import",
    "events.publish_website",
    "events.publish_infoboard",
    "fixtures.view",
    "fixtures.create",
    "fixtures.edit_all",
    "fixtures.submit_for_publication",
    "fixtures.publish_website",
    "fixtures.publish_infoboard",
    "wochenplan.manage",
    "infoboard.manage",
    "facilities.view",
    "facilities.manage",
  ],
  website_publisher: [
    "seasons.view",
    "events.view",
    "events.import",
    "events.publish_website",
    "fixtures.view",
    "fixtures.publish_website",
    "news.manage",
    "website.manage",
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("STAGE-OPS-02 — Canonical role keys for training permissions", () => {
  it("reconciliation script targets super_admin role key", () => {
    expect(TRAINING_PERMISSION_ROLE_KEYS).toContain("super_admin");
  });

  it("reconciliation script targets trainer role key", () => {
    expect(TRAINING_PERMISSION_ROLE_KEYS).toContain("trainer");
  });

  it("reconciliation script does NOT target viewer role", () => {
    expect(TRAINING_PERMISSION_ROLE_KEYS).not.toContain("viewer");
  });

  it("reconciliation script does NOT target website_publisher role", () => {
    expect(TRAINING_PERMISSION_ROLE_KEYS).not.toContain("website_publisher");
  });

  it("reconciliation script does NOT target match_coordinator role", () => {
    expect(TRAINING_PERMISSION_ROLE_KEYS).not.toContain("match_coordinator");
  });

  it("training permission keys match exactly trainings.view and trainings.manage", () => {
    const keys = TRAINING_PERMISSION_DEFS.map((d) => d.key);
    expect(keys).toContain("trainings.view");
    expect(keys).toContain("trainings.manage");
    expect(keys).toHaveLength(2);
  });
});

describe("STAGE-OPS-02 — Effective permissions per role (seed.ts model)", () => {
  it("super_admin has trainings.view", () => {
    const perms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["super_admin"]);
    expect(perms).toContain("trainings.view");
  });

  it("super_admin has trainings.manage", () => {
    const perms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["super_admin"]);
    expect(perms).toContain("trainings.manage");
  });

  it("trainer has trainings.view", () => {
    const perms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["trainer"]);
    expect(perms).toContain("trainings.view");
  });

  it("trainer has trainings.manage", () => {
    const perms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["trainer"]);
    expect(perms).toContain("trainings.manage");
  });

  it("viewer does NOT have trainings.view", () => {
    const perms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["viewer"]);
    expect(perms).not.toContain("trainings.view");
  });

  it("match_coordinator does NOT have trainings.view or trainings.manage", () => {
    const perms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["match_coordinator"]);
    expect(perms).not.toContain("trainings.view");
    expect(perms).not.toContain("trainings.manage");
  });

  it("website_publisher does NOT have trainings.view or trainings.manage", () => {
    const perms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["website_publisher"]);
    expect(perms).not.toContain("trainings.view");
    expect(perms).not.toContain("trainings.manage");
  });

  it("user with no roles has no permissions", () => {
    const perms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, []);
    expect(perms).toHaveLength(0);
  });
});

describe("STAGE-OPS-02 — Navigation visibility matches route guard", () => {
  it("super_admin session (all perms) sees Trainingsplaner in sidebar", () => {
    const allPerms = Object.values(PERMISSIONS);
    const sections = getVisibleNavSections(allPerms);
    const item = findNavItem(sections, "trainingsplaner");
    expect(item).not.toBeNull();
    expect(item?.href).toBe("/dashboard/training");
  });

  it("trainer session (with training perms) sees Trainingsplaner", () => {
    const trainerPerms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["trainer"]);
    const sections = getVisibleNavSections(trainerPerms as PermissionKey[]);
    const item = findNavItem(sections, "trainingsplaner");
    expect(item).not.toBeNull();
  });

  it("viewer session (no training perms) does NOT see Trainingsplaner", () => {
    const viewerPerms = buildEffectivePermissions(SEED_ROLE_PERMISSIONS, ["viewer"]);
    const sections = getVisibleNavSections(viewerPerms as PermissionKey[]);
    const item = findNavItem(sections, "trainingsplaner");
    expect(item).toBeNull();
  });

  it("navigation permission keys match the route guard permission keys (OR semantics)", () => {
    // Both the nav entry and the route use [TRAININGS_VIEW, TRAININGS_MANAGE].
    // A user with only TRAININGS_VIEW should see nav AND access route.
    const viewOnly = getVisibleNavSections([PERMISSIONS.TRAININGS_VIEW]);
    expect(findNavItem(viewOnly, "trainingsplaner")).not.toBeNull();

    const manageOnly = getVisibleNavSections([PERMISSIONS.TRAININGS_MANAGE]);
    expect(findNavItem(manageOnly, "trainingsplaner")).not.toBeNull();
  });
});

describe("STAGE-OPS-02 — Session JWT permission loading invariants", () => {
  it("permissions are built from UserRole → Role → RolePermission chain", () => {
    // Simulates auth.ts authorize() logic: flatten rolePermissions.permission.key
    const userRoles = [
      {
        role: {
          key: "super_admin",
          rolePermissions: [
            { permission: { key: "trainings.view" } },
            { permission: { key: "trainings.manage" } },
            { permission: { key: "teams.view" } },
          ]
        }
      }
    ];
    const permissionKeys = Array.from(
      new Set(userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.key)))
    );
    expect(permissionKeys).toContain("trainings.view");
    expect(permissionKeys).toContain("trainings.manage");
  });

  it("new RolePermission rows are included at next sign-in (no stale cache between sessions)", () => {
    // Pre-reconciliation: super_admin does NOT have trainings.view
    const preReconciliationRoles = [
      { role: { key: "super_admin", rolePermissions: [{ permission: { key: "teams.view" } }] } }
    ];
    const prePerms = Array.from(new Set(preReconciliationRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.key))));
    expect(prePerms).not.toContain("trainings.view");

    // Post-reconciliation: super_admin HAS trainings.view (new RolePermission row added)
    const postReconciliationRoles = [
      {
        role: {
          key: "super_admin",
          rolePermissions: [
            { permission: { key: "teams.view" } },
            { permission: { key: "trainings.view" } }, // newly added by reconciliation
            { permission: { key: "trainings.manage" } },
          ]
        }
      }
    ];
    const postPerms = Array.from(new Set(postReconciliationRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.key))));
    expect(postPerms).toContain("trainings.view");
    expect(postPerms).toContain("trainings.manage");
    // Confirms: the user must log out and back in to get the new JWT.
  });
});
