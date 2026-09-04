import { describe, it, expect } from "vitest";
import {
  clampSidebarWidth,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_DEFAULT,
} from "@/lib/shell/sidebar-width";

describe("sidebar-width", () => {
  it("clamps width within min and max bounds", () => {
    expect(clampSidebarWidth(100)).toBe(SIDEBAR_WIDTH_MIN);
    expect(clampSidebarWidth(500)).toBe(SIDEBAR_WIDTH_MAX);
    expect(clampSidebarWidth(240)).toBe(240);
  });

  it("defaults to the canonical sidebar width", () => {
    expect(SIDEBAR_WIDTH_DEFAULT).toBe(224);
  });
});
