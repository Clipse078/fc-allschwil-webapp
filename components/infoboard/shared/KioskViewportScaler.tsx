"use client";

/**
 * components/infoboard/shared/KioskViewportScaler.tsx
 *
 * Scales the fixed 1920×1080 infoboard design canvas to the visible kiosk
 * viewport. Used for Screen 1 and Screen 2 production routes and dashboard
 * previews (Preview Studio Screen-1/Screen-2 frames).
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  computeKioskViewportScale,
  isKioskViewportDiagnosticEnabled,
  KIOSK_LOGICAL_HEIGHT,
  KIOSK_LOGICAL_WIDTH,
  readViewportMetrics,
} from "@/lib/infoboard/kiosk-viewport";
import styles from "./KioskViewportScaler.module.css";

type KioskViewportScalerProps = {
  children: ReactNode;
};

export function KioskViewportScaler({ children }: KioskViewportScalerProps): ReactNode {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale(): void {
      setScale(computeKioskViewportScale(readViewportMetrics()));
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    window.visualViewport?.addEventListener("resize", updateScale);
    window.visualViewport?.addEventListener("scroll", updateScale);

    return () => {
      window.removeEventListener("resize", updateScale);
      window.visualViewport?.removeEventListener("resize", updateScale);
      window.visualViewport?.removeEventListener("scroll", updateScale);
    };
  }, []);

  useEffect(() => {
    if (!isKioskViewportDiagnosticEnabled(window.location.search)) return;
    const metrics = readViewportMetrics();
    console.info("[infoboard-kiosk-viewport]", {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualViewportWidth: window.visualViewport?.width ?? null,
      visualViewportHeight: window.visualViewport?.height ?? null,
      devicePixelRatio: metrics.devicePixelRatio,
      screenWidth: metrics.screenWidth,
      screenHeight: metrics.screenHeight,
      scale,
      logicalCanvas: `${KIOSK_LOGICAL_WIDTH}x${KIOSK_LOGICAL_HEIGHT}`,
    });
  }, [scale]);

  return (
    <div
      className={styles.kioskViewportHost}
      data-testid="kiosk-viewport-scaler"
      data-kiosk-scale={scale.toFixed(4)}
    >
      <div
        className={styles.kioskViewportCanvas}
        data-kiosk-viewport-canvas="true"
        data-testid="kiosk-viewport-canvas"
        style={{
          width: KIOSK_LOGICAL_WIDTH,
          height: KIOSK_LOGICAL_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
