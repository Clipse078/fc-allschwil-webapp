import type { ReactNode } from "react";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";

/**
 * Shared kiosk viewport contract (1920×1080 logical canvas).
 * Used by Screen 1 and Screen 2 production routes and dashboard previews.
 */
export default function KioskViewportLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <KioskViewportScaler>{children}</KioskViewportScaler>;
}
