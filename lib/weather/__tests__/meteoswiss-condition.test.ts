/**
 * lib/weather/__tests__/meteoswiss-condition.test.ts
 *
 * Unit tests for the MeteoSwiss derived-condition mapping.
 *
 * MeteoSwiss VQHA80 does not include an official weather-condition code.
 * Condition is conservatively derived from measured precipitation (rre150z0)
 * and sunshine duration (sre000z0). See deriveCondition() for the derivation
 * rules and limitations.
 *
 * Covers:
 *   B1.  Precipitation > 0.1 mm → "Regen" (code 61)
 *   B2.  Sunshine >= 8.0 min → "Sonnig" (code 0)
 *   B3.  Sunshine >= 2.0 min (< 8.0) → "Heiter" (code 2)
 *   B4.  No precipitation, no sunshine → "Aktuelle Messwerte" (code 3)
 *   B5.  Boundary: precip exactly 0.1 → neutral (not rain)
 *   B6.  Boundary: sun exactly 8.0 → "Sonnig"
 *   B7.  Boundary: sun exactly 2.0 → "Heiter"
 *   B8.  All German labels are present
 *   B9.  Synthetic codes are WMO-like integers for icon selection
 *  B10.  Rain takes priority over sunshine (simultaneous)
 */

import { describe, it, expect } from "vitest";
import { deriveCondition } from "../providers/meteoswiss-weather-provider";

describe("deriveCondition — precipitation detection", () => {
  it("B1. precip > 0.1 mm → label 'Regen'", () => {
    const r = deriveCondition(0.2, 0);
    expect(r.label).toBe("Regen");
  });

  it("B1. precip = 1.0 mm → label 'Regen'", () => {
    const r = deriveCondition(1.0, 0);
    expect(r.label).toBe("Regen");
  });

  it("B1. 'Regen' has synthetic code 61 (WMO light rain analogue)", () => {
    const r = deriveCondition(0.5, 0);
    expect(r.syntheticCode).toBe(61);
  });

  it("B5. precip = 0.1 mm (boundary) → NOT 'Regen'", () => {
    const r = deriveCondition(0.1, 0);
    expect(r.label).not.toBe("Regen");
  });

  it("B5. precip = 0.0 mm → NOT 'Regen'", () => {
    const r = deriveCondition(0.0, 0);
    expect(r.label).not.toBe("Regen");
  });
});

describe("deriveCondition — sunshine detection", () => {
  it("B2. sunshine >= 8.0 min → label 'Sonnig'", () => {
    const r = deriveCondition(0, 8.0);
    expect(r.label).toBe("Sonnig");
  });

  it("B2. sunshine = 10 min (full window) → 'Sonnig'", () => {
    const r = deriveCondition(0, 10);
    expect(r.label).toBe("Sonnig");
  });

  it("B2. 'Sonnig' has synthetic code 0 (WMO clear sky analogue)", () => {
    const r = deriveCondition(0, 9);
    expect(r.syntheticCode).toBe(0);
  });

  it("B3. sunshine >= 2.0 and < 8.0 → label 'Heiter'", () => {
    const r = deriveCondition(0, 4.0);
    expect(r.label).toBe("Heiter");
  });

  it("B3. sunshine = 2.0 (boundary) → 'Heiter'", () => {
    const r = deriveCondition(0, 2.0);
    expect(r.label).toBe("Heiter");
  });

  it("B3. 'Heiter' has synthetic code 2 (WMO partly cloudy analogue)", () => {
    const r = deriveCondition(0, 3);
    expect(r.syntheticCode).toBe(2);
  });

  it("B6. sunshine = 8.0 → 'Sonnig' (not 'Heiter')", () => {
    const r = deriveCondition(0, 8.0);
    expect(r.label).toBe("Sonnig");
  });

  it("B7. sunshine = 7.9 → 'Heiter' (not 'Sonnig')", () => {
    const r = deriveCondition(0, 7.9);
    expect(r.label).toBe("Heiter");
  });
});

describe("deriveCondition — neutral fallback", () => {
  it("B4. no precip, no sunshine → 'Aktuelle Messwerte'", () => {
    const r = deriveCondition(0, 0);
    expect(r.label).toBe("Aktuelle Messwerte");
  });

  it("B4. sunshine < 2.0 and no precip → 'Aktuelle Messwerte'", () => {
    const r = deriveCondition(0, 1.9);
    expect(r.label).toBe("Aktuelle Messwerte");
  });

  it("B4. 'Aktuelle Messwerte' has synthetic code 3", () => {
    const r = deriveCondition(0, 0);
    expect(r.syntheticCode).toBe(3);
  });
});

describe("deriveCondition — priority rules", () => {
  it("B10. precipitation takes priority over sunshine", () => {
    // Simultaneous rain and sunshine (unusual but possible)
    const r = deriveCondition(0.5, 8.0);
    expect(r.label).toBe("Regen");
  });

  it("B10. precipitation takes priority over high sunshine", () => {
    const r = deriveCondition(1.0, 10.0);
    expect(r.label).toBe("Regen");
  });
});

describe("deriveCondition — German labels", () => {
  it("B8. 'Regen' is German for rain", () => {
    expect(deriveCondition(0.5, 0).label).toBe("Regen");
  });

  it("B8. 'Sonnig' is German for sunny", () => {
    expect(deriveCondition(0, 9).label).toBe("Sonnig");
  });

  it("B8. 'Heiter' is German for partly sunny", () => {
    expect(deriveCondition(0, 3).label).toBe("Heiter");
  });

  it("B8. 'Aktuelle Messwerte' is the neutral German label", () => {
    expect(deriveCondition(0, 0).label).toBe("Aktuelle Messwerte");
  });
});

describe("deriveCondition — synthetic codes for icon selection", () => {
  it("B9. all synthetic codes are integers", () => {
    const conditions = [
      deriveCondition(0.5, 0),   // Regen
      deriveCondition(0, 9),      // Sonnig
      deriveCondition(0, 3),      // Heiter
      deriveCondition(0, 0),      // Aktuelle Messwerte
    ];
    for (const c of conditions) {
      expect(Number.isInteger(c.syntheticCode)).toBe(true);
    }
  });
});
