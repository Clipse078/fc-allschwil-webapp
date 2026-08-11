import { describe, it, expect } from "vitest";
import { getPersonalizedGreeting } from "@/lib/dashboard/greeting";

describe("getPersonalizedGreeting", () => {
  it("uses 'Guten Morgen' with the first name in the morning (05:00–11:59)", () => {
    expect(getPersonalizedGreeting("Michael", new Date(2026, 0, 1, 8, 0))).toBe(
      "Guten Morgen, Michael 👋",
    );
  });

  it("uses 'Guten Tag' with the first name in the afternoon (12:00–17:59)", () => {
    expect(getPersonalizedGreeting("Michael", new Date(2026, 0, 1, 14, 0))).toBe(
      "Guten Tag, Michael 👋",
    );
  });

  it("uses 'Guten Abend' with the first name in the evening (18:00–04:59)", () => {
    expect(getPersonalizedGreeting("Michael", new Date(2026, 0, 1, 20, 0))).toBe(
      "Guten Abend, Michael 👋",
    );
  });

  it("falls back to a neutral German salutation when firstName is undefined", () => {
    expect(getPersonalizedGreeting(undefined, new Date(2026, 0, 1, 8, 0))).toBe(
      "Guten Morgen, zusammen 👋",
    );
  });

  it("falls back to a neutral German salutation when firstName is null", () => {
    expect(getPersonalizedGreeting(null, new Date(2026, 0, 1, 8, 0))).toBe(
      "Guten Morgen, zusammen 👋",
    );
  });

  it("falls back to a neutral German salutation when firstName is an empty/whitespace string", () => {
    expect(getPersonalizedGreeting("   ", new Date(2026, 0, 1, 8, 0))).toBe(
      "Guten Morgen, zusammen 👋",
    );
  });

  it("never falls back to a tenant name, role name, or email address", () => {
    const greeting = getPersonalizedGreeting(undefined, new Date(2026, 0, 1, 8, 0));
    expect(greeting).not.toContain("FC Allschwil");
    expect(greeting).not.toContain("@");
    expect(greeting).not.toContain("Admin");
    expect(greeting).not.toContain("Club Admin");
  });

  it("trims surrounding whitespace from a valid first name", () => {
    expect(getPersonalizedGreeting("  Michael  ", new Date(2026, 0, 1, 8, 0))).toBe(
      "Guten Morgen, Michael 👋",
    );
  });
});
