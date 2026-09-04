/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-04 — reduced-motion hook tests
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

describe("useReducedMotion", () => {
  let listeners: Array<() => void> = [];
  let matches = false;

  beforeEach(() => {
    listeners = [];
    matches = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        get matches() {
          return matches;
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => {
          listeners.push(cb);
        },
        removeEventListener: (_: string, cb: () => void) => {
          listeners = listeners.filter((l) => l !== cb);
        },
      })),
    );
  });

  it("returns false when reduced motion is not preferred", () => {
    matches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when reduced motion is preferred", () => {
    matches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("updates when preference changes", () => {
    matches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      listeners.forEach((cb) => cb());
    });
    expect(result.current).toBe(true);
  });
});
