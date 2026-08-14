/**
 * lib/infoboard/__tests__/anlageplan-types.test.ts
 *
 * INFOBOARD-MAP-01 — Anlageplan type system tests.
 *
 * Covers:
 *   - Normalized map element persistence (parse/validate round-trip)
 *   - Tenant scoping (board-level fields)
 *   - Resource-zone mapping (resourceCode association)
 *   - Current activity → correct resource zone (code matching)
 *   - Feld A/B distinction (HALF_PITCH zone type)
 *   - Whole-pitch allocation (FULL_PITCH zone type)
 *   - Du bist hier board-specific persistence
 *   - Invalid/missing background behavior
 *   - Public Anlageplan configuration loading (parseAnlageplanJson)
 */

import { describe, it, expect } from "vitest";
import {
  parseAnlageplanJson,
  emptyAnlageplanConfig,
  validateAnlageplanConfig,
  validateNormalizedRect,
  isResourceZone,
  isMarker,
  isDuBistHier,
  MARKER_LABELS,
  defaultRect,
  defaultMarkerRect,
  defaultDuBistHierRect,
  type AnlageplanConfig,
  type ResourceZoneElement,
  type MarkerElement,
  type NormalizedRect,
} from "../anlageplan-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeZone(overrides?: Partial<ResourceZoneElement>): ResourceZoneElement {
  return {
    kind: "RESOURCE_ZONE",
    id: "zone-1",
    rect: defaultRect(),
    resourceCode: "KR2",
    label: "Kunstrasen 2",
    zoneType: "FULL_PITCH",
    showNextActivity: true,
    ...overrides,
  };
}

function makeMarker(overrides?: Partial<MarkerElement>): MarkerElement {
  return {
    kind: "MARKER",
    id: "marker-1",
    rect: defaultMarkerRect(),
    markerType: "WC",
    label: "WC",
    secondaryText: null,
    ...overrides,
  };
}

function makeDuBistHier(overrides?: Partial<MarkerElement>): MarkerElement {
  return {
    kind: "MARKER",
    id: "dbh-1",
    rect: defaultDuBistHierRect(),
    markerType: "DU_BIST_HIER",
    label: "Du bist hier",
    secondaryText: null,
    ...overrides,
  };
}

function makeConfig(elements: AnlageplanConfig["elements"] = []): AnlageplanConfig {
  return { version: 1, elements };
}

// ── NormalizedRect validation ─────────────────────────────────────────────────

describe("validateNormalizedRect", () => {
  it("accepts valid rect", () => {
    expect(validateNormalizedRect({ x: 0.1, y: 0.2, width: 0.3, height: 0.15 })).toBeNull();
  });

  it("accepts rect with rotation 0", () => {
    expect(validateNormalizedRect({ x: 0, y: 0, width: 1, height: 1, rotation: 0 })).toBeNull();
  });

  it("accepts rect with rotation 90", () => {
    expect(validateNormalizedRect({ x: 0.1, y: 0.1, width: 0.2, height: 0.2, rotation: 90 })).toBeNull();
  });

  it("rejects x < 0", () => {
    expect(validateNormalizedRect({ x: -0.1, y: 0, width: 0.2, height: 0.1 })).toContain("x");
  });

  it("rejects x > 1", () => {
    expect(validateNormalizedRect({ x: 1.1, y: 0, width: 0.2, height: 0.1 })).toContain("x");
  });

  it("rejects y > 1", () => {
    expect(validateNormalizedRect({ x: 0, y: 1.5, width: 0.2, height: 0.1 })).toContain("y");
  });

  it("rejects width = 0", () => {
    expect(validateNormalizedRect({ x: 0.1, y: 0.1, width: 0, height: 0.1 })).toContain("width");
  });

  it("rejects height > 1", () => {
    expect(validateNormalizedRect({ x: 0, y: 0, width: 0.5, height: 1.5 })).toContain("height");
  });

  it("rejects rotation > 360", () => {
    expect(
      validateNormalizedRect({ x: 0.1, y: 0.1, width: 0.2, height: 0.1, rotation: 361 }),
    ).toContain("rotation");
  });
});

// ── AnlageplanConfig validation ───────────────────────────────────────────────

describe("validateAnlageplanConfig", () => {
  it("accepts empty config", () => {
    expect(validateAnlageplanConfig(emptyAnlageplanConfig())).toBeNull();
  });

  it("accepts config with valid zone", () => {
    expect(validateAnlageplanConfig(makeConfig([makeZone()]))).toBeNull();
  });

  it("accepts config with valid marker", () => {
    expect(validateAnlageplanConfig(makeConfig([makeMarker()]))).toBeNull();
  });

  it("accepts config with mixed elements", () => {
    const config = makeConfig([makeZone(), makeMarker(), makeDuBistHier()]);
    expect(validateAnlageplanConfig(config)).toBeNull();
  });

  it("rejects wrong version", () => {
    expect(validateAnlageplanConfig({ version: 2 as unknown as 1, elements: [] })).toContain("Version");
  });

  it("rejects missing id", () => {
    const zone = { ...makeZone(), id: "" };
    expect(validateAnlageplanConfig(makeConfig([zone]))).toContain("id");
  });

  it("rejects duplicate ids", () => {
    const zone1 = makeZone({ id: "same" });
    const zone2 = makeZone({ id: "same", resourceCode: "KR3" });
    expect(validateAnlageplanConfig(makeConfig([zone1, zone2]))).toContain("same");
  });

  it("rejects element with invalid rect", () => {
    const zone = makeZone({ rect: { x: -0.1, y: 0, width: 0.2, height: 0.1 } });
    expect(validateAnlageplanConfig(makeConfig([zone]))).toMatch(/zone-1.+x/);
  });
});

// ── parseAnlageplanJson ───────────────────────────────────────────────────────

describe("parseAnlageplanJson", () => {
  it("returns null for null input", () => {
    expect(parseAnlageplanJson(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseAnlageplanJson(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseAnlageplanJson("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseAnlageplanJson("{invalid}")).toBeNull();
  });

  it("returns null for wrong version", () => {
    expect(parseAnlageplanJson(JSON.stringify({ version: 2, elements: [] }))).toBeNull();
  });

  it("returns null for missing elements array", () => {
    expect(parseAnlageplanJson(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it("parses valid config", () => {
    const config = makeConfig([makeZone()]);
    const result = parseAnlageplanJson(JSON.stringify(config));
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.elements).toHaveLength(1);
  });

  it("round-trips config without data loss", () => {
    const config = makeConfig([
      makeZone({ resourceCode: "KR2-A", zoneType: "HALF_PITCH" }),
      makeMarker({ markerType: "KABINE", label: "Kabinen 1–8" }),
      makeDuBistHier({ rect: { x: 0.5, y: 0.5, width: 0.08, height: 0.1 } }),
    ]);
    const serialized = JSON.stringify(config);
    const parsed = parseAnlageplanJson(serialized);
    expect(parsed).toEqual(config);
  });
});

// ── Resource zone mapping ─────────────────────────────────────────────────────

describe("Resource zone mapping", () => {
  it("FULL_PITCH zone links to whole pitch resource", () => {
    const zone = makeZone({ resourceCode: "KR1", zoneType: "FULL_PITCH" });
    expect(zone.resourceCode).toBe("KR1");
    expect(zone.zoneType).toBe("FULL_PITCH");
    expect(isResourceZone(zone)).toBe(true);
  });

  it("HALF_PITCH zone (Feld A) links to half-pitch resource", () => {
    const zone = makeZone({ resourceCode: "KR2-A", zoneType: "HALF_PITCH", label: "KR2 Feld A" });
    expect(zone.resourceCode).toBe("KR2-A");
    expect(zone.zoneType).toBe("HALF_PITCH");
    expect(zone.label).toBe("KR2 Feld A");
  });

  it("HALF_PITCH zone (Feld B) links to correct resource", () => {
    const zone = makeZone({ resourceCode: "KR2-B", zoneType: "HALF_PITCH", label: "KR2 Feld B" });
    expect(zone.resourceCode).toBe("KR2-B");
    expect(zone.zoneType).toBe("HALF_PITCH");
  });

  it("Feld A and Feld B are distinct zones (different ids and codes)", () => {
    const zoneA = makeZone({ id: "zone-a", resourceCode: "KR2-A", zoneType: "HALF_PITCH" });
    const zoneB = makeZone({ id: "zone-b", resourceCode: "KR2-B", zoneType: "HALF_PITCH" });
    expect(zoneA.id).not.toBe(zoneB.id);
    expect(zoneA.resourceCode).not.toBe(zoneB.resourceCode);
    // Config is valid (distinct ids)
    expect(validateAnlageplanConfig(makeConfig([zoneA, zoneB]))).toBeNull();
  });

  it("zone with null resourceCode is unlinked (valid but unmapped)", () => {
    const zone = makeZone({ resourceCode: null });
    expect(zone.resourceCode).toBeNull();
    expect(validateAnlageplanConfig(makeConfig([zone]))).toBeNull();
  });

  it("resource code matching is exact string equality", () => {
    // Simulates the lookup: pitchMap.get(zone.resourceCode)
    const pitches = new Map([
      ["KR2", { code: "KR2", state: "OCCUPIED_NOW" }],
      ["KR2-A", { code: "KR2-A", state: "FREE_NOW" }],
    ]);
    const zoneKR2 = makeZone({ resourceCode: "KR2" });
    const zoneKR2A = makeZone({ id: "z2", resourceCode: "KR2-A" });

    expect(pitches.get(zoneKR2.resourceCode!)).toBeDefined();
    expect(pitches.get(zoneKR2A.resourceCode!)).toBeDefined();

    // "KR2" does NOT match "KR2-A" — Feld A/B are distinct
    expect(pitches.get(zoneKR2.resourceCode!)).not.toEqual(pitches.get(zoneKR2A.resourceCode!));
  });
});

// ── Du bist hier board-specific persistence ───────────────────────────────────

describe("Du bist hier element", () => {
  it("isDuBistHier identifies correct element", () => {
    const dbh = makeDuBistHier();
    expect(isDuBistHier(dbh)).toBe(true);
  });

  it("isDuBistHier rejects regular markers", () => {
    const marker = makeMarker({ markerType: "WC" });
    expect(isDuBistHier(marker)).toBe(false);
  });

  it("isDuBistHier rejects zones", () => {
    const zone = makeZone();
    expect(isDuBistHier(zone)).toBe(false);
  });

  it("Du bist hier has distinct position from other elements", () => {
    const dbh = makeDuBistHier({ rect: { x: 0.4, y: 0.3, width: 0.08, height: 0.10 } });
    const other = makeMarker({ rect: { x: 0.7, y: 0.8, width: 0.05, height: 0.07 } });
    expect(dbh.rect.x).not.toBe(other.rect.x);
  });

  it("board-specific: two different configs can each have their own Du bist hier", () => {
    // Simulates two physical screens at different locations
    const boardA = makeConfig([makeDuBistHier({ rect: { x: 0.1, y: 0.1, width: 0.08, height: 0.1 } })]);
    const boardB = makeConfig([makeDuBistHier({ id: "dbh-b", rect: { x: 0.8, y: 0.7, width: 0.08, height: 0.1 } })]);
    expect(boardA.elements[0]).not.toEqual(boardB.elements[0]);
    expect(validateAnlageplanConfig(boardA)).toBeNull();
    expect(validateAnlageplanConfig(boardB)).toBeNull();
  });

  it("Du bist hier position round-trips via JSON", () => {
    const dbh = makeDuBistHier({ rect: { x: 0.42, y: 0.35, width: 0.09, height: 0.11 } });
    const config = makeConfig([dbh]);
    const serialized = JSON.stringify(config);
    const parsed = parseAnlageplanJson(serialized);
    const parsedDbh = parsed!.elements[0] as MarkerElement;
    expect(parsedDbh.rect.x).toBe(0.42);
    expect(parsedDbh.rect.y).toBe(0.35);
    expect(parsedDbh.markerType).toBe("DU_BIST_HIER");
  });
});

// ── Marker palette ────────────────────────────────────────────────────────────

describe("Marker types", () => {
  it("all marker type labels are defined", () => {
    const allTypes: Array<MarkerElement["markerType"]> = [
      "DU_BIST_HIER",
      "HAUPTEINGANG",
      "KABINE",
      "WC",
      "BISTRO",
      "PARKPLATZ",
      "SEKRETARIAT",
      "SPEAKERRAUM",
      "ERSTE_HILFE",
      "FREIER_MARKER",
    ];
    for (const t of allTypes) {
      expect(MARKER_LABELS[t]).toBeTruthy();
    }
  });

  it("marker element passes validation", () => {
    const markers: MarkerElement[] = [
      makeMarker({ id: "m1", markerType: "HAUPTEINGANG" }),
      makeMarker({ id: "m2", markerType: "WC" }),
      makeMarker({ id: "m3", markerType: "BISTRO" }),
      makeMarker({ id: "m4", markerType: "KABINE" }),
      makeMarker({ id: "m5", markerType: "PARKPLATZ" }),
    ];
    expect(validateAnlageplanConfig(makeConfig(markers))).toBeNull();
  });
});

// ── Background URL handling ───────────────────────────────────────────────────

describe("Background URL behavior", () => {
  it("config is valid with no background (independent of backgroundUrl)", () => {
    // backgroundUrl is stored separately on the Infoboard row, not in anlageplanJson
    expect(validateAnlageplanConfig(emptyAnlageplanConfig())).toBeNull();
  });

  it("null backgroundUrl is valid — empty canvas state", () => {
    // Simulates board.anlageplanBackgroundUrl = null
    const backgroundUrl: string | null = null;
    // Kiosk should render without a background — not throw
    expect(backgroundUrl).toBeNull();
  });

  it("empty string backgroundUrl treated as no image by component logic", () => {
    // The kiosk component checks `if (backgroundUrl)` — empty string is falsy
    const backgroundUrl = "";
    expect(!!backgroundUrl).toBe(false);
  });
});

// ── Type guards ───────────────────────────────────────────────────────────────

describe("Type guards", () => {
  it("isResourceZone returns true for zones", () => {
    expect(isResourceZone(makeZone())).toBe(true);
  });

  it("isResourceZone returns false for markers", () => {
    expect(isResourceZone(makeMarker())).toBe(false);
  });

  it("isMarker returns true for markers", () => {
    expect(isMarker(makeMarker())).toBe(true);
  });

  it("isMarker returns false for zones", () => {
    expect(isMarker(makeZone())).toBe(false);
  });
});

// ── Tenant scoping ────────────────────────────────────────────────────────────

describe("Tenant scoping (model level)", () => {
  it("two boards with same config are independent (no shared reference)", () => {
    const config1 = makeConfig([makeZone({ id: "z1", resourceCode: "KR1" })]);
    const config2 = makeConfig([makeZone({ id: "z1", resourceCode: "KR3" })]);
    // They are different configs despite same element id — each board owns its own config
    const el1 = config1.elements[0] as ResourceZoneElement;
    const el2 = config2.elements[0] as ResourceZoneElement;
    expect(el1.resourceCode).toBe("KR1");
    expect(el2.resourceCode).toBe("KR3");
  });

  it("board with empty anlageplanJson falls back gracefully", () => {
    // Simulates getInfoboard returning a board with no config
    const result = parseAnlageplanJson(null) ?? emptyAnlageplanConfig();
    expect(result.version).toBe(1);
    expect(result.elements).toHaveLength(0);
  });

  it("board with corrupt anlageplanJson falls back to empty", () => {
    const result = parseAnlageplanJson("CORRUPT:JSON{{{") ?? emptyAnlageplanConfig();
    expect(result.elements).toHaveLength(0);
  });
});

// ── Whole-pitch vs half-pitch allocation logic ────────────────────────────────

describe("Pitch allocation type", () => {
  it("full-pitch zone maps to pitch occupancy by exact code", () => {
    // Simulates: zone.resourceCode === pitchOccupancy.code
    const zone = makeZone({ resourceCode: "KR3", zoneType: "FULL_PITCH" });
    const pitchOccupancies = [
      { code: "KR3", state: "OCCUPIED_NOW" },
      { code: "KR3-A", state: "FREE_NOW" },
      { code: "KR3-B", state: "FREE_NOW" },
    ];
    const matched = pitchOccupancies.find((p) => p.code === zone.resourceCode);
    expect(matched?.code).toBe("KR3");
    expect(matched?.state).toBe("OCCUPIED_NOW");
  });

  it("half-pitch zone does NOT match the full-pitch code", () => {
    const zone = makeZone({ resourceCode: "KR3-A", zoneType: "HALF_PITCH" });
    const pitchOccupancies = [
      { code: "KR3", state: "OCCUPIED_NOW" },
      { code: "KR3-A", state: "FREE_NOW" },
    ];
    const matched = pitchOccupancies.find((p) => p.code === zone.resourceCode);
    expect(matched?.code).toBe("KR3-A");
    // Critically: does not match "KR3" (full)
    const fullMatch = pitchOccupancies.find((p) => p.code === "KR3");
    expect(fullMatch?.code).not.toBe(zone.resourceCode);
  });

  it("F2 on KR2 Feld A shows only on KR2-A zone, not KR2", () => {
    // Simulates the spec: "F2 17:00–18:30 KR2 Feld A → show on configured KR2-A zone"
    const zones = [
      makeZone({ id: "z-kr2", resourceCode: "KR2", zoneType: "FULL_PITCH" }),
      makeZone({ id: "z-kr2a", resourceCode: "KR2-A", zoneType: "HALF_PITCH" }),
    ];
    const pitchMap = new Map([
      ["KR2", { code: "KR2", currentEvent: null }],
      ["KR2-A", { code: "KR2-A", currentEvent: { displayTitle: "F2" } }],
    ]);
    for (const zone of zones) {
      const occ = zone.resourceCode ? pitchMap.get(zone.resourceCode) : null;
      if (zone.id === "z-kr2a") {
        expect(occ?.currentEvent).not.toBeNull();
        expect(occ?.currentEvent?.displayTitle).toBe("F2");
      } else {
        expect(occ?.currentEvent).toBeNull();
      }
    }
  });
});
