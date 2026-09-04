import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  buildNavPermissionPresentation,
  type PermissionCatalogRow,
} from "@/lib/roles/nav-permission-presentation";
import {
  PERMISSION_SECTION_ACCENTS,
  countSectionActiveModules,
  countSectionModules,
  getPermissionSectionAccent,
  getPermissionSectionStatus,
  getPermissionSectionStatusLabel,
} from "@/lib/roles/permission-section-presentation";

function catalogRow(key: string): PermissionCatalogRow {
  return { id: key, key, name: key, module: "TEST" };
}

const TENANT_CATALOG_KEYS = [
  PERMISSIONS.ORG_VIEW,
  PERMISSIONS.ORG_MANAGE,
  PERMISSIONS.TEAMS_VIEW,
  PERMISSIONS.TEAMS_MANAGE,
  PERMISSIONS.PEOPLE_VIEW,
  PERMISSIONS.PEOPLE_MANAGE,
  PERMISSIONS.NEWS_MANAGE,
  PERMISSIONS.WEBSITE_MANAGE,
  PERMISSIONS.TRAININGS_VIEW,
  PERMISSIONS.TRAININGS_MANAGE,
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_MANAGE,
];

describe("permission-section-presentation", () => {
  it("defines restrained accent metadata for all primary sections", () => {
    expect(Object.keys(PERMISSION_SECTION_ACCENTS)).toEqual(
      expect.arrayContaining(["Organisation", "Website", "Betrieb", "Führung", "System"]),
    );

    for (const accent of Object.values(PERMISSION_SECTION_ACCENTS)) {
      expect(accent.accent).toMatch(/^rgb\(/);
      expect(accent.accentSurface).toContain("color-mix");
      expect(accent.description.length).toBeGreaterThan(0);
    }
  });

  it("calculates inactive, partial, and active section states from selections", () => {
    const presentation = buildNavPermissionPresentation(
      TENANT_CATALOG_KEYS.map(catalogRow),
    );
    const organisation = presentation.sections.find((section) => section.label === "Organisation");
    expect(organisation).toBeTruthy();

    expect(getPermissionSectionStatus(organisation!, new Set())).toBe("inactive");
    expect(getPermissionSectionStatusLabel("inactive")).toBe("Nicht aktiv");

    const partial = new Set([PERMISSIONS.TEAMS_VIEW]);
    expect(getPermissionSectionStatus(organisation!, partial)).toBe("partial");
    expect(getPermissionSectionStatusLabel("partial")).toBe("Teilweise aktiv");

    const allOrgKeys = organisation!.units.flatMap((unit) =>
      unit.standardControls.flatMap((control) => control.permissionKeys),
    );
    expect(getPermissionSectionStatus(organisation!, new Set(allOrgKeys))).toBe("active");
    expect(getPermissionSectionStatusLabel("active")).toBe("Aktiv");
  });

  it("counts active modules per section for preview summaries", () => {
    const presentation = buildNavPermissionPresentation(
      TENANT_CATALOG_KEYS.map(catalogRow),
    );
    const betrieb = presentation.sections.find((section) => section.label === "Betrieb");
    expect(betrieb).toBeTruthy();
    expect(countSectionModules(betrieb!)).toBeGreaterThan(0);

    const selected = new Set([PERMISSIONS.TRAININGS_VIEW]);
    expect(countSectionActiveModules(betrieb!, selected)).toBeGreaterThanOrEqual(1);
    expect(getPermissionSectionAccent("Betrieb").label).toBe("Betrieb");
  });
});
