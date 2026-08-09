"use client";

/**
 * components/admin/planner/WeekplannerActivityOverridePanel.tsx
 *
 * WEEKPLANNER-01D — Premium Operational UX overhaul.
 *
 * Replaces the previously ALWAYS-rendered override editors inside every
 * activity card (WEEKPLANNER-01B/01C) with one compact "Anpassen" action.
 * The default card stays dense-free (time, team, resource chips only);
 * opening "Anpassen" reveals the editable plan-specific values (time +
 * resource editors, passed in as `children`) for exactly this one
 * activity. Reuses WeekplannerOverridePanelContext so only one activity's
 * editor is expanded across the whole week grid at a time — no new global
 * modal framework, just this single compact expandable editor.
 */

import { ChevronDown, Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useOverridePanelState } from "./WeekplannerOverridePanelContext";

type Props = {
  /** Unique across the whole week grid — see planTimeOverrideKey()/planOverrideKey() convention. */
  activityKey: string;
  children: React.ReactNode;
};

export function WeekplannerActivityOverridePanel({ activityKey, children }: Props) {
  const { isOpen, toggle } = useOverridePanelState(activityKey);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        data-testid={`weekplanner-anpassen-toggle-${activityKey}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
      >
        <Settings2 className="h-3 w-3" />
        Anpassen
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2" data-testid={`weekplanner-anpassen-panel-${activityKey}`}>
          {children}
        </div>
      )}
    </div>
  );
}
