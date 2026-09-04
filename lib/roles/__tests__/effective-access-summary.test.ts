import { describe, it, expect } from "vitest";
import { groupPermissionsByModule } from "@/lib/roles/effective-access-summary";

describe("effective-access-summary grouping", () => {
  it("groups permission names by module label without raw keys", () => {
    const groups = groupPermissionsByModule([
      { name: "Wochenplanung bearbeiten", module: "WOCHENPLAN" },
      { name: "Teams verwalten", module: "TEAMS" },
      { name: "News bearbeiten", module: "NEWS" },
    ]);

    expect(groups.map((g) => g.moduleLabel)).toEqual(["Wochenplan", "News", "Teams"]);
    expect(groups.find((g) => g.module === "WOCHENPLAN")?.items).toContain("Wochenplanung bearbeiten");
    expect(groups.every((g) => g.hasAccess)).toBe(true);
  });

  it("marks modules without permissions as Kein Zugriff when hasAccess is false", () => {
    const groups = groupPermissionsByModule([]);
    expect(groups).toEqual([]);
  });
});
