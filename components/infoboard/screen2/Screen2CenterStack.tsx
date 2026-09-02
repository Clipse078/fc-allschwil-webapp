/**
 * components/infoboard/screen2/Screen2CenterStack.tsx
 *
 * INFOBOARD-TRANSPORT-02-UX3 — static Screen 2 center stack:
 * Sportanlage map on top, ÖV departures panel below.
 */
"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useKioskTransport } from "@/components/infoboard/kiosk-transport";
import { Screen2TransportSlide } from "@/components/infoboard/screen2/Screen2TransportSlide";
import { SCREEN2_BODY_SHELL_CSS_VARS } from "@/lib/infoboard/screen2-body-shell-sizing";
import type { TransportResult } from "@/lib/transport/transport-types";
import styles from "./Screen2CenterStack.module.css";

export type Screen2CenterStackProps = {
  children: ReactNode;
  tenantKey: string;
  timezone: string;
  initialTransport: TransportResult | null;
  refreshIntervalSeconds: number;
  live?: boolean;
};

export function Screen2CenterStack({
  children,
  tenantKey,
  timezone,
  initialTransport,
  refreshIntervalSeconds,
  live = true,
}: Screen2CenterStackProps): ReactElement {
  const transport = useKioskTransport(
    initialTransport,
    refreshIntervalSeconds,
    tenantKey,
    live,
  );

  return (
    <div
      className={styles.stack}
      data-testid="screen2-center-stack"
      style={SCREEN2_BODY_SHELL_CSS_VARS as CSSProperties}
    >
      <div className={styles.mapRegion}>{children}</div>
      <div className={styles.transportRegion} data-testid="screen2-transport-panel">
        <Screen2TransportSlide
          transport={transport}
          timezone={timezone}
          compact
        />
      </div>
    </div>
  );
}
