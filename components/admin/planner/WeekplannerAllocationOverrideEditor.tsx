"use client";

/**
 * components/admin/planner/WeekplannerAllocationOverrideEditor.tsx
 *
 * WEEKPLANNER-01B — compact resource-override editor for ONE allocation
 * group (Spielfeld/Halle or Garderobe) of ONE canonical activity, within
 * the currently selected alternative WeekplannerPlan.
 *
 * Mirrors components/admin/training/TrainingSessionAllocationEditor.tsx's
 * GroupSection: "override rows present" replaces the Standardplan default
 * entirely for this group; removing the last override row reverts to the
 * Standardplan default — there is no separate reset mutation.
 *
 * Never rendered for the Standardplan (no plan selected) — see
 * WeekPlannerPage.tsx, which only mounts this when an alternative plan is
 * active and the caller can manage plans.
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import { FacilityResourceSelector } from "@/components/admin/training/FacilityResourceSelector";
import type { WeekplannerActivityType, WeekplannerAllocationGroup } from "@/lib/weekplanner/plan-types";

export type WeekplannerOverrideRow = {
  id: string;
  facilityResourceId: string;
  facilityResourceName: string;
  facilityResourceCode: string;
};

type Props = {
  planId: string;
  activityType: WeekplannerActivityType;
  activityId: string;
  allocationGroup: WeekplannerAllocationGroup;
  /** Only for TOURNAMENT + DRESSING_ROOM. */
  participantId?: string;
  label: string;
  /** The Standardplan default for this group — shown read-only when there is no override. */
  standardplanAllocations: { facilityResourceId: string; facilityResourceName: string; facilityResourceCode: string }[];
  /** This plan's current override rows for this exact group (empty when not overridden). */
  initialOverrideAllocations: WeekplannerOverrideRow[];
  facilityGroups: FacilityGroup[];
};

export function WeekplannerAllocationOverrideEditor({
  planId,
  activityType,
  activityId,
  allocationGroup,
  participantId,
  label,
  standardplanAllocations,
  initialOverrideAllocations,
  facilityGroups,
}: Props) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<WeekplannerOverrideRow[]>(initialOverrideAllocations);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOverridden = overrides.length > 0;
  const rowsToShow = isOverridden ? overrides : standardplanAllocations.map((a) => ({ ...a, id: a.facilityResourceId }));

  const handleAdd = useCallback(
    async (facilityResourceId: string) => {
      setError(null);
      const res = await fetch(`/api/weekplanner/plans/${planId}/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType,
          activityId,
          allocationGroup,
          participantId: participantId ?? null,
          facilityResourceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        allocation: { id: string; facilityResourceId: string; facilityResourceName: string; facilityResourceCode: string };
      };
      setOverrides((prev) => [
        ...prev,
        {
          id: data.allocation.id,
          facilityResourceId: data.allocation.facilityResourceId,
          facilityResourceName: data.allocation.facilityResourceName,
          facilityResourceCode: data.allocation.facilityResourceCode,
        },
      ]);
      startTransition(() => router.refresh());
    },
    [planId, activityType, activityId, allocationGroup, participantId, router],
  );

  const handleRemove = useCallback(
    async (allocationId: string) => {
      setError(null);
      const res = await fetch(`/api/weekplanner/plans/${planId}/allocations/${allocationId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
      }

      setOverrides((prev) => prev.filter((o) => o.id !== allocationId));
      startTransition(() => router.refresh());
    },
    [planId, router],
  );

  const handleUseStandardplan = useCallback(async () => {
    setError(null);
    try {
      for (const row of overrides) {
        await handleRemove(row.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Zurücksetzen");
    }
  }, [overrides, handleRemove]);

  return (
    <div className="mt-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label} anpassen</p>
        {isOverridden ? (
          <span className="inline-flex h-5 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-[10px] font-semibold text-blue-700">
            Für diesen Plan angepasst
          </span>
        ) : (
          <span className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-white px-2 text-[10px] font-medium text-[var(--muted)]">
            Standardplan-Wert
          </span>
        )}
      </div>

      <ul className="mt-1.5 space-y-1">
        {rowsToShow.length === 0 ? (
          <li className="text-[11px] text-[var(--muted)]">Keine Ressource zugewiesen.</li>
        ) : (
          rowsToShow.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[11px]"
            >
              <span className="truncate text-[var(--foreground)]">{row.facilityResourceName}</span>
              {isOverridden && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      try {
                        await handleRemove(row.id);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Fehler beim Entfernen");
                      }
                    });
                  }}
                  disabled={isPending}
                  aria-label={`Override von ${row.facilityResourceName} entfernen`}
                  className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                </button>
              )}
            </li>
          ))
        )}
      </ul>

      {error && (
        <p className="mt-1 text-[11px] text-rose-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2 space-y-1.5">
        <FacilityResourceSelector
          facilityGroups={facilityGroups}
          allocatedResourceIds={new Set(rowsToShow.map((r) => r.facilityResourceId))}
          onAdd={handleAdd}
          placeholder="Für diesen Plan auswählen…"
          addButtonLabel="Zuweisen"
          testId={`weekplanner-override-${activityId}-${allocationGroup.toLowerCase()}${participantId ? `-${participantId}` : ""}`}
        />
        {isOverridden && (
          <button
            type="button"
            onClick={() => startTransition(handleUseStandardplan)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            Standardplan verwenden
          </button>
        )}
      </div>
    </div>
  );
}
