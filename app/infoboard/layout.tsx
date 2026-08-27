import type { ReactNode } from "react";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";

/**
 * Public infoboard layout — no auth, no admin shell.
 * Designed for kiosk / screen use. Full-viewport, no scroll.
 */
export default function InfoboardLayout({ children }: { children: ReactNode }) {
  return <KioskViewportScaler>{children}</KioskViewportScaler>;
}
