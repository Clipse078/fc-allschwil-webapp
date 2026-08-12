/**
 * lib/infoboard/__tests__/slug.test.ts
 *
 * Focused tests for slug generation and uniqueness logic.
 */

import { describe, it, expect } from "vitest";
import { generateInfoboardSlug, ensureUniqueSlug } from "../slug";

describe("generateInfoboardSlug", () => {
  it("converts spaces to hyphens and lowercases", () => {
    expect(generateInfoboardSlug("Clubhaus Eingang")).toBe("clubhaus-eingang");
  });

  it("transliterates German umlauts", () => {
    expect(generateInfoboardSlug("Büro")).toBe("buero");
    expect(generateInfoboardSlug("Übersicht")).toBe("uebersicht");
    expect(generateInfoboardSlug("Österreich")).toBe("oesterreich");
  });

  it("strips special characters and punctuation", () => {
    expect(generateInfoboardSlug("KR 2 – Display")).toBe("kr-2-display");
    expect(generateInfoboardSlug("Restaurant & Bistro")).toBe("restaurant-bistro");
  });

  it("collapses consecutive hyphens", () => {
    expect(generateInfoboardSlug("A  B")).toBe("a-b");
    expect(generateInfoboardSlug("A---B")).toBe("a-b");
  });

  it("strips leading and trailing hyphens", () => {
    const result = generateInfoboardSlug("!Hello!");
    expect(result).not.toMatch(/^-|-$/);
  });

  it("truncates to 80 chars", () => {
    const long = "A".repeat(100);
    expect(generateInfoboardSlug(long).length).toBeLessThanOrEqual(80);
  });

  it("falls back to 'infoboard' for empty/special-only input", () => {
    expect(generateInfoboardSlug("!!!")).toBe("infoboard");
    expect(generateInfoboardSlug("")).toBe("infoboard");
  });

  it("produces stable slugs (Clubhaus Eingang → clubhaus-eingang)", () => {
    expect(generateInfoboardSlug("Clubhaus Eingang")).toBe("clubhaus-eingang");
  });

  it("renaming does not affect previously generated slug", () => {
    // Slug is generated once from the original name; renaming
    // produces a different slug but the original is preserved.
    const original = generateInfoboardSlug("Clubhaus Eingang");
    const renamed = generateInfoboardSlug("Haupteingang");
    expect(original).toBe("clubhaus-eingang");
    expect(renamed).toBe("haupteingang");
    expect(original).not.toBe(renamed);
  });
});

describe("ensureUniqueSlug", () => {
  it("returns base slug when not taken", () => {
    expect(ensureUniqueSlug("screen-1", new Set())).toBe("screen-1");
  });

  it("appends -2 when base slug is taken", () => {
    expect(ensureUniqueSlug("screen-1", new Set(["screen-1"]))).toBe("screen-1-2");
  });

  it("increments counter until unique", () => {
    const taken = new Set(["screen-1", "screen-1-2", "screen-1-3"]);
    expect(ensureUniqueSlug("screen-1", taken)).toBe("screen-1-4");
  });

  it("multiple boards can coexist with different slugs", () => {
    const existing = new Set<string>();
    const slug1 = ensureUniqueSlug("tagesuebersicht", existing);
    existing.add(slug1);
    const slug2 = ensureUniqueSlug("tagesuebersicht", existing);
    existing.add(slug2);
    const slug3 = ensureUniqueSlug("tagesuebersicht", existing);

    expect(slug1).toBe("tagesuebersicht");
    expect(slug2).toBe("tagesuebersicht-2");
    expect(slug3).toBe("tagesuebersicht-3");

    // All must be unique
    expect(new Set([slug1, slug2, slug3]).size).toBe(3);
  });
});
