"use client";

/**
 * components/admin/planner/WeekplannerOverridePanelContext.tsx
 *
 * WEEKPLANNER-01D — Premium Operational UX.
 *
 * Coordinates WeekplannerActivityOverridePanel instances across the whole
 * Weekplanner grid so at most ONE activity's "Anpassen" editor is expanded
 * at a time (per product spec: "a compact expandable editor, ONE activity
 * at a time" — never a new global modal framework, just this single piece
 * of shared disclosure state).
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type OverridePanelContextValue = {
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
};

const OverridePanelContext = createContext<OverridePanelContextValue | null>(null);

export function WeekplannerOverridePanelProvider({ children }: { children: ReactNode }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const value = useMemo(() => ({ openKey, setOpenKey }), [openKey]);
  return <OverridePanelContext.Provider value={value}>{children}</OverridePanelContext.Provider>;
}

/** Falls back to fully-local (uncoordinated) state when rendered outside a provider, so the panel still works standalone (e.g. in tests). */
export function useOverridePanelState(key: string): { isOpen: boolean; toggle: () => void } {
  const shared = useContext(OverridePanelContext);
  const [localOpen, setLocalOpen] = useState(false);

  if (!shared) {
    return { isOpen: localOpen, toggle: () => setLocalOpen((v) => !v) };
  }

  const isOpen = shared.openKey === key;
  return {
    isOpen,
    toggle: () => shared.setOpenKey(isOpen ? null : key),
  };
}
