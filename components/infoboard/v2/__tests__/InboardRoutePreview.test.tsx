/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/v2/__tests__/InboardRoutePreview.test.tsx
 *
 * INFOBOARD-OVERVIEW-01 — live route preview iframe component.
 */

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InboardRoutePreview } from "../InboardRoutePreview";

describe("InboardRoutePreview", () => {
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;
  let intersectionCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    disconnectMock = vi.fn();
    observeMock = vi.fn();

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe = observeMock;
      unobserve = vi.fn();
      disconnect = disconnectMock;
      takeRecords = vi.fn().mockReturnValue([]);
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    intersectionCallback = null;
  });

  it("renders a 16:9 host with placeholder before intersection", () => {
    render(<InboardRoutePreview route="/infoboard/screen-1" title="Screen 1" />);

    const host = screen.getByTestId("inboard-route-preview");
    expect(host).toBeTruthy();
    expect(host.style.aspectRatio).toBe("16 / 9");
    expect(screen.getByTestId("inboard-route-preview-placeholder")).toBeTruthy();
    expect(screen.queryByTestId("inboard-route-preview-iframe")).toBeNull();
    expect(observeMock).toHaveBeenCalledOnce();
  });

  it("lazy-loads the canonical route iframe when visible", () => {
    render(<InboardRoutePreview route="/infoboard/screen-2" title="Screen 2" />);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    const iframe = screen.getByTestId("inboard-route-preview-iframe");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toBe("/infoboard/screen-2");
    expect(iframe.getAttribute("title")).toBe("Screen 2");
    expect(iframe.className).toContain("pointer-events-none");
    expect(screen.queryByTestId("inboard-route-preview-placeholder")).toBeNull();
    expect(disconnectMock).toHaveBeenCalledOnce();
  });

  it("scales the iframe from the canonical 1920 logical width", () => {
    render(<InboardRoutePreview route="/infoboard/screen-1" title="Screen 1" />);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    const iframe = screen.getByTestId("inboard-route-preview-iframe");
    expect(iframe.style.width).toBe("1920px");
    expect(iframe.style.height).toBe("1080px");
    expect(iframe.style.transform).toBe("scale(calc(100cqi / 1920))");
  });
});
