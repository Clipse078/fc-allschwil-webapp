/**
 * components/infoboard/screen2/Screen2CenterRotator.tsx
 *
 * INFOBOARD-TRANSPORT-02 — center-only rotator for Screen 2.
 *
 * Slides:
 *   1. Anlageplan (children)
 *   2. Transport departures
 *
 * Sponsor rails, header and footer remain outside this component.
 */
"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { useKioskTransport } from "@/components/infoboard/kiosk-transport";
import { Screen2TransportSlide } from "@/components/infoboard/screen2/Screen2TransportSlide";
import type { TransportResult } from "@/lib/transport/transport-types";
import styles from "./Screen2CenterRotator.module.css";

export type Screen2CenterRotatorProps = {
  children: ReactNode;
  tenantKey: string;
  timezone: string;
  initialTransport: TransportResult | null;
  refreshIntervalSeconds: number;
  anlageplanDurationMs?: number;
  transportDurationMs?: number;
  live?: boolean;
  /** Preview-only controlled slide index. */
  activeSlide?: "anlageplan" | "transport";
  autoRotate?: boolean;
};

type SlideId = "anlageplan" | "transport";

const SLIDE_SEQUENCE: SlideId[] = ["anlageplan", "transport"];

export function Screen2CenterRotator({
  children,
  tenantKey,
  timezone,
  initialTransport,
  refreshIntervalSeconds,
  anlageplanDurationMs = 20_000,
  transportDurationMs = 20_000,
  live = true,
  activeSlide,
  autoRotate = true,
}: Screen2CenterRotatorProps): ReactElement {
  const [slideIndex, setSlideIndex] = useState(0);
  const transport = useKioskTransport(
    initialTransport,
    refreshIntervalSeconds,
    tenantKey,
    live,
  );

  const controlled = activeSlide !== undefined;
  const visibleSlide = controlled
    ? activeSlide
    : SLIDE_SEQUENCE[slideIndex] ?? "anlageplan";

  useEffect(() => {
    if (!autoRotate || controlled) {
      return undefined;
    }

    const durationMs =
      visibleSlide === "anlageplan" ? anlageplanDurationMs : transportDurationMs;

    const id = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % SLIDE_SEQUENCE.length);
    }, durationMs);

    return () => window.clearInterval(id);
  }, [
    anlageplanDurationMs,
    autoRotate,
    controlled,
    transportDurationMs,
    visibleSlide,
  ]);

  return (
    <div
      className={styles.rotator}
      data-testid="screen2-center-rotator"
      data-active-slide={visibleSlide}
    >
      <div
        className={`${styles.slide} ${visibleSlide === "anlageplan" ? styles.slideVisible : styles.slideHidden}`}
        data-testid="screen2-center-slide-anlageplan"
        aria-hidden={visibleSlide !== "anlageplan"}
      >
        {children}
      </div>
      <div
        className={`${styles.slide} ${visibleSlide === "transport" ? styles.slideVisible : styles.slideHidden}`}
        data-testid="screen2-center-slide-transport"
        aria-hidden={visibleSlide !== "transport"}
      >
        <Screen2TransportSlide transport={transport} timezone={timezone} />
      </div>
    </div>
  );
}
