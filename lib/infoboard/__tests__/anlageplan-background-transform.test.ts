/**
 * lib/infoboard/__tests__/anlageplan-background-transform.test.ts
 *
 * INFOBOARD-MAP-01C — Focused tests for:
 *   1. BackgroundTransform round-trip persistence
 *   2. Default values and reset
 *   3. resolveBackgroundTransform safe defaults
 *   4. emptyAnlageplanConfig includes backgroundTransform
 *   5. parseAnlageplanJson handles missing / partial backgroundTransform
 */

import { describe, it, expect } from "vitest";
import {
  defaultBackgroundTransform,
  resolveBackgroundTransform,
  emptyAnlageplanConfig,
  parseAnlageplanJson,
  type BackgroundTransform,
  type AnlageplanConfig,
} from "../anlageplan-types";

// ── 1. Default values ──────────────────────────────────────────────────────

describe("defaultBackgroundTransform", () => {
  it("returns scale 1, offsetX 0, offsetY 0", () => {
    const t = defaultBackgroundTransform();
    expect(t.scale).toBe(1);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBe(0);
  });

  it("returns a new object each call (no shared reference)", () => {
    const a = defaultBackgroundTransform();
    const b = defaultBackgroundTransform();
    expect(a).not.toBe(b);
    a.scale = 999;
    expect(b.scale).toBe(1);
  });
});

// ── 2. emptyAnlageplanConfig ───────────────────────────────────────────────

describe("emptyAnlageplanConfig", () => {
  it("includes a backgroundTransform with defaults", () => {
    const cfg = emptyAnlageplanConfig();
    expect(cfg.backgroundTransform).toBeDefined();
    expect(cfg.backgroundTransform?.scale).toBe(1);
    expect(cfg.backgroundTransform?.offsetX).toBe(0);
    expect(cfg.backgroundTransform?.offsetY).toBe(0);
  });
});

// ── 3. resolveBackgroundTransform ─────────────────────────────────────────

describe("resolveBackgroundTransform", () => {
  it("returns default when backgroundTransform is absent", () => {
    const cfg: AnlageplanConfig = { version: 1, elements: [] };
    const t = resolveBackgroundTransform(cfg);
    expect(t).toEqual(defaultBackgroundTransform());
  });

  it("returns stored values when present and valid", () => {
    const cfg: AnlageplanConfig = {
      version: 1,
      elements: [],
      backgroundTransform: { scale: 1.5, offsetX: 0.1, offsetY: -0.2 },
    };
    const t = resolveBackgroundTransform(cfg);
    expect(t.scale).toBe(1.5);
    expect(t.offsetX).toBeCloseTo(0.1);
    expect(t.offsetY).toBeCloseTo(-0.2);
  });

  it("resets invalid scale (0) to 1", () => {
    const cfg: AnlageplanConfig = {
      version: 1,
      elements: [],
      backgroundTransform: { scale: 0, offsetX: 0, offsetY: 0 },
    };
    const t = resolveBackgroundTransform(cfg);
    expect(t.scale).toBe(1);
  });

  it("resets negative scale to 1", () => {
    const cfg: AnlageplanConfig = {
      version: 1,
      elements: [],
      backgroundTransform: { scale: -2, offsetX: 0, offsetY: 0 },
    };
    const t = resolveBackgroundTransform(cfg);
    expect(t.scale).toBe(1);
  });

  it("treats non-number scale as invalid → defaults to 1", () => {
    const cfg: AnlageplanConfig = {
      version: 1,
      elements: [],
      backgroundTransform: { scale: NaN, offsetX: 0, offsetY: 0 },
    };
    const t = resolveBackgroundTransform(cfg);
    expect(t.scale).toBe(1);
  });
});

// ── 4. Round-trip persistence ──────────────────────────────────────────────

describe("BackgroundTransform round-trip via JSON", () => {
  it("persists scale / offsetX / offsetY through JSON serialise → parse", () => {
    const transform: BackgroundTransform = { scale: 1.8, offsetX: 0.15, offsetY: -0.1 };
    const config: AnlageplanConfig = {
      version: 1,
      elements: [],
      backgroundTransform: transform,
    };
    const json = JSON.stringify(config);
    const parsed = parseAnlageplanJson(json);

    expect(parsed).not.toBeNull();
    expect(parsed!.backgroundTransform).toBeDefined();
    expect(parsed!.backgroundTransform!.scale).toBeCloseTo(1.8);
    expect(parsed!.backgroundTransform!.offsetX).toBeCloseTo(0.15);
    expect(parsed!.backgroundTransform!.offsetY).toBeCloseTo(-0.1);
  });

  it("round-trips default transform (scale=1, offset=0)", () => {
    const config = emptyAnlageplanConfig();
    const json = JSON.stringify(config);
    const parsed = parseAnlageplanJson(json);

    expect(parsed).not.toBeNull();
    const t = resolveBackgroundTransform(parsed!);
    expect(t).toEqual(defaultBackgroundTransform());
  });

  it("handles legacy config without backgroundTransform (resolves to defaults)", () => {
    const legacyJson = JSON.stringify({ version: 1, elements: [] });
    const parsed = parseAnlageplanJson(legacyJson);

    expect(parsed).not.toBeNull();
    // backgroundTransform may be absent in older configs
    const t = resolveBackgroundTransform(parsed!);
    expect(t).toEqual(defaultBackgroundTransform());
  });

  it("designer/kiosk share the same resolved transform", () => {
    // Simulate: designer saves config with a non-default transform.
    // Kiosk reads back the same JSON and resolves the same transform.
    const designerTransform: BackgroundTransform = { scale: 2.2, offsetX: -0.3, offsetY: 0.05 };
    const savedConfig: AnlageplanConfig = {
      version: 1,
      elements: [],
      backgroundTransform: designerTransform,
    };
    const savedJson = JSON.stringify(savedConfig);

    // Kiosk parses and resolves
    const kioskConfig = parseAnlageplanJson(savedJson);
    expect(kioskConfig).not.toBeNull();
    const kioskTransform = resolveBackgroundTransform(kioskConfig!);

    expect(kioskTransform.scale).toBeCloseTo(designerTransform.scale);
    expect(kioskTransform.offsetX).toBeCloseTo(designerTransform.offsetX);
    expect(kioskTransform.offsetY).toBeCloseTo(designerTransform.offsetY);
  });

  it("reset: after reset, resolves to defaults", () => {
    // Simulates clicking Reset in the designer
    const nonDefault: BackgroundTransform = { scale: 3, offsetX: 0.5, offsetY: 0.5 };
    const reset = defaultBackgroundTransform();

    // Reset replaces the transform with the default
    const afterReset: AnlageplanConfig = {
      version: 1,
      elements: [],
      backgroundTransform: reset,
    };
    const json = JSON.stringify(afterReset);
    const parsed = parseAnlageplanJson(json);
    const t = resolveBackgroundTransform(parsed!);

    expect(t).toEqual(defaultBackgroundTransform());
    expect(nonDefault.scale).not.toBe(t.scale); // sanity: was non-default
  });
});

// ── 5. Zoom in / out boundaries ───────────────────────────────────────────

describe("BackgroundTransform zoom boundaries", () => {
  it("scale 5 is within valid range", () => {
    const t = resolveBackgroundTransform({
      version: 1,
      elements: [],
      backgroundTransform: { scale: 5, offsetX: 0, offsetY: 0 },
    });
    expect(t.scale).toBe(5);
  });

  it("scale 0.2 is within valid range", () => {
    const t = resolveBackgroundTransform({
      version: 1,
      elements: [],
      backgroundTransform: { scale: 0.2, offsetX: 0, offsetY: 0 },
    });
    expect(t.scale).toBe(0.2);
  });
});
