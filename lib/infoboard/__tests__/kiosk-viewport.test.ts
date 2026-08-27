/**
 * @vitest-environment node
 *
 * INFOBOARD-KIOSK-VIEWPORT-01B — logical canvas scale helpers.
 */

import { describe, expect, it } from "vitest";
import {
  computeKioskViewportScale,
  KIOSK_LOGICAL_HEIGHT,
  KIOSK_LOGICAL_WIDTH,
} from "@/lib/infoboard/kiosk-viewport";

describe("kiosk viewport scale helpers", () => {
  it("returns 1 for the design target viewport", () => {
    expect(
      computeKioskViewportScale({
        width: KIOSK_LOGICAL_WIDTH,
        height: KIOSK_LOGICAL_HEIGHT,
      }),
    ).toBe(1);
  });

  it("uses the tighter axis when height is reduced (Fire TV chrome)", () => {
    expect(
      computeKioskViewportScale({
        width: KIOSK_LOGICAL_WIDTH,
        height: 972,
      }),
    ).toBeCloseTo(972 / KIOSK_LOGICAL_HEIGHT, 5);
  });

  it("uses width when the viewport is narrower than 16:9", () => {
    expect(
      computeKioskViewportScale({
        width: 960,
        height: KIOSK_LOGICAL_HEIGHT,
      }),
    ).toBeCloseTo(0.5, 5);
  });

  it("guards invalid metrics", () => {
    expect(computeKioskViewportScale({ width: 0, height: 1080 })).toBe(1);
    expect(computeKioskViewportScale({ width: 1920, height: -1 })).toBe(1);
  });
});
