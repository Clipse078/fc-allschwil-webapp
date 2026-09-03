"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

export type SyncDestinationStatus = "idle" | "pending" | "complete";

export type SyncDestination = {
  id: string;
  label: string;
  status: SyncDestinationStatus;
};

export type SyncFlowIndicatorProps = {
  /** Source label (e.g. "SportClubEvo", "Training geändert"). */
  source: string;
  destinations: SyncDestination[];
  /**
   * When true, plays a one-shot propagation animation through destinations.
   * Does NOT imply real synchronization — UI primitive only.
   */
  active?: boolean;
  className?: string;
};

/**
 * SyncFlowIndicator — SCE connected-platform motion foundation.
 *
 * Visualizes source → destination propagation for future sync experiences.
 * Not wired to real product synchronization state.
 */
export function SyncFlowIndicator({
  source,
  destinations,
  active = false,
  className,
}: SyncFlowIndicatorProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "sce-sync-flow",
        active && !reducedMotion && "sce-sync-flow--active",
        reducedMotion && "sce-sync-flow--reduced",
        className,
      )}
      role="group"
      aria-label={`Verteilung von ${source}`}
    >
      <div className="sce-sync-flow__source">
        <span className="sce-sync-flow__label">{source}</span>
      </div>

      <div className="sce-sync-flow__connector" aria-hidden="true">
        <span className="sce-sync-flow__line" />
      </div>

      <ul className="sce-sync-flow__destinations" aria-label="Ziele">
        {destinations.map((dest, index) => (
          <li
            key={dest.id}
            className={cn(
              "sce-sync-flow__destination",
              dest.status === "pending" && "sce-sync-flow__destination--pending",
              dest.status === "complete" && "sce-sync-flow__destination--complete",
            )}
            style={{ "--sce-sync-index": index } as CSSProperties}
          >
            <span className="sce-sync-flow__label">{dest.label}</span>
            {dest.status === "complete" && (
              <Check
                className="sce-sync-flow__check h-3 w-3"
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
