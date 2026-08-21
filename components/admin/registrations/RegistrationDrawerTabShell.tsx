"use client";

/**
 * REG-WAIT-01K — Canonical registration lifecycle drawer tab shell.
 *
 * Shared tab order, typography, and interaction grammar for:
 * Registrierungen · Warteliste · Archiv detail drawers.
 */

import { cn } from "@/lib/cn";

export type RegistrationDrawerTab = "overview" | "history" | "communication";

export const REGISTRATION_DRAWER_TABS: RegistrationDrawerTab[] = [
  "overview",
  "history",
  "communication",
];

export const REGISTRATION_DRAWER_TAB_LABELS: Record<RegistrationDrawerTab, string> = {
  overview: "Überblick",
  history: "Verlauf",
  communication: "Kommunikation",
};

/** Shared horizontal padding for tab panel bodies across lifecycle drawers. */
export const REGISTRATION_DRAWER_TAB_CONTENT_CLASS = "px-6 py-5";

type TabStripProps = {
  activeTab: RegistrationDrawerTab;
  onTabChange: (tab: RegistrationDrawerTab) => void;
};

export function RegistrationDrawerTabStrip({ activeTab, onTabChange }: TabStripProps) {
  return (
    <div className="flex flex-shrink-0 border-b border-[var(--border)]">
      {REGISTRATION_DRAWER_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          className={cn(
            "flex-1 px-4 py-2.5 text-xs font-semibold transition-colors",
            activeTab === tab
              ? "border-b-2 border-[var(--tenant-primary)] text-[var(--tenant-primary)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          {REGISTRATION_DRAWER_TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}

export function RegistrationDrawerTabBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto">{children}</div>;
}

/** UI-only placeholder — no backend, persistence, or composer controls. */
export function RegistrationCommunicationTabPlaceholder() {
  return (
    <div
      className={cn(
        REGISTRATION_DRAWER_TAB_CONTENT_CLASS,
        "flex min-h-[220px] flex-col items-center justify-center text-center",
      )}
    >
      <p className="text-sm font-semibold text-[var(--foreground)]">Kommunikation</p>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-2)]">
        E-Mail und interne Kommentare werden hier gebündelt.
      </p>
      <p className="mt-1.5 text-xs text-[var(--muted)]">
        Diese Funktion wird als nächster Schritt erweitert.
      </p>
    </div>
  );
}
