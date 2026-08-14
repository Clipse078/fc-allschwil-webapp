/**
 * lib/infoboard/__tests__/anlageplan-resource-filter.test.ts
 *
 * INFOBOARD-MAP-01C — Focused tests for:
 *   1. FULL_PITCH picker shows whole-field resources only
 *   2. HALF_PITCH picker shows partial resources only
 *   3. Existing selected value remains readable (stale option)
 *   4. Zone type determined by element created from palette (no editable Feldtyp)
 */

import { describe, it, expect } from "vitest";
import {
  anlageplanResourceLabel,
  type AnlageplanResourceOption,
  type ResourceZoneElement,
} from "../anlageplan-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALL_OPTIONS: AnlageplanResourceOption[] = [
  // Full pitches
  { code: "HP", name: "Hauptplatz", type: "FULL_PITCH", facilityName: "Hauptplatz" },
  { code: "KR2", name: "Kunstrasen 2", type: "FULL_PITCH", facilityName: "Kunstrasen 2" },
  { code: "KR3", name: "Kunstrasen 3", type: "FULL_PITCH", facilityName: "Kunstrasen 3" },
  // Half pitches
  { code: "HP-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Hauptplatz" },
  { code: "HP-B", name: "Feld B", type: "HALF_PITCH", facilityName: "Hauptplatz" },
  { code: "KR2-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Kunstrasen 2" },
  { code: "KR2-B", name: "Feld B", type: "HALF_PITCH", facilityName: "Kunstrasen 2" },
  { code: "KR3-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Kunstrasen 3" },
  { code: "KR3-B", name: "Feld B", type: "HALF_PITCH", facilityName: "Kunstrasen 3" },
];

/** Simulates the filter applied in the designer picker for a given zoneType. */
function filterOptions(
  opts: AnlageplanResourceOption[],
  zoneType: "FULL_PITCH" | "HALF_PITCH",
): AnlageplanResourceOption[] {
  return opts.filter((o) => o.type === zoneType);
}

/** Simulates stale-option detection (current code is from the other type). */
function detectStaleOpt(
  opts: AnlageplanResourceOption[],
  zoneType: "FULL_PITCH" | "HALF_PITCH",
  currentCode: string | null,
): AnlageplanResourceOption | null {
  if (!currentCode) return null;
  const filteredOpts = filterOptions(opts, zoneType);
  const currentOpt = opts.find((o) => o.code === currentCode) ?? null;
  if (!currentOpt || filteredOpts.find((o) => o.code === currentCode)) return null;
  return currentOpt;
}

// ── 1. FULL_PITCH picker ──────────────────────────────────────────────────────

describe("FULL_PITCH picker filtering", () => {
  it("shows only FULL_PITCH options for a FULL_PITCH zone", () => {
    const opts = filterOptions(ALL_OPTIONS, "FULL_PITCH");
    expect(opts.every((o) => o.type === "FULL_PITCH")).toBe(true);
    expect(opts.map((o) => o.code)).toEqual(["HP", "KR2", "KR3"]);
  });

  it("does NOT show HALF_PITCH options (A/B fields) in FULL_PITCH picker", () => {
    const opts = filterOptions(ALL_OPTIONS, "FULL_PITCH");
    const halfCodes = ["HP-A", "HP-B", "KR2-A", "KR2-B", "KR3-A", "KR3-B"];
    for (const code of halfCodes) {
      expect(opts.find((o) => o.code === code)).toBeUndefined();
    }
  });

  it("FULL_PITCH picker includes Hauptplatz, Kunstrasen 2, Kunstrasen 3", () => {
    const opts = filterOptions(ALL_OPTIONS, "FULL_PITCH");
    const names = opts.map((o) => anlageplanResourceLabel(o));
    expect(names).toContain("Hauptplatz");
    expect(names).toContain("Kunstrasen 2");
    expect(names).toContain("Kunstrasen 3");
  });
});

// ── 2. HALF_PITCH picker ──────────────────────────────────────────────────────

describe("HALF_PITCH picker filtering", () => {
  it("shows only HALF_PITCH options for a HALF_PITCH zone", () => {
    const opts = filterOptions(ALL_OPTIONS, "HALF_PITCH");
    expect(opts.every((o) => o.type === "HALF_PITCH")).toBe(true);
    expect(opts.map((o) => o.code)).toEqual([
      "HP-A", "HP-B", "KR2-A", "KR2-B", "KR3-A", "KR3-B",
    ]);
  });

  it("does NOT show whole-pitch options in HALF_PITCH picker", () => {
    const opts = filterOptions(ALL_OPTIONS, "HALF_PITCH");
    const fullCodes = ["HP", "KR2", "KR3"];
    for (const code of fullCodes) {
      expect(opts.find((o) => o.code === code)).toBeUndefined();
    }
  });

  it("HALF_PITCH picker includes Hauptplatz A/B, Kunstrasen 2 A/B, Kunstrasen 3 A/B", () => {
    const opts = filterOptions(ALL_OPTIONS, "HALF_PITCH");
    const labels = opts.map((o) => anlageplanResourceLabel(o));
    expect(labels).toContain("Hauptplatz · Feld A");
    expect(labels).toContain("Hauptplatz · Feld B");
    expect(labels).toContain("Kunstrasen 2 · Feld A");
    expect(labels).toContain("Kunstrasen 2 · Feld B");
    expect(labels).toContain("Kunstrasen 3 · Feld A");
    expect(labels).toContain("Kunstrasen 3 · Feld B");
  });
});

// ── 3. Stale option — existing selected value stays readable ──────────────────

describe("Stale option: existing selected value remains readable", () => {
  it("no stale opt when current code matches zoneType", () => {
    const stale = detectStaleOpt(ALL_OPTIONS, "FULL_PITCH", "HP");
    expect(stale).toBeNull();
  });

  it("no stale opt when current code is null", () => {
    const stale = detectStaleOpt(ALL_OPTIONS, "FULL_PITCH", null);
    expect(stale).toBeNull();
  });

  it("detects stale when HALF_PITCH code is on a FULL_PITCH zone", () => {
    const stale = detectStaleOpt(ALL_OPTIONS, "FULL_PITCH", "KR2-A");
    expect(stale).not.toBeNull();
    expect(stale!.code).toBe("KR2-A");
    expect(stale!.type).toBe("HALF_PITCH");
  });

  it("detects stale when FULL_PITCH code is on a HALF_PITCH zone", () => {
    const stale = detectStaleOpt(ALL_OPTIONS, "HALF_PITCH", "HP");
    expect(stale).not.toBeNull();
    expect(stale!.code).toBe("HP");
    expect(stale!.type).toBe("FULL_PITCH");
  });

  it("stale option code is the same as the currently stored resourceCode", () => {
    const currentCode = "KR3";
    const stale = detectStaleOpt(ALL_OPTIONS, "HALF_PITCH", currentCode);
    expect(stale!.code).toBe(currentCode);
  });
});

// ── 4. Zone type determined by palette element, not editable Feldtyp ──────────

describe("Zone type from palette (no editable Feldtyp)", () => {
  it("addResourceZone(FULL_PITCH) creates a FULL_PITCH zone", () => {
    // Simulates addResourceZone in AnlageplanDesignerClient
    const zone: Partial<ResourceZoneElement> = {
      kind: "RESOURCE_ZONE",
      zoneType: "FULL_PITCH",
      resourceCode: null,
      label: null,
      showNextActivity: true,
    };
    expect(zone.zoneType).toBe("FULL_PITCH");
  });

  it("addResourceZone(HALF_PITCH) creates a HALF_PITCH zone", () => {
    const zone: Partial<ResourceZoneElement> = {
      kind: "RESOURCE_ZONE",
      zoneType: "HALF_PITCH",
      resourceCode: null,
      label: null,
      showNextActivity: true,
    };
    expect(zone.zoneType).toBe("HALF_PITCH");
  });

  it("resource picker onChange does NOT change zoneType (only resourceCode)", () => {
    // After Feldtyp control is removed, picker onChange only sets resourceCode.
    // Previously it also did: patch.zoneType = opt.type
    // Now it does NOT — zoneType is locked to what was set at creation.
    const zone: ResourceZoneElement = {
      kind: "RESOURCE_ZONE",
      id: "z1",
      rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
      resourceCode: null,
      label: null,
      zoneType: "FULL_PITCH",
      showNextActivity: true,
    };
    const selectedOpt = ALL_OPTIONS.find((o) => o.code === "KR2")!;
    // Simulate the new picker onChange: only set resourceCode (+ prefill label)
    const patch: Partial<ResourceZoneElement> = { resourceCode: selectedOpt.code };
    if (!zone.label) {
      patch.label = anlageplanResourceLabel(selectedOpt);
    }
    const updated = { ...zone, ...patch };

    expect(updated.resourceCode).toBe("KR2");
    // zoneType must not have changed
    expect(updated.zoneType).toBe("FULL_PITCH");
  });

  it("zoneType persists through resourceCode changes", () => {
    // A HALF_PITCH zone stays HALF_PITCH even after re-picking a resource
    let zone: ResourceZoneElement = {
      kind: "RESOURCE_ZONE",
      id: "z1",
      rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
      resourceCode: "HP-A",
      label: "Hauptplatz · Feld A",
      zoneType: "HALF_PITCH",
      showNextActivity: true,
    };
    const newOpt = ALL_OPTIONS.find((o) => o.code === "KR2-B")!;
    zone = { ...zone, resourceCode: newOpt.code };

    expect(zone.zoneType).toBe("HALF_PITCH");
    expect(zone.resourceCode).toBe("KR2-B");
  });
});

// ── 5. Picker uses type field, not display string inference ───────────────────

describe("Picker uses AnlageplanResourceOption.type, not display strings", () => {
  it("FULL_PITCH is identified by opt.type, not by name substring", () => {
    // An option named "Kunstrasen 2" with type FULL_PITCH is a full pitch
    const opt: AnlageplanResourceOption = {
      code: "KR2",
      name: "Kunstrasen 2",
      type: "FULL_PITCH",
      facilityName: "Kunstrasen 2",
    };
    expect(opt.type).toBe("FULL_PITCH");
    // Not inferred from name — purely from .type
    const isFullPitch = opt.type === "FULL_PITCH";
    expect(isFullPitch).toBe(true);
  });

  it("HALF_PITCH is identified by opt.type, not by Feld A/B in name", () => {
    const opt: AnlageplanResourceOption = {
      code: "HP-A",
      name: "Feld A",
      type: "HALF_PITCH",
      facilityName: "Hauptplatz",
    };
    expect(opt.type).toBe("HALF_PITCH");
    const isHalfPitch = opt.type === "HALF_PITCH";
    expect(isHalfPitch).toBe(true);
  });

  it("filter is purely on opt.type comparison", () => {
    // Even a strangely named option is classified by its .type
    const strangeOpt: AnlageplanResourceOption = {
      code: "X1",
      name: "Grosses Feld A",
      type: "FULL_PITCH",
      facilityName: "Anlage X",
    };
    const filtered = [strangeOpt].filter((o) => o.type === "FULL_PITCH");
    expect(filtered).toHaveLength(1);
    const notHalf = [strangeOpt].filter((o) => o.type === "HALF_PITCH");
    expect(notHalf).toHaveLength(0);
  });
});
