/**
 * INFOBOARD-KIOSK-VIEWPORT-01B — presentation-aware pagination capacity.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCREEN1_PRESENTATION,
  resolvePresentationCapacityScale,
  resolveScreen1PageDemandMax,
  SCREEN1_PAGE_DEMAND_MAX,
} from "@/lib/infoboard/screen1-logo-settings";

describe("resolveScreen1PageDemandMax", () => {
  it("returns the default ceiling for baseline presentation", () => {
    expect(resolveScreen1PageDemandMax(DEFAULT_SCREEN1_PRESENTATION)).toBe(
      SCREEN1_PAGE_DEMAND_MAX,
    );
  });

  it("reduces page capacity when fonts and logos are set to XLARGE", () => {
    const max = resolveScreen1PageDemandMax({
      ...DEFAULT_SCREEN1_PRESENTATION,
      trainingFontSize: "XLARGE",
      matchFontSize: "XLARGE",
      tournamentFontSize: "XLARGE",
      trainingLogoSize: "XLARGE",
      matchLogoSize: "XLARGE",
      tournamentLogoSize: "XLARGE",
    });
    expect(max).toBeLessThan(SCREEN1_PAGE_DEMAND_MAX);
  });

  it("increases page capacity slightly for SMALL presentation", () => {
    const max = resolveScreen1PageDemandMax({
      ...DEFAULT_SCREEN1_PRESENTATION,
      trainingFontSize: "SMALL",
      matchFontSize: "SMALL",
      tournamentFontSize: "SMALL",
      trainingLogoSize: "SMALL",
      matchLogoSize: "SMALL",
      tournamentLogoSize: "SMALL",
    });
    expect(max).toBeGreaterThan(SCREEN1_PAGE_DEMAND_MAX);
  });

  it("ignores logo scale when logos are hidden", () => {
    const hidden = resolvePresentationCapacityScale({
      ...DEFAULT_SCREEN1_PRESENTATION,
      trainingShowLogos: false,
      matchShowLogos: false,
      tournamentShowLogos: false,
      trainingLogoSize: "XLARGE",
      matchLogoSize: "XLARGE",
      tournamentLogoSize: "XLARGE",
    });
    const visible = resolvePresentationCapacityScale({
      ...DEFAULT_SCREEN1_PRESENTATION,
      trainingLogoSize: "XLARGE",
      matchLogoSize: "XLARGE",
      tournamentLogoSize: "XLARGE",
    });
    expect(visible).toBeGreaterThan(hidden);
  });
});
