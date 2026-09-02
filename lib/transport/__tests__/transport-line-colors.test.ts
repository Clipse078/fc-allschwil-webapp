/**
 * lib/transport/__tests__/transport-line-colors.test.ts
 */

import { describe, expect, it } from "vitest";
import { resolveTransportLineColor } from "@/lib/transport/transport-line-colors";

describe("resolveTransportLineColor", () => {
  it("returns the same color for the same line across repeated calls", () => {
    const first = resolveTransportLineColor("48");
    const second = resolveTransportLineColor("48");

    expect(first).toEqual(second);
  });

  it("is case-insensitive and whitespace-tolerant for deterministic matching", () => {
    const normalized = resolveTransportLineColor("48");
    const variant = resolveTransportLineColor(" 48 ");

    expect(variant).toEqual(normalized);
  });

  it("returns distinguishable colors for known local lines", () => {
    const line38 = resolveTransportLineColor("38");
    const line48 = resolveTransportLineColor("48");
    const line49 = resolveTransportLineColor("49");

    expect(line38.background).not.toBe(line48.background);
    expect(line38.background).not.toBe(line49.background);
    expect(line48.background).not.toBe(line49.background);
  });

  it("resolves unknown lines deterministically", () => {
    const first = resolveTransportLineColor("S17");
    const second = resolveTransportLineColor("S17");

    expect(first.background).toBeTruthy();
    expect(first).toEqual(second);
  });

  it("does not depend on call order for color stability", () => {
    resolveTransportLineColor("99");
    const before = resolveTransportLineColor("48");
    resolveTransportLineColor("11");
    const after = resolveTransportLineColor("48");

    expect(after).toEqual(before);
  });

  it("prefers a valid provider color when supplied", () => {
    const resolved = resolveTransportLineColor("48", "#123456");

    expect(resolved.background).toBe("#123456");
    expect(resolved.foreground).toBe("#FFFFFF");
  });

  it("uses white foreground for contrast on palette colors", () => {
    const resolved = resolveTransportLineColor("38");

    expect(resolved.foreground).toBe("#FFFFFF");
    expect(resolved.background.startsWith("#")).toBe(true);
  });
});
