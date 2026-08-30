import { describe, expect, it } from "vitest";

import {
  hasCanonicalPrefixBoundary,
  normalizeClubNameForLookup,
} from "../club-name-normalization";

describe("normalizeClubNameForLookup", () => {
  it("collapses hyphen and slash variants", () => {
    expect(normalizeClubNameForLookup("FC Diegten-Eptingen")).toBe(
      normalizeClubNameForLookup("FC Diegten Eptingen"),
    );
  });
});

describe("hasCanonicalPrefixBoundary", () => {
  it("accepts end-of-string boundaries", () => {
    expect(hasCanonicalPrefixBoundary("fc allschwil", "fc allschwil".length)).toBe(
      true,
    );
  });

  it("accepts whitespace boundaries", () => {
    expect(hasCanonicalPrefixBoundary("fc black stars d7a", "fc black stars".length)).toBe(
      true,
    );
  });

  it("rejects embedded substring boundaries", () => {
    expect(hasCanonicalPrefixBoundary("fc allschwil", "fc all".length)).toBe(false);
  });
});
