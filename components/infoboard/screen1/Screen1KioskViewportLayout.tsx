import type { ReactNode } from "react";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";

/**
 * Screen-1-only kiosk viewport contract (1920×1080 logical canvas).
 * Applied via route layouts — never used for Screen 2 or Anlageplan routes.
 */
export default function Screen1KioskViewportLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <KioskViewportScaler>{children}</KioskViewportScaler>;
}
