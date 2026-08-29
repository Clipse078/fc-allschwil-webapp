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
 *
 * WEEKPLANNER-01C — Operational UX Completion.
 *
 *   - The "Standardplan"/plan badge now names the actual effective
 *     resource(s), matching the product spec's example ("Standardplan:
 *     Kunstrasen 2" / "Schlechtwetterplan: Halle Gartenhof") instead of a
 *     generic "angepasst" pill.
 *   - Reuses the EXISTING live availability aggregator
 *     (GET /api/facilities/availability, lib/facilities/availability-
 *     service.ts — the same one TrainingCenter/MatchCenter/TournamentCenter
 *     guided creation already use) to annotate the resource picker with
 *     Frei/Belegt + conflict label/time. No second availability engine.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, X } from "lucide-react";
import type {
  FacilityGroup,
  ResourceAvailabilityAnnotation,
} from "@/components/admin/training/FacilityResourceSelector";
import { FacilityResourceSelector } from "@/components/admin/training/FacilityResourceSelector";
import type { WeekplannerActivityType, WeekplannerAllocationGroup } from "@/lib/weekplanner/plan-types";

/** Shape of one row in GET /api/facilities/availability's `availability` array. */
type ResourceAvailabilityRow = ResourceAvailabilityAnnotation & { resourceId: string };

export type WeekplannerOverrideRow = {
  id: string;
  facilityResourceId: string;
  facilityResourceName: string;
  facilityResourceCode: string;
  occupancyBeforeMinutes: number;
  occupancyAfterMinutes: number;
};

type Props = {
  planId: string;
  /** The active alternative plan's name — shown in the override badge, e.g. "Schlechtwetterplan: Halle Gartenhof". */
  planName: string;
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
  /** The activity's own time window — drives the live Frei/Belegt availability lookup below. */
  startAt: string;
  endAt: string;
};

export function WeekplannerAllocationOverrideEditor({
  planId,
  planName,
  activityType,
  activityId,
  allocationGroup,
  participantId,
  label,
  standardplanAllocations,
  initialOverrideAllocations,
  facilityGroups,
  startAt,
  endAt,
}: Props) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<WeekplannerOverrideRow[]>(initialOverrideAllocations);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [availabilityByResourceId, setAvailabilityByResourceId] = useState<
    Map<string, ResourceAvailabilityAnnotation>
  >(new Map());

  const isOverridden = overrides.length > 0;
  const rowsToShow = isOverridden ? overrides : standardplanAllocations.map((a) => ({ ...a, id: a.facilityResourceId }));
  const badgeName = isOverridden ? planName : "Standardplan";
  const badgeValue = rowsToShow.length > 0 ? rowsToShow.map((r) => r.facilityResourceName).join(", ") : "keine Zuweisung";

  // WEEKPLANNER-01C — reuses the EXISTING live availability aggregator
  // (same one guided TrainingCenter/MatchCenter/TournamentCenter creation
  // uses) to show Frei/Belegt + conflict label/time for every resource
  // this override could be set to. Purely additive: on fetch failure the
  // selector simply renders without annotations, exactly as it did before.
  useEffect(() => {
    let active = true;
    // MATCH/TOURNAMENT activityId IS the canonical Event.id — excluding it
    // avoids the activity's own booking showing up as its own conflict.
    const excludeEventId = activityType !== "TRAINING" ? activityId : undefined;

    async function loadAvailability() {
      const params = new URLSearchParams({ startAt, endAt, group: allocationGroup });
      if (excludeEventId) params.set("excludeEventId", excludeEventId);
      try {
        const res = await fetch(`/api/facilities/availability?${params.toString()}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { availability?: ResourceAvailabilityRow[] } | null;
        if (!active || !res.ok || !data?.availability) return;
        setAvailabilityByResourceId(new Map(data.availability.map((a) => [a.resourceId, a])));
      } catch {
        if (active) setAvailabilityByResourceId(new Map());
      }
    }

    loadAvailability();
    return () => {
      active = false;
    };
  }, [activityType, activityId, allocationGroup, startAt, endAt]);

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
        allocation: {
          id: string;
          facilityResourceId: string;
          facilityResourceName: string;
          facilityResourceCode: string;
          occupancyBeforeMinutes: number;
          occupancyAfterMinutes: number;
        };
      };
      setOverrides((prev) => [
        ...prev,
        {
          id: data.allocation.id,
          facilityResourceId: data.allocation.facilityResourceId,
          facilityResourceName: data.allocation.facilityResourceName,
          facilityResourceCode: data.allocation.facilityResourceCode,
          occupancyBeforeMinutes: data.allocation.occupancyBeforeMinutes ?? 0,
          occupancyAfterMinutes: data.allocation.occupancyAfterMinutes ?? 0,
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
          <span
            className="inline-flex max-w-[70%] items-center gap-1 truncate rounded-full border border-blue-200 bg-blue-50 px-2 text-[10px] font-semibold text-blue-700"
            data-testid="weekplanner-override-badge-active"
            title={`${badgeName}: ${badgeValue}`}
          >
            {badgeName}: {badgeValue}
          </span>
        ) : (
          <span
            className="inline-flex max-w-[70%] items-center gap-1 truncate rounded-full border border-[var(--border)] bg-white px-2 text-[10px] font-medium text-[var(--muted)]"
            data-testid="weekplanner-override-badge-standard"
            title={`${badgeName}: ${badgeValue}`}
          >
            {badgeName}: {badgeValue}
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
          availabilityByResourceId={availabilityByResourceId}
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
