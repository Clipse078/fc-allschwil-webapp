/**
 * lib/infoboard/__tests__/anlageplan-picker.test.ts
 *
 * INFOBOARD-MAP-01B — Focused tests for:
 *   1. Canonical resource picker (AnlageplanResourceOption)
 *   2. Editable display label (Anzeigebezeichnung)
 *   3. Shared marker icon mapping (MARKER_ICONS)
 */

import { describe, it, expect } from "vitest";
import {
  anlageplanResourceLabel,
  MARKER_ICONS,
  MARKER_LABELS,
  parseAnlageplanJson,
  isResourceZone,
  type AnlageplanResourceOption,
  type ResourceZoneElement,
  type MarkerType,
} from "../anlageplan-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOpt(overrides: Partial<AnlageplanResourceOption> = {}): AnlageplanResourceOption {
  return {
    code: "KR2",
    name: "Kunstrasen 2",
    type: "FULL_PITCH",
    facilityName: "Kunstrasen 2",
    ...overrides,
  };
}

// ── 1. Resource picker label formatting ───────────────────────────────────────

describe("anlageplanResourceLabel", () => {
  it("shows only resource name when it equals facility name (FULL_PITCH)", () => {
    const opt = makeOpt({ name: "Kunstrasen 2", facilityName: "Kunstrasen 2" });
    expect(anlageplanResourceLabel(opt)).toBe("Kunstrasen 2");
  });

  it("shows facilityName · resourceName when they differ (HALF_PITCH Feld A)", () => {
    const opt = makeOpt({
      code: "KR2-A",
      name: "Feld A",
      type: "HALF_PITCH",
      facilityName: "Kunstrasen 2",
    });
    expect(anlageplanResourceLabel(opt)).toBe("Kunstrasen 2 · Feld A");
  });

  it("shows facilityName · resourceName for Feld B", () => {
    const opt = makeOpt({
      code: "KR2-B",
      name: "Feld B",
      type: "HALF_PITCH",
      facilityName: "Kunstrasen 2",
    });
    expect(anlageplanResourceLabel(opt)).toBe("Kunstrasen 2 · Feld B");
  });

  it("Feld A and Feld B have distinct labels", () => {
    const feldA = makeOpt({ code: "KR2-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Kunstrasen 2" });
    const feldB = makeOpt({ code: "KR2-B", name: "Feld B", type: "HALF_PITCH", facilityName: "Kunstrasen 2" });
    expect(anlageplanResourceLabel(feldA)).not.toBe(anlageplanResourceLabel(feldB));
  });

  it("whole pitch and Feld A have distinct labels", () => {
    const whole = makeOpt({ code: "KR2", name: "Kunstrasen 2", type: "FULL_PITCH", facilityName: "Kunstrasen 2" });
    const fieldA = makeOpt({ code: "KR2-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Kunstrasen 2" });
    expect(anlageplanResourceLabel(whole)).not.toBe(anlageplanResourceLabel(fieldA));
  });

  it("different facilities produce distinct labels", () => {
    const kr2 = makeOpt({ code: "KR2", name: "Kunstrasen 2", type: "FULL_PITCH", facilityName: "Kunstrasen 2" });
    const kr3 = makeOpt({ code: "KR3", name: "Kunstrasen 3", type: "FULL_PITCH", facilityName: "Kunstrasen 3" });
    expect(anlageplanResourceLabel(kr2)).not.toBe(anlageplanResourceLabel(kr3));
  });
});

// ── 2. Display label (Anzeigebezeichnung) vs canonical resource linkage ────────

describe("Display label independence from resource code", () => {
  it("zone label can differ from resource code — they are independent", () => {
    const config = parseAnlageplanJson(
      JSON.stringify({
        version: 1,
        elements: [
          {
            kind: "RESOURCE_ZONE",
            id: "z1",
            rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
            resourceCode: "KR2-A",
            label: "KR2 · FELD A",
            zoneType: "HALF_PITCH",
            showNextActivity: true,
          },
        ],
      }),
    );
    expect(config).not.toBeNull();
    const zone = config!.elements[0] as ResourceZoneElement;
    // Canonical linkage via code
    expect(zone.resourceCode).toBe("KR2-A");
    // Map display label is independent
    expect(zone.label).toBe("KR2 · FELD A");
    // Changing label does NOT change code
    const updated: ResourceZoneElement = { ...zone, label: "Mein eigenes Label" };
    expect(updated.resourceCode).toBe("KR2-A");
    expect(updated.label).toBe("Mein eigenes Label");
  });

  it("null label falls back to resourceCode in rendering (not in storage)", () => {
    const config = parseAnlageplanJson(
      JSON.stringify({
        version: 1,
        elements: [
          {
            kind: "RESOURCE_ZONE",
            id: "z1",
            rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
            resourceCode: "KR3",
            label: null,
            zoneType: "FULL_PITCH",
            showNextActivity: true,
          },
        ],
      }),
    );
    expect(config).not.toBeNull();
    const zone = config!.elements[0] as ResourceZoneElement;
    expect(zone.label).toBeNull();
    expect(zone.resourceCode).toBe("KR3");
    // Render fallback: label ?? resourceCode ?? "Zone" === "KR3"
    const displayValue = zone.label ?? zone.resourceCode ?? "Zone";
    expect(displayValue).toBe("KR3");
  });

  it("live activity mapping always uses resourceCode, not label", () => {
    // Simulates pitchMap.get(zone.resourceCode) lookup in InfoboardAnlageplan
    const zone: ResourceZoneElement = {
      kind: "RESOURCE_ZONE",
      id: "z1",
      rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
      resourceCode: "KR2-A",
      label: "Completely different display label",
      zoneType: "HALF_PITCH",
      showNextActivity: true,
    };
    const pitchMap = new Map([
      ["KR2-A", { code: "KR2-A", state: "OCCUPIED_NOW" }],
    ]);
    // Lookup is by resourceCode, never by label
    const occupancy = zone.resourceCode ? pitchMap.get(zone.resourceCode) : null;
    expect(occupancy).toBeDefined();
    expect(occupancy?.code).toBe("KR2-A");
  });

  it("prefill: selected opt label is used as initial Anzeigebezeichnung", () => {
    // Simulates the picker onChange logic in AnlageplanDesignerClient
    const opt = makeOpt({ code: "KR2-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Kunstrasen 2" });
    const prefillLabel = anlageplanResourceLabel(opt);
    // Zone starts with no label
    let zone: ResourceZoneElement = {
      kind: "RESOURCE_ZONE",
      id: "z1",
      rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
      resourceCode: null,
      label: null,
      zoneType: "FULL_PITCH",
      showNextActivity: true,
    };
    // Simulates: if (!selectedElement.label) patch.label = anlageplanResourceLabel(opt)
    if (!zone.label) {
      zone = { ...zone, resourceCode: opt.code, label: prefillLabel, zoneType: opt.type };
    }
    expect(zone.resourceCode).toBe("KR2-A");
    expect(zone.label).toBe("Kunstrasen 2 · Feld A");
    expect(zone.zoneType).toBe("HALF_PITCH");
  });

  it("prefill does not overwrite existing label", () => {
    // If label is already set, picker change should not overwrite it
    const opt = makeOpt({ code: "KR3", name: "Kunstrasen 3", type: "FULL_PITCH", facilityName: "Kunstrasen 3" });
    let zone: ResourceZoneElement = {
      kind: "RESOURCE_ZONE",
      id: "z1",
      rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
      resourceCode: "KR2",
      label: "KR2 custom",
      zoneType: "FULL_PITCH",
      showNextActivity: true,
    };
    // Simulates: if (!selectedElement.label) ... — label is already set, so skip prefill
    const patch: Partial<ResourceZoneElement> = { resourceCode: opt.code };
    if (!zone.label) {
      patch.label = anlageplanResourceLabel(opt);
    }
    zone = { ...zone, ...patch };
    expect(zone.resourceCode).toBe("KR3");
    // label unchanged
    expect(zone.label).toBe("KR2 custom");
  });
});

// ── 3. Cross-tenant resource code rejection (logic layer) ─────────────────────

describe("Cross-tenant resource rejection logic", () => {
  it("resourceCode not in tenant map is detected as invalid", () => {
    // Simulates the server-side validation in PATCH /api/infoboards/[id]
    const submittedCodes = ["KR2-A", "FOREIGN_CODE"];
    const validMap = new Map([["KR2-A", { name: "Feld A", type: "HALF_PITCH" }]]);
    const invalidCodes = submittedCodes.filter((c) => !validMap.has(c));
    expect(invalidCodes).toEqual(["FOREIGN_CODE"]);
  });

  it("all valid codes pass validation", () => {
    const submittedCodes = ["KR1", "KR2-A"];
    const validMap = new Map([
      ["KR1", { name: "Kunstrasen 1", type: "FULL_PITCH" }],
      ["KR2-A", { name: "Feld A", type: "HALF_PITCH" }],
    ]);
    const invalidCodes = submittedCodes.filter((c) => !validMap.has(c));
    expect(invalidCodes).toHaveLength(0);
  });

  it("null resourceCode zones are skipped in validation", () => {
    const config = parseAnlageplanJson(
      JSON.stringify({
        version: 1,
        elements: [
          {
            kind: "RESOURCE_ZONE",
            id: "z1",
            rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
            resourceCode: null,
            label: null,
            zoneType: "FULL_PITCH",
            showNextActivity: true,
          },
        ],
      }),
    );
    const codes = config!.elements
      .filter(isResourceZone)
      .map((z) => z.resourceCode)
      .filter((c): c is string => typeof c === "string" && c.length > 0);
    expect(codes).toHaveLength(0);
  });
});

// ── 4. Marker icon canonical map ──────────────────────────────────────────────

describe("MARKER_ICONS canonical map", () => {
  const ALL_TYPES: MarkerType[] = [
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

  it("every marker type has an icon defined", () => {
    for (const t of ALL_TYPES) {
      expect(MARKER_ICONS[t]).toBeTruthy();
    }
  });

  it("every marker type has a label defined", () => {
    for (const t of ALL_TYPES) {
      expect(MARKER_LABELS[t]).toBeTruthy();
    }
  });

  it("DU_BIST_HIER has a pin icon", () => {
    expect(MARKER_ICONS.DU_BIST_HIER).toBe("📍");
  });

  it("MARKER_ICONS and MARKER_LABELS have the same keys", () => {
    const iconKeys = Object.keys(MARKER_ICONS).sort();
    const labelKeys = Object.keys(MARKER_LABELS).sort();
    expect(iconKeys).toEqual(labelKeys);
  });

  it("no two marker types share the same icon string", () => {
    const icons = Object.values(MARKER_ICONS);
    const uniqueIcons = new Set(icons);
    expect(uniqueIcons.size).toBe(icons.length);
  });

  it("palette types all resolve through canonical MARKER_ICONS", () => {
    // Simulates MARKER_PALETTE.map(({type}) => MARKER_ICONS[type])
    const paletteTypes: MarkerType[] = ALL_TYPES;
    for (const t of paletteTypes) {
      expect(MARKER_ICONS[t]).not.toBeUndefined();
    }
  });
});

// ── 5. Tenant resources populate picker ──────────────────────────────────────

describe("AnlageplanResourceOption tenant filtering", () => {
  it("only FULL_PITCH and HALF_PITCH resources are included in options", () => {
    // Simulates the flatMap in InboardDetailPage
    type FakeResource = { code: string; name: string; type: string };
    const fakeResources: FakeResource[] = [
      { code: "KR1", name: "Kunstrasen 1", type: "FULL_PITCH" },
      { code: "KR1-A", name: "Feld A", type: "HALF_PITCH" },
      { code: "DR1", name: "Garderobe 1", type: "DRESSING_ROOM" },
      { code: "OTHER", name: "Sonstiges", type: "OTHER" },
    ];
    const filtered = fakeResources.filter(
      (r): r is FakeResource & { type: "FULL_PITCH" | "HALF_PITCH" } =>
        r.type === "FULL_PITCH" || r.type === "HALF_PITCH",
    );
    const options: AnlageplanResourceOption[] = filtered.map((r) => ({
      code: r.code,
      name: r.name,
      type: r.type as "FULL_PITCH" | "HALF_PITCH",
      facilityName: "Kunstrasen 1",
    }));

    expect(options).toHaveLength(2);
    expect(options.map((o) => o.code)).toEqual(["KR1", "KR1-A"]);
    expect(options.find((o) => o.code === "DR1")).toBeUndefined();
  });

  it("options preserve Feld A and Feld B as distinct entries", () => {
    const options: AnlageplanResourceOption[] = [
      { code: "KR2", name: "Kunstrasen 2", type: "FULL_PITCH", facilityName: "Kunstrasen 2" },
      { code: "KR2-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Kunstrasen 2" },
      { code: "KR2-B", name: "Feld B", type: "HALF_PITCH", facilityName: "Kunstrasen 2" },
    ];
    const labels = options.map(anlageplanResourceLabel);
    expect(labels).toEqual(["Kunstrasen 2", "Kunstrasen 2 · Feld A", "Kunstrasen 2 · Feld B"]);
    // All codes distinct
    const codes = options.map((o) => o.code);
    expect(new Set(codes).size).toBe(3);
  });

  it("whole-pitch option is distinct from Feld A option", () => {
    const whole: AnlageplanResourceOption = { code: "KR2", name: "Kunstrasen 2", type: "FULL_PITCH", facilityName: "Kunstrasen 2" };
    const fieldA: AnlageplanResourceOption = { code: "KR2-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Kunstrasen 2" };
    expect(whole.code).not.toBe(fieldA.code);
    expect(whole.type).toBe("FULL_PITCH");
    expect(fieldA.type).toBe("HALF_PITCH");
  });

  it("selected option resolves canonical code for activity mapping", () => {
    const options: AnlageplanResourceOption[] = [
      { code: "KR2-A", name: "Feld A", type: "HALF_PITCH", facilityName: "Kunstrasen 2" },
    ];
    const selected = options.find((o) => o.code === "KR2-A");
    expect(selected).toBeDefined();
    // The code stored on the zone is the canonical FacilityResource.code
    const resourceCode = selected!.code;
    expect(resourceCode).toBe("KR2-A");
    // Activity mapping lookup would find it
    const pitchMap = new Map([["KR2-A", { state: "OCCUPIED_NOW" }]]);
    expect(pitchMap.get(resourceCode)).toBeDefined();
  });
});
