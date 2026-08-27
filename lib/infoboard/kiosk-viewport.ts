/**
 * lib/infoboard/kiosk-viewport.ts
 *
 * Logical 16:9 kiosk canvas sizing for physical infoboard routes.
 * Preview Studio and production kiosks share the same 1920×1080 design
 * surface; this helper scales that canvas to the actually visible viewport.
 */

export const KIOSK_LOGICAL_WIDTH = 1920;
export const KIOSK_LOGICAL_HEIGHT = 1080;

export type ViewportMetrics = {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
};

export function computeKioskViewportScale(metrics: Pick<ViewportMetrics, "width" | "height">): number {
  if (metrics.width <= 0 || metrics.height <= 0) return 1;
  return Math.min(
    metrics.width / KIOSK_LOGICAL_WIDTH,
    metrics.height / KIOSK_LOGICAL_HEIGHT,
  );
}

export function readViewportMetrics(): ViewportMetrics {
  if (typeof window === "undefined") {
    return {
      width: KIOSK_LOGICAL_WIDTH,
      height: KIOSK_LOGICAL_HEIGHT,
      devicePixelRatio: 1,
      screenWidth: KIOSK_LOGICAL_WIDTH,
      screenHeight: KIOSK_LOGICAL_HEIGHT,
    };
  }

  const visualViewport = window.visualViewport;
  return {
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

export function isKioskViewportDiagnosticEnabled(search: string): boolean {
  return new URLSearchParams(search).get("kioskDiag") === "1";
}
