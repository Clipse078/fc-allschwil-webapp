import { describe, expect, it } from "vitest";

import {
  resolveLogoContrastMode,
  shouldInvertLogoOnDarkSurface,
} from "../logo-contrast";

describe("resolveLogoContrastMode", () => {
  it("defaults to normal when unset", () => {
    expect(resolveLogoContrastMode(null)).toBe("normal");
    expect(resolveLogoContrastMode({})).toBe("normal");
    expect(resolveLogoContrastMode({ logoContrastMode: null })).toBe("normal");
  });

  it("accepts canonical INVERT_ON_DARK enum values", () => {
    expect(resolveLogoContrastMode({ logoContrastMode: "INVERT_ON_DARK" })).toBe(
      "invert-on-dark",
    );
    expect(resolveLogoContrastMode({ logoContrastMode: "invert-on-dark" })).toBe(
      "invert-on-dark",
    );
  });

  it("treats unknown values as normal", () => {
    expect(resolveLogoContrastMode({ logoContrastMode: "AUTO" })).toBe("normal");
  });
});

describe("shouldInvertLogoOnDarkSurface", () => {
  it("inverts only on dark surfaces with invert-on-dark and a crest URL", () => {
    expect(shouldInvertLogoOnDarkSurface("invert-on-dark", true, true)).toBe(true);
    expect(shouldInvertLogoOnDarkSurface("invert-on-dark", false, true)).toBe(false);
    expect(shouldInvertLogoOnDarkSurface("normal", true, true)).toBe(false);
    expect(shouldInvertLogoOnDarkSurface("invert-on-dark", true, false)).toBe(false);
  });
});
