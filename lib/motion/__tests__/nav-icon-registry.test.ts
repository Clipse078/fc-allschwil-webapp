/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-04C — Nav icon registry coverage tests
 */

import { describe, it, expect } from "vitest";
import { NAV_ICON_KEYS } from "@/lib/motion/nav-icon-keys";
import {
  COPPER_FLOW_ICON_KEYS,
  getAllSidebarNavIconKeys,
  getAllSidebarNavLabels,
  getNavIconKey,
} from "@/lib/motion/nav-icon-registry";
import { NAV_ICON_COMPONENTS } from "@/components/ui/motion/nav-icons";

describe("nav-icon-registry (SCE-DESIGN-04C)", () => {
  it("maps every sidebar nav label to a registered icon key", () => {
    const labels = getAllSidebarNavLabels();
    expect(labels.length).toBeGreaterThan(0);

    for (const label of labels) {
      expect(() => getNavIconKey(label)).not.toThrow();
    }
  });

  it("has a bespoke icon component for every registry key", () => {
    for (const key of NAV_ICON_KEYS) {
      expect(NAV_ICON_COMPONENTS[key]).toBeDefined();
      expect(typeof NAV_ICON_COMPONENTS[key]).toBe("function");
    }
  });

  it("covers all sidebar labels without duplicates missing from NAV_ICON_KEYS usage", () => {
    const iconKeys = new Set(getAllSidebarNavIconKeys());
    expect(iconKeys.size).toBe(getAllSidebarNavLabels().length);

    for (const key of iconKeys) {
      expect(NAV_ICON_KEYS).toContain(key);
    }
  });

  it("defines copper-flow only for semantically appropriate icons", () => {
    expect(COPPER_FLOW_ICON_KEYS.has("website")).toBe(true);
    expect(COPPER_FLOW_ICON_KEYS.has("kommunikation")).toBe(true);
    expect(COPPER_FLOW_ICON_KEYS.has("zielgruppen")).toBe(false);
  });
});
