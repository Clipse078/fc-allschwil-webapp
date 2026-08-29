import { describe, expect, it } from "vitest";

import {
  ALL_LOGO_CONTRAST_MODES,
  DEFAULT_LOGO_CONTRAST_MODE,
  LOGO_CONTRAST_MODES,
  isValidLogoContrastMode,
  normalizeLogoContrastMode,
} from "../logo-contrast-mode";

describe("logo-contrast-mode", () => {
  it("accepts only NORMAL and INVERT_ON_DARK", () => {
    expect(ALL_LOGO_CONTRAST_MODES).toEqual(["NORMAL", "INVERT_ON_DARK"]);
    expect(isValidLogoContrastMode(LOGO_CONTRAST_MODES.NORMAL)).toBe(true);
    expect(isValidLogoContrastMode(LOGO_CONTRAST_MODES.INVERT_ON_DARK)).toBe(true);
    expect(isValidLogoContrastMode("invert")).toBe(false);
    expect(isValidLogoContrastMode(null)).toBe(false);
    expect(isValidLogoContrastMode(undefined)).toBe(false);
  });

  it("normalizes unknown or missing values to NORMAL", () => {
    expect(normalizeLogoContrastMode(undefined)).toBe(DEFAULT_LOGO_CONTRAST_MODE);
    expect(normalizeLogoContrastMode(null)).toBe(DEFAULT_LOGO_CONTRAST_MODE);
    expect(normalizeLogoContrastMode("bogus")).toBe(DEFAULT_LOGO_CONTRAST_MODE);
    expect(normalizeLogoContrastMode(LOGO_CONTRAST_MODES.INVERT_ON_DARK)).toBe(
      LOGO_CONTRAST_MODES.INVERT_ON_DARK,
    );
  });
});
