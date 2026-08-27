/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";

afterEach(() => {
  cleanup();
});

describe("KioskViewportScaler", () => {
  it("wraps infoboard content in a logical 1920×1080 canvas", () => {
    render(
      <KioskViewportScaler>
        <div data-testid="child">Screen</div>
      </KioskViewportScaler>,
    );

    const canvas = screen.getByTestId("kiosk-viewport-canvas");
    expect(canvas).toBeTruthy();
    expect(canvas.style.width).toBe("1920px");
    expect(canvas.style.height).toBe("1080px");
    expect(canvas.style.transform).toMatch(/^scale\(/);
    expect(screen.getByTestId("child")).toBeTruthy();
  });
});
