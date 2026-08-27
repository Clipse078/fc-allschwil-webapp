import type { ReactNode } from "react";

/**
 * Public infoboard layout — no auth, no admin shell.
 * Designed for kiosk / screen use. Full-viewport, no scroll.
 */
export default function InfoboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {children}
    </div>
  );
}
