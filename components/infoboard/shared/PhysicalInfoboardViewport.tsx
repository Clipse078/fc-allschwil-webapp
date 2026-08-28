"use client";

/**
 * components/infoboard/shared/PhysicalInfoboardViewport.tsx
 *
 * Canonical 1920×1080 physical-TV surface for every public Infoboard board.
 *
 * Dashboard Preview iframes and kiosk routes must render board content only
 * inside this wrapper so the internal layout stays deterministic. The outer
 * host scales this surface to fit its panel or display — it must not alter
 * shell geometry, card sizing, or weather visibility inside the canvas.
 *
 * Scaling happens exactly once here. Do not nest another viewport scaler.
 */

import type { ReactNode } from "react";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";

export {
  KIOSK_LOGICAL_HEIGHT,
  KIOSK_LOGICAL_WIDTH,
} from "@/lib/infoboard/kiosk-viewport";

export type PhysicalInfoboardViewportProps = {
  children: ReactNode;
};

export function PhysicalInfoboardViewport({
  children,
}: PhysicalInfoboardViewportProps): ReactNode {
  return <KioskViewportScaler>{children}</KioskViewportScaler>;
}
