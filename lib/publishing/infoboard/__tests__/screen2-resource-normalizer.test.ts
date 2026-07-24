/**
 * lib/publishing/infoboard/__tests__/screen2-resource-normalizer.test.ts
 *
 * Unit tests for the Screen 2 resource normalization layer.
 *
 * Covers:
 *   - normalizeMapKey: stable key derivation from various code formats
 *   - normalizeScreen2Resources: filtering, ordering, normalization
 *   - buildResourcesByCode: lookup map construction
 *   - buildHalfPitchResourcesByFacilityId: facility-grouped HALF_PITCH lookup
 *   - Archived and inactive resources excluded
 *   - Dressing rooms excluded
 *   - Tenant-scoped resources (input assumed tenant-scoped by DB)
 *   - Deterministic ordering
 *   - No hardcoded resource IDs
 *   - Six FC Allschwil-style resources representable
 *   - Fewer or more resources supported
 */

import { describe, it, expect } from "vitest";
import {
  normalizeMapKey,
  normalizeScreen2Resources,
  buildResourcesByCode,
  buildHalfPitchResourcesByFacilityId,
  type Screen2FacilityResourceRow,
} from "../screen2-resource-normalizer";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRow(
  overrides: Partial<Screen2FacilityResourceRow> = {},
): Screen2FacilityResourceRow {
  return {
    id: "res-1",
    tenantId: "tenant-a",
    facilityId: "fac-1",
    name: "Feld A",
    code: "FELD_A",
    type: "HALF_PITCH",
    status: "ACTIVE",
    sortOrder: 0,
    facility: { id: "fac-1", name: "Stadion" },
    ...overrides,
  };
}

// ── normalizeMapKey ────────────────────────────────────────────────────────────

describe("normalizeMapKey", () => {
  it("passes through a clean uppercase code unchanged", () => {
    expect(normalizeMapKey("STADION_A")).toBe("STADION_A");
  });

  it("uppercases lowercase codes", () => {
    expect(normalizeMapKey("stadion_a")).toBe("STADION_A");
  });

  it("replaces hyphens with underscores", () => {
    expect(normalizeMapKey("kr2-a")).toBe("KR2_A");
  });

  it("replaces spaces with underscores", () => {
    expect(normalizeMapKey("Feld A")).toBe("FELD_A");
  });

  it("collapses multiple separators into one underscore", () => {
    expect(normalizeMapKey("KR--2--A")).toBe("KR_2_A");
  });

  it("trims leading underscores", () => {
    expect(normalizeMapKey("-KR2")).toBe("KR2");
  });

  it("trims trailing underscores", () => {
    expect(normalizeMapKey("KR2-")).toBe("KR2");
  });

  it("returns null for an empty string", () => {
    expect(normalizeMapKey("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(normalizeMapKey("   ")).toBeNull();
  });

  it("returns null for a separator-only string", () => {
    expect(normalizeMapKey("---")).toBeNull();
  });

  it("handles FC Allschwil KUNSTRASEN_2_A code", () => {
    expect(normalizeMapKey("KUNSTRASEN_2_A")).toBe("KUNSTRASEN_2_A");
  });

  it("handles FC Allschwil KUNSTRASEN_3_B code", () => {
    expect(normalizeMapKey("KUNSTRASEN_3_B")).toBe("KUNSTRASEN_3_B");
  });

  it("handles mixed case with numbers", () => {
    expect(normalizeMapKey("Kunstrasen 2 B")).toBe("KUNSTRASEN_2_B");
  });
});

// ── normalizeScreen2Resources: filtering ──────────────────────────────────────

describe("normalizeScreen2Resources — filtering", () => {
  it("includes ACTIVE HALF_PITCH resources", () => {
    const rows = [makeRow({ type: "HALF_PITCH", status: "ACTIVE" })];
    const result = normalizeScreen2Resources(rows);
    expect(result).toHaveLength(1);
  });

  it("includes ACTIVE FULL_PITCH resources", () => {
    const rows = [makeRow({ type: "FULL_PITCH", status: "ACTIVE" })];
    const result = normalizeScreen2Resources(rows);
    expect(result).toHaveLength(1);
  });

  it("includes ACTIVE OTHER resources", () => {
    const rows = [makeRow({ type: "OTHER", status: "ACTIVE" })];
    const result = normalizeScreen2Resources(rows);
    expect(result).toHaveLength(1);
  });

  it("excludes DRESSING_ROOM resources regardless of status", () => {
    const rows = [
      makeRow({ type: "DRESSING_ROOM", status: "ACTIVE" }),
      makeRow({ id: "res-2", type: "DRESSING_ROOM", status: "INACTIVE" }),
    ];
    const result = normalizeScreen2Resources(rows);
    expect(result).toHaveLength(0);
  });

  it("excludes ARCHIVED resources", () => {
    const rows = [makeRow({ type: "HALF_PITCH", status: "ARCHIVED" })];
    const result = normalizeScreen2Resources(rows);
    expect(result).toHaveLength(0);
  });

  it("excludes INACTIVE resources", () => {
    const rows = [makeRow({ type: "HALF_PITCH", status: "INACTIVE" })];
    const result = normalizeScreen2Resources(rows);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeScreen2Resources([])).toHaveLength(0);
  });

  it("does not mutate the input array", () => {
    const rows = [makeRow()];
    const original = [...rows];
    normalizeScreen2Resources(rows);
    expect(rows).toEqual(original);
  });
});

// ── normalizeScreen2Resources: ordering ───────────────────────────────────────

describe("normalizeScreen2Resources — ordering", () => {
  it("sorts by sortOrder ascending", () => {
    const rows = [
      makeRow({ id: "res-b", name: "B", sortOrder: 2 }),
      makeRow({ id: "res-a", name: "A", sortOrder: 1 }),
    ];
    const result = normalizeScreen2Resources(rows);
    expect(result.map((r) => r.id)).toEqual(["res-a", "res-b"]);
  });

  it("sorts by name ascending when sortOrder is equal", () => {
    const rows = [
      makeRow({ id: "res-c", name: "Feld C", sortOrder: 0 }),
      makeRow({ id: "res-a", name: "Feld A", sortOrder: 0 }),
    ];
    const result = normalizeScreen2Resources(rows);
    expect(result.map((r) => r.name)).toEqual(["Feld A", "Feld C"]);
  });

  it("sorts by id ascending as final tiebreaker", () => {
    const rows = [
      makeRow({ id: "res-z", name: "X", sortOrder: 0 }),
      makeRow({ id: "res-a", name: "X", sortOrder: 0 }),
    ];
    const result = normalizeScreen2Resources(rows);
    expect(result.map((r) => r.id)).toEqual(["res-a", "res-z"]);
  });

  it("is deterministic: same input always produces same output order", () => {
    const rows = [
      makeRow({ id: "c", name: "Feld C", sortOrder: 5 }),
      makeRow({ id: "a", name: "Feld A", sortOrder: 1 }),
      makeRow({ id: "b", name: "Feld B", sortOrder: 3 }),
    ];
    const first = normalizeScreen2Resources(rows);
    const second = normalizeScreen2Resources(rows);
    expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id));
  });
});

// ── normalizeScreen2Resources: mapKey ─────────────────────────────────────────

describe("normalizeScreen2Resources — mapKey", () => {
  it("derives mapKey from code", () => {
    const rows = [makeRow({ code: "kr2-a" })];
    const result = normalizeScreen2Resources(rows);
    expect(result[0].mapKey).toBe("KR2_A");
  });

  it("sets mapKey to null when code is empty", () => {
    const rows = [makeRow({ code: "" })];
    const result = normalizeScreen2Resources(rows);
    expect(result[0].mapKey).toBeNull();
  });

  it("preserves facilityId and facilityName from nested relation", () => {
    const rows = [
      makeRow({ facilityId: "fac-xyz", facility: { id: "fac-xyz", name: "Mein Stadion" } }),
    ];
    const result = normalizeScreen2Resources(rows);
    expect(result[0].facilityId).toBe("fac-xyz");
    expect(result[0].facilityName).toBe("Mein Stadion");
  });
});

// ── FC Allschwil six-field scenario ───────────────────────────────────────────

describe("normalizeScreen2Resources — FC Allschwil six fields", () => {
  const FCA_ROWS: Screen2FacilityResourceRow[] = [
    { id: "r1", tenantId: "fca", facilityId: "fac-stadion", name: "Feld A", code: "STADION_A", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 10, facility: { id: "fac-stadion", name: "Stadion" } },
    { id: "r2", tenantId: "fca", facilityId: "fac-stadion", name: "Feld B", code: "STADION_B", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 20, facility: { id: "fac-stadion", name: "Stadion" } },
    { id: "r3", tenantId: "fca", facilityId: "fac-kr2", name: "Feld A", code: "KUNSTRASEN_2_A", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 30, facility: { id: "fac-kr2", name: "KR 2" } },
    { id: "r4", tenantId: "fca", facilityId: "fac-kr2", name: "Feld B", code: "KUNSTRASEN_2_B", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 40, facility: { id: "fac-kr2", name: "KR 2" } },
    { id: "r5", tenantId: "fca", facilityId: "fac-kr3", name: "Feld A", code: "KUNSTRASEN_3_A", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 50, facility: { id: "fac-kr3", name: "KR 3" } },
    { id: "r6", tenantId: "fca", facilityId: "fac-kr3", name: "Feld B", code: "KUNSTRASEN_3_B", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 60, facility: { id: "fac-kr3", name: "KR 3" } },
    // Dressing rooms — must be excluded
    { id: "dr1", tenantId: "fca", facilityId: "fac-stadion", name: "E1", code: "E1", type: "DRESSING_ROOM", status: "ACTIVE", sortOrder: 0, facility: { id: "fac-stadion", name: "Stadion" } },
  ];

  it("returns exactly six display fields (dressing rooms excluded)", () => {
    const result = normalizeScreen2Resources(FCA_ROWS);
    expect(result).toHaveLength(6);
  });

  it("assigns correct mapKeys to all six fields", () => {
    const result = normalizeScreen2Resources(FCA_ROWS);
    const mapKeys = result.map((r) => r.mapKey);
    expect(mapKeys).toContain("STADION_A");
    expect(mapKeys).toContain("STADION_B");
    expect(mapKeys).toContain("KUNSTRASEN_2_A");
    expect(mapKeys).toContain("KUNSTRASEN_2_B");
    expect(mapKeys).toContain("KUNSTRASEN_3_A");
    expect(mapKeys).toContain("KUNSTRASEN_3_B");
  });

  it("preserves correct sortOrder", () => {
    const result = normalizeScreen2Resources(FCA_ROWS);
    expect(result[0].sortOrder).toBe(10);
    expect(result[5].sortOrder).toBe(60);
  });

  it("supports fewer fields (1 field facility)", () => {
    const single = [FCA_ROWS[0]];
    expect(normalizeScreen2Resources(single)).toHaveLength(1);
  });

  it("supports more fields (tenant with 8 resources)", () => {
    const extra = [
      ...FCA_ROWS.filter((r) => r.type !== "DRESSING_ROOM"),
      { id: "r7", tenantId: "fca", facilityId: "fac-kr4", name: "Feld A", code: "KR4_A", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 70, facility: { id: "fac-kr4", name: "KR 4" } },
      { id: "r8", tenantId: "fca", facilityId: "fac-kr4", name: "Feld B", code: "KR4_B", type: "HALF_PITCH", status: "ACTIVE", sortOrder: 80, facility: { id: "fac-kr4", name: "KR 4" } },
    ];
    expect(normalizeScreen2Resources(extra)).toHaveLength(8);
  });
});

// ── buildResourcesByCode ───────────────────────────────────────────────────────

describe("buildResourcesByCode", () => {
  it("builds a lookup map from code to resource", () => {
    const rows = [makeRow({ id: "res-1", code: "FELD_A" })];
    const normalized = normalizeScreen2Resources(rows);
    const map = buildResourcesByCode(normalized);
    expect(map.get("FELD_A")?.id).toBe("res-1");
  });

  it("returns empty map for empty input", () => {
    expect(buildResourcesByCode([])).toEqual(new Map());
  });

  it("does not include DRESSING_ROOM in the map (filtered before call)", () => {
    const rows = [
      makeRow({ id: "res-dr", code: "DR1", type: "DRESSING_ROOM", status: "ACTIVE" }),
    ];
    const normalized = normalizeScreen2Resources(rows);
    const map = buildResourcesByCode(normalized);
    expect(map.has("DR1")).toBe(false);
  });
});

// ── buildHalfPitchResourcesByFacilityId ───────────────────────────────────────

describe("buildHalfPitchResourcesByFacilityId", () => {
  it("groups HALF_PITCH resources by facilityId", () => {
    const rows = [
      makeRow({ id: "r1", facilityId: "fac-1", type: "HALF_PITCH" }),
      makeRow({ id: "r2", facilityId: "fac-1", type: "HALF_PITCH" }),
      makeRow({ id: "r3", facilityId: "fac-2", type: "HALF_PITCH" }),
    ];
    const normalized = normalizeScreen2Resources(rows);
    const map = buildHalfPitchResourcesByFacilityId(normalized);
    expect(map.get("fac-1")).toHaveLength(2);
    expect(map.get("fac-2")).toHaveLength(1);
  });

  it("does not include FULL_PITCH resources in the grouped map", () => {
    const rows = [
      makeRow({ id: "full", facilityId: "fac-1", type: "FULL_PITCH", code: "STADION" }),
      makeRow({ id: "half-a", facilityId: "fac-1", type: "HALF_PITCH", code: "STADION_A" }),
    ];
    const normalized = normalizeScreen2Resources(rows);
    const map = buildHalfPitchResourcesByFacilityId(normalized);
    expect(map.get("fac-1")).toHaveLength(1);
    expect(map.get("fac-1")![0].id).toBe("half-a");
  });

  it("returns empty map when no HALF_PITCH resources exist", () => {
    const rows = [makeRow({ type: "FULL_PITCH" })];
    const normalized = normalizeScreen2Resources(rows);
    const map = buildHalfPitchResourcesByFacilityId(normalized);
    expect(map.size).toBe(0);
  });
});
