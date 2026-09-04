import { describe, it, expect } from "vitest";
import { NAV_SECTIONS } from "@/lib/nav/nav-config";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function findSection(label: string) {
  return NAV_SECTIONS.find((s) => s.sectionLabel === label);
}

describe("ACCESS-ONBOARDING-03 — nav config", () => {
  it("exposes Personen & Zugänge under Administration", () => {
    const system = findSection("System");
    const admin = system!.items.find((i) => i.key === "administration");
    const peopleAccess = admin!.children?.find((c) => c.key === "admin-people-access");

    expect(peopleAccess).toEqual(
      expect.objectContaining({
        label: "Personen & Zugänge",
        href: "/dashboard/admin/people-access",
        permissionKeys: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE],
      }),
    );
  });

  it("does not expose legacy Benutzer nav entry", () => {
    const system = findSection("System");
    const admin = system!.items.find((i) => i.key === "administration");
    const legacyUsers = admin!.children?.find((c) => c.key === "admin-users");
    expect(legacyUsers).toBeUndefined();
  });
});
