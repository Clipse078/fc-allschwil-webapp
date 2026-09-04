/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/v2/__tests__/InboardRoutePreview.test.tsx
 *
 * INFOBOARD-OVERVIEW-01B — live route preview iframe scaling.
 */

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { InboardRoutePreview } from "../InboardRoutePreview";

describe("InboardRoutePreview", () => {
  let observeMock: Mock<(target: Element) => void>;
  let unobserveMock: Mock<(target: Element) => void>;
  let disconnectMock: Mock<() => void>;
  let intersectionCallback: IntersectionObserverCallback | null = null;

  let resizeObserveMock: Mock<(target: Element, options?: ResizeObserverOptions) => void>;
  let resizeUnobserveMock: Mock<(target: Element) => void>;
  let resizeDisconnectMock: Mock<() => void>;
  let resizeCallback: ResizeObserverCallback | null = null;

  beforeEach(() => {
    disconnectMock = vi.fn();
    unobserveMock = vi.fn();
    observeMock = vi.fn();

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe(target: Element): void {
        observeMock(target);
      }

      unobserve(target: Element): void {
        unobserveMock(target);
      }

      disconnect(): void {
        disconnectMock();
      }

      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }

    resizeDisconnectMock = vi.fn();
    resizeUnobserveMock = vi.fn();
    resizeObserveMock = vi.fn();

    class MockResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(target: Element, options?: ResizeObserverOptions): void {
        resizeObserveMock(target, options);
      }

      unobserve(target: Element): void {
        resizeUnobserveMock(target);
      }

      disconnect(): void {
        resizeDisconnectMock();
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    intersectionCallback = null;
    resizeCallback = null;
  });

  function loadIframe() {
    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
  }

  function resizeHost(width: number) {
    act(() => {
      resizeCallback?.(
        [{ contentRect: { width } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
  }

  it("renders a 16:9 host with placeholder before intersection", () => {
    render(<InboardRoutePreview route="/infoboard/screen-1" title="Screen 1" />);

    const host = screen.getByTestId("inboard-route-preview");
    expect(host).toBeTruthy();
    expect(host.style.aspectRatio).toBe("16 / 9");
    expect(screen.getByTestId("inboard-route-preview-placeholder")).toBeTruthy();
    expect(screen.queryByTestId("inboard-route-preview-iframe")).toBeNull();
    expect(observeMock).toHaveBeenCalledOnce();
    expect(resizeObserveMock).toHaveBeenCalledOnce();
  });

  it("lazy-loads the canonical route iframe when visible", () => {
    render(<InboardRoutePreview route="/infoboard/screen-2" title="Screen 2" />);

    loadIframe();

    const iframe = screen.getByTestId("inboard-route-preview-iframe");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toBe("/infoboard/screen-2");
    expect(iframe.getAttribute("title")).toBe("Screen 2");
    expect(iframe.className).toContain("pointer-events-none");
    expect(screen.queryByTestId("inboard-route-preview-placeholder")).toBeNull();
    expect(disconnectMock).toHaveBeenCalledOnce();
  });

  it("keeps the iframe at the canonical 1920×1080 logical size with top-left origin", () => {
    render(<InboardRoutePreview route="/infoboard/screen-1" title="Screen 1" />);

    loadIframe();

    const iframe = screen.getByTestId("inboard-route-preview-iframe");
    expect(iframe.style.width).toBe("1920px");
    expect(iframe.style.height).toBe("1080px");
    expect(iframe.style.transformOrigin).toBe("top left");
    expect(iframe.style.transform).toMatch(/^scale\(/);
  });

  it("applies uniform scaling from host width via ResizeObserver", () => {
    render(<InboardRoutePreview route="/infoboard/screen-1" title="Screen 1" />);

    loadIframe();
    resizeHost(480);

    const iframe = screen.getByTestId("inboard-route-preview-iframe");
    expect(iframe.style.transform).toBe("scale(0.25)");

    const host = screen.getByTestId("inboard-route-preview");
    expect(host.getAttribute("data-preview-scale")).toBe("0.2500");
  });

  it("recalculates scale when the preview host is resized", () => {
    render(<InboardRoutePreview route="/infoboard/screen-2" title="Screen 2" />);

    loadIframe();
    resizeHost(960);

    const iframe = screen.getByTestId("inboard-route-preview-iframe");
    expect(iframe.style.transform).toBe("scale(0.5)");

    resizeHost(640);
    expect(iframe.style.transform).toBe("scale(0.3333333333333333)");
  });
});
