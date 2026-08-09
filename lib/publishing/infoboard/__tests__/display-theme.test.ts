/**
 * lib/publishing/infoboard/__tests__/display-theme.test.ts
 *
 * INFOBOARD-INTEGRATION-01B — unit tests for the Infoboard display-theme
 * resolver. Pure functions; no DB, no React.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_INFOBOARD_DISPLAY_THEME,
  INFOBOARD_DISPLAY_THEMES,
  isInfoboardDisplayTheme,
  resolveInfoboardDisplayTheme,
} from "../display-theme";

describe("INFOBOARD_DISPLAY_THEMES", () => {
  it("contains exactly DARK and LIGHT", () => {
    expect(INFOBOARD_DISPLAY_THEMES).toEqual(["DARK", "LIGHT"]);
  });
});

describe("DEFAULT_INFOBOARD_DISPLAY_THEME", () => {
  it("is DARK (the existing premium stadium default)", () => {
    expect(DEFAULT_INFOBOARD_DISPLAY_THEME).toBe("DARK");
  });
});

describe("isInfoboardDisplayTheme", () => {
  it("returns true for 'DARK'", () => {
    expect(isInfoboardDisplayTheme("DARK")).toBe(true);
  });

  it("returns true for 'LIGHT'", () => {
    expect(isInfoboardDisplayTheme("LIGHT")).toBe(true);
  });

  it("returns false for lowercase 'dark' (case-sensitive narrowing)", () => {
    expect(isInfoboardDisplayTheme("dark")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isInfoboardDisplayTheme(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isInfoboardDisplayTheme(undefined)).toBe(false);
  });

  it("returns false for an unrelated string", () => {
    expect(isInfoboardDisplayTheme("BLUE")).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isInfoboardDisplayTheme(42)).toBe(false);
  });
});

describe("resolveInfoboardDisplayTheme", () => {
  it("resolves 'DARK' to 'DARK'", () => {
    expect(resolveInfoboardDisplayTheme("DARK")).toBe("DARK");
  });

  it("resolves 'LIGHT' to 'LIGHT'", () => {
    expect(resolveInfoboardDisplayTheme("LIGHT")).toBe("LIGHT");
  });

  it("is case-insensitive ('light' -> 'LIGHT')", () => {
    expect(resolveInfoboardDisplayTheme("light")).toBe("LIGHT");
  });

  it("trims whitespace", () => {
    expect(resolveInfoboardDisplayTheme("  LIGHT  ")).toBe("LIGHT");
  });

  it("defaults to DARK for null", () => {
    expect(resolveInfoboardDisplayTheme(null)).toBe("DARK");
  });

  it("defaults to DARK for undefined", () => {
    expect(resolveInfoboardDisplayTheme(undefined)).toBe("DARK");
  });

  it("defaults to DARK for an empty string", () => {
    expect(resolveInfoboardDisplayTheme("")).toBe("DARK");
  });

  it("defaults to DARK for an unrecognised value", () => {
    expect(resolveInfoboardDisplayTheme("NEON")).toBe("DARK");
  });

  it("always returns a member of INFOBOARD_DISPLAY_THEMES", () => {
    for (const input of [null, undefined, "", "dark", "LIGHT", "garbage"]) {
      const resolved = resolveInfoboardDisplayTheme(input);
      expect(INFOBOARD_DISPLAY_THEMES).toContain(resolved);
    }
  });
});
