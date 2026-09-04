import { describe, it, expect } from "vitest";
import {
  buildSelectedPermissionSummary,
  getPermissionDisplayMeta,
  isDangerousPermission,
  permissionDisplayLabel,
  permissionDisplayDescription,
  moduleDisplayDescription,
} from "@/lib/roles/permission-metadata";

describe("permission-metadata", () => {
  it("returns German labels for canonical org permissions", () => {
    expect(permissionDisplayLabel("org.manage", "Manage organisations", "ORG")).toBe(
      "Organisation verwalten",
    );
    expect(permissionDisplayLabel("org.view", "View organisations", "ORG")).toBe(
      "Organisation ansehen",
    );
    expect(permissionDisplayLabel("org.delete", "Permanently delete organisations", "ORG")).toBe(
      "Organisation dauerhaft löschen",
    );
  });

  it("returns German descriptions for canonical permissions", () => {
    const desc = permissionDisplayDescription(
      "org.manage",
      "Organisation verwalten",
    );
    expect(desc).toContain("Vereinsdaten");
  });

  it("marks delete permissions as dangerous", () => {
    expect(isDangerousPermission("org.delete")).toBe(true);
    expect(isDangerousPermission("org.manage")).toBe(false);
  });

  it("derives labels for unknown keys from module and action", () => {
    expect(
      permissionDisplayLabel("custom.thing.view", "View custom thing", "TEAMS"),
    ).toBe("Teams ansehen");
  });

  it("provides module descriptions in German", () => {
    expect(moduleDisplayDescription("ORG")).toContain("Vereinsorganisation");
  });

  it("builds grouped summary from selected keys", () => {
    const groups = buildSelectedPermissionSummary(
      [
        {
          module: "ORG",
          permissions: [
            { key: "org.view", name: "View organisations", module: "ORG" },
            { key: "org.manage", name: "Manage organisations", module: "ORG" },
          ],
        },
        {
          module: "TEAMS",
          permissions: [
            { key: "teams.view", name: "View teams", module: "TEAMS" },
          ],
        },
      ],
      new Set(["org.view", "teams.view"]),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.moduleLabel).toBe("Organisation");
    expect(groups[0]?.items.map((i) => i.label)).toContain("Organisation ansehen");
    expect(groups[1]?.moduleLabel).toBe("Teams");
  });

  it("includes dangerous flag in display meta", () => {
    const meta = getPermissionDisplayMeta(
      "website.delete",
      "Permanently delete website content",
      "WEBSITE",
    );
    expect(meta.dangerous).toBe(true);
    expect(meta.label).toBe("Website dauerhaft löschen");
  });
});
