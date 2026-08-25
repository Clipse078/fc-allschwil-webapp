/**
 * lib/integrations/sfv/__tests__/season-bridge.test.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSeasonFindUnique = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    season: {
      findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args),
    },
  },
}));

const {
  getSfvSeasonStartYear,
  getCanonicalSeasonKeyFromSfvExternalSeasonId,
  getSeasonKeyLookupCandidatesFromSfvExternalSeasonId,
  resolveCanonicalSeasonFromSfvExternalSeasonId,
} = await import("../season-bridge");

describe("getSfvSeasonStartYear", () => {
  it("maps SFV 2027 to start year 2026", () => {
    expect(getSfvSeasonStartYear(2027)).toBe(2026);
  });

  it("rejects invalid season ids", () => {
    expect(() => getSfvSeasonStartYear(0)).toThrow();
  });
});

describe("getCanonicalSeasonKeyFromSfvExternalSeasonId", () => {
  it("maps SFV 2027 to canonical key 2026/2027", () => {
    expect(getCanonicalSeasonKeyFromSfvExternalSeasonId(2027)).toBe("2026/2027");
  });
});

describe("getSeasonKeyLookupCandidatesFromSfvExternalSeasonId", () => {
  it("includes canonical slash and hyphen variants only", () => {
    expect(getSeasonKeyLookupCandidatesFromSfvExternalSeasonId(2027)).toEqual([
      "2026/2027",
      "2026-2027",
    ]);
  });

  it("never includes end-year-first keys like 2027-2028", () => {
    const candidates = getSeasonKeyLookupCandidatesFromSfvExternalSeasonId(2027);
    expect(candidates).not.toContain("2027-2028");
  });
});

describe("resolveCanonicalSeasonFromSfvExternalSeasonId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves by canonical key first", async () => {
    mockSeasonFindUnique.mockResolvedValueOnce({
      id: "season-1",
      key: "2026/2027",
    });

    const result = await resolveCanonicalSeasonFromSfvExternalSeasonId(2027);

    expect(result).toEqual({ id: "season-1", key: "2026/2027" });
    expect(mockSeasonFindUnique).toHaveBeenCalledWith({
      where: { key: "2026/2027" },
      select: { id: true, key: true },
    });
  });

  it("falls back to hyphen key when canonical key is missing", async () => {
    mockSeasonFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "season-2", key: "2026-2027" });

    const result = await resolveCanonicalSeasonFromSfvExternalSeasonId(2027);

    expect(result).toEqual({ id: "season-2", key: "2026-2027" });
  });

  it("returns null when no season row exists", async () => {
    mockSeasonFindUnique.mockResolvedValue(null);

    const result = await resolveCanonicalSeasonFromSfvExternalSeasonId(2027);

    expect(result).toBeNull();
  });
});
