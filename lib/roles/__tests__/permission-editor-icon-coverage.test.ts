/**
 * ACCESS-ONBOARDING-03K1 — Permission editor iconLabel registry coverage.
 *
 * Every iconLabel produced by the nav-aligned permission presentation must
 * resolve via the strict nav icon registry without weakening unknown-label checks.
 */

import { describe, it, expect } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getNavIconKey } from "@/lib/motion/nav-icon-registry";
import {
  buildNavPermissionPresentation,
  type NavPermissionPresentation,
  type PermissionCatalogRow,
} from "@/lib/roles/nav-permission-presentation";

function buildFullTenantCatalog(): PermissionCatalogRow[] {
  return Object.values(PERMISSIONS).map((key, index) => ({
    id: String(index + 1),
    key,
    name: key,
    module: "TEST",
  }));
}

export function collectPermissionEditorIconLabels(
  presentation: NavPermissionPresentation,
): string[] {
  const labels = new Set<string>();

  for (const section of presentation.sections) {
    for (const unit of section.units) {
      labels.add(unit.iconLabel);
    }
  }

  if (presentation.supplementalUnit) {
    labels.add(presentation.supplementalUnit.iconLabel);
  }

  return Array.from(labels).sort((a, b) => a.localeCompare(b, "de"));
}

describe("permission-editor icon registry coverage (ACCESS-ONBOARDING-03K1)", () => {
  const presentation = buildNavPermissionPresentation(buildFullTenantCatalog());
  const iconLabels = collectPermissionEditorIconLabels(presentation);

  it("derives at least one permission-editor icon label from the full catalog", () => {
    expect(iconLabels.length).toBeGreaterThan(0);
  });

  it("resolves every permission-editor iconLabel via getNavIconKey", () => {
    for (const label of iconLabels) {
      expect(() => getNavIconKey(label)).not.toThrow();
    }
  });

  it("maps Funktionen to the established rollen animated icon", () => {
    expect(iconLabels).toContain("Funktionen");
    expect(getNavIconKey("Funktionen")).toBe("rollen");
  });

  it("still throws for genuinely unknown labels", () => {
    expect(() => getNavIconKey("Not A Real Nav Item")).toThrow(
      '[nav-icon-registry] Missing animated icon for sidebar label: "Not A Real Nav Item"',
    );
  });
});
