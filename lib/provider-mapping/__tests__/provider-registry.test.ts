/**
 * Tests for lib/provider-mapping/provider-registry.ts
 *
 * Covers:
 *   A. registerProviderAdapter — basic registration
 *   B. Duplicate prevention
 *   C. getProviderAdapter — found / not found
 *   D. getRegisteredProviders — empty / populated
 *   E. _clearRegistryForTests — isolation helper
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerProviderAdapter,
  getProviderAdapter,
  getRegisteredProviders,
  _clearRegistryForTests,
} from "../provider-registry";
import type { IProviderAdapter, ProviderTeam } from "../types";

// ── Mock adapter ───────────────────────────────────────────────────────────────

function makeAdapter(key: string): IProviderAdapter {
  return {
    providerKey: key,
    fetchProviderTeams: async (): Promise<ProviderTeam[]> => [],
    getProviderSeasonId: async (): Promise<number> => 1,
  };
}

beforeEach(() => {
  _clearRegistryForTests();
});

// ── A. Registration ────────────────────────────────────────────────────────────

describe("A. registerProviderAdapter", () => {
  it("registers an adapter successfully", () => {
    const adapter = makeAdapter("SFV");
    registerProviderAdapter(adapter);
    expect(getProviderAdapter("SFV")).toBe(adapter);
  });

  it("registered adapter is retrievable by key", () => {
    const sfv = makeAdapter("SFV");
    const knvb = makeAdapter("KNVB");
    registerProviderAdapter(sfv);
    registerProviderAdapter(knvb);
    expect(getProviderAdapter("SFV")).toBe(sfv);
    expect(getProviderAdapter("KNVB")).toBe(knvb);
  });
});

// ── B. Duplicate prevention ────────────────────────────────────────────────────

describe("B. Duplicate prevention", () => {
  it("throws when registering the same provider key twice", () => {
    registerProviderAdapter(makeAdapter("SFV"));
    expect(() => registerProviderAdapter(makeAdapter("SFV"))).toThrow(
      'Provider adapter for "SFV" is already registered.',
    );
  });
});

// ── C. getProviderAdapter ──────────────────────────────────────────────────────

describe("C. getProviderAdapter", () => {
  it("returns undefined for unknown provider key", () => {
    expect(getProviderAdapter("UNKNOWN")).toBeUndefined();
  });

  it("returns the adapter for a registered key", () => {
    const adapter = makeAdapter("SFV");
    registerProviderAdapter(adapter);
    expect(getProviderAdapter("SFV")).toBe(adapter);
  });
});

// ── D. getRegisteredProviders ──────────────────────────────────────────────────

describe("D. getRegisteredProviders", () => {
  it("returns empty array when no adapters registered", () => {
    expect(getRegisteredProviders()).toEqual([]);
  });

  it("returns all registered provider keys", () => {
    registerProviderAdapter(makeAdapter("SFV"));
    registerProviderAdapter(makeAdapter("KNVB"));
    const keys = getRegisteredProviders();
    expect(keys).toContain("SFV");
    expect(keys).toContain("KNVB");
    expect(keys).toHaveLength(2);
  });
});

// ── E. Test isolation ─────────────────────────────────────────────────────────

describe("E. _clearRegistryForTests", () => {
  it("removes all registrations", () => {
    registerProviderAdapter(makeAdapter("SFV"));
    _clearRegistryForTests();
    expect(getRegisteredProviders()).toEqual([]);
    expect(getProviderAdapter("SFV")).toBeUndefined();
  });
});
