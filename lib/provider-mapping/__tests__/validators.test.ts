/**
 * Tests for lib/provider-mapping/validators.ts
 *
 * Covers:
 *   A. parseConfidenceLevel — valid and invalid values
 *   B. isValidConfidenceLevel — type guard
 */

import { describe, it, expect } from "vitest";
import { parseConfidenceLevel, isValidConfidenceLevel } from "../validators";

describe("A. parseConfidenceLevel", () => {
  it("returns 'HIGH' for 'HIGH'", () => {
    expect(parseConfidenceLevel("HIGH")).toBe("HIGH");
  });

  it("returns 'MEDIUM' for 'MEDIUM'", () => {
    expect(parseConfidenceLevel("MEDIUM")).toBe("MEDIUM");
  });

  it("returns 'LOW' for 'LOW'", () => {
    expect(parseConfidenceLevel("LOW")).toBe("LOW");
  });

  it("returns undefined for unknown string 'SUPERGOOD'", () => {
    expect(parseConfidenceLevel("SUPERGOOD")).toBeUndefined();
  });

  it("returns undefined for lowercase 'high'", () => {
    expect(parseConfidenceLevel("high")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseConfidenceLevel("")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(parseConfidenceLevel(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(parseConfidenceLevel(undefined)).toBeUndefined();
  });

  it("returns undefined for number", () => {
    expect(parseConfidenceLevel(42)).toBeUndefined();
  });

  it("returns undefined for object", () => {
    expect(parseConfidenceLevel({ level: "HIGH" })).toBeUndefined();
  });

  it("prevents SQL/injection strings from being persisted", () => {
    expect(parseConfidenceLevel("'; DROP TABLE users; --")).toBeUndefined();
  });
});

describe("B. isValidConfidenceLevel", () => {
  it("returns true for valid values", () => {
    expect(isValidConfidenceLevel("HIGH")).toBe(true);
    expect(isValidConfidenceLevel("MEDIUM")).toBe(true);
    expect(isValidConfidenceLevel("LOW")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isValidConfidenceLevel("INVALID")).toBe(false);
    expect(isValidConfidenceLevel("high")).toBe(false);
    expect(isValidConfidenceLevel("")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isValidConfidenceLevel(null)).toBe(false);
    expect(isValidConfidenceLevel(undefined)).toBe(false);
    expect(isValidConfidenceLevel(1)).toBe(false);
  });
});
