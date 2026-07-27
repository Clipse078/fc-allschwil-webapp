"use client";

import { useState, useTransition, useCallback } from "react";
import { Loader2, X, GripVertical, MapPin, Building2 } from "lucide-react";
import type { TrainingAllocationDto } from "@/lib/training/types";
import type { FacilityGroup } from "./FacilityResourceSelector";
import { FacilityResourceSelector } from "./FacilityResourceSelector";
import type { FacilityResourceType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  /** The training series these allocations belong to. */
  trainingSeriesId: string;
  trainingSeriesTitle: string;
  /** Current allocations loaded server-side. */
  initialAllocations: TrainingAllocationDto[];
  /** All non-archived resources grouped by facility for the selector. */
  facilityGroups: FacilityGroup[];
  /** Whether the current user can manage (add/remove) allocations. */
  canManage: boolean;
};

// ── Resource type label map ───────────────────────────────────────────────────

const RESOURCE_TYPE_LABELS: Record<FacilityResourceType, string> = {
  FULL_PITCH: "Ganzes Feld",
  HALF_PITCH: "Halbes Feld",
  DRESSING_ROOM: "Garderobe",
  OTHER: "Sonstiges",
};

// ── Allocation row component ──────────────────────────────────────────────────

function AllocationRow({
  allocation,
  onRemove,
  canManage,
}: {
  allocation: TrainingAllocationDto;
  onRemove: (id: string) => Promise<void>;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRemove = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        await onRemove(allocation.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Entfernen");
      }
    });
  }, [allocation.id, onRemove]);

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <GripVertical size={16} className="shrink-0 text-gray-300" aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {allocation.facilityResourceName}
          </span>
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {RESOURCE_TYPE_LABELS[allocation.facilityResourceType as FacilityResourceType] ??
              allocation.facilityResourceType}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Building2 size={11} aria-hidden />
          <span className="truncate">{allocation.facilityName}</span>
          <span className="text-gray-300 mx-1">·</span>
          <MapPin size={11} aria-hidden />
          <span>{allocation.facilityResourceCode}</span>
        </div>
        {allocation.notes && (
          <p className="mt-1 text-xs text-gray-400 italic truncate">{allocation.notes}</p>
        )}
        {error && (
          <p className="mt-1 text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>

      {canManage && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          aria-label={`Zuweisung von ${allocation.facilityResourceName} entfernen`}
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <X size={14} />
          )}
        </button>
      )}
    </li>
  );
}

// ── Main editor component ─────────────────────────────────────────────────────

export function TrainingAllocationEditor({
  trainingSeriesId,
  trainingSeriesTitle,
  initialAllocations,
  facilityGroups,
  canManage,
}: Props) {
  const [allocations, setAllocations] =
    useState<TrainingAllocationDto[]>(initialAllocations);

  const allocatedIds = new Set(allocations.map((a) => a.facilityResourceId));

  const handleAdd = useCallback(
    async (facilityResourceId: string) => {
      const res = await fetch(
        `/api/training-series/${trainingSeriesId}/allocations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facilityResourceId }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`,
        );
      }

      const data = (await res.json()) as { allocation: TrainingAllocationDto };
      setAllocations((prev) =>
        [...prev, data.allocation].sort((a, b) => a.displayOrder - b.displayOrder),
      );
    },
    [trainingSeriesId],
  );

  const handleRemove = useCallback(
    async (allocationId: string) => {
      const res = await fetch(
        `/api/training-series/${trainingSeriesId}/allocations/${allocationId}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`,
        );
      }

      setAllocations((prev) => prev.filter((a) => a.id !== allocationId));
    },
    [trainingSeriesId],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Ressourcen-Zuweisung
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Weisen Sie Anlagen-Ressourcen der Trainingsserie{" "}
          <span className="font-medium text-gray-700">{trainingSeriesTitle}</span> zu.
          Ein Training kann gleichzeitig mehrere Ressourcen belegen
          (z.&nbsp;B. zwei halbe Felder oder ein Feld&nbsp;+ Garderobe).
        </p>
      </div>

      {/* Current allocations */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          Zugewiesene Ressourcen ({allocations.length})
        </h3>

        {allocations.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
            <MapPin size={24} className="mx-auto mb-2 text-gray-300" aria-hidden />
            <p className="text-sm text-gray-500">
              Noch keine Ressourcen zugewiesen.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {allocations.map((allocation) => (
              <AllocationRow
                key={allocation.id}
                allocation={allocation}
                onRemove={handleRemove}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Add new allocation */}
      {canManage && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-700">
            Ressource hinzufügen
          </h3>
          <FacilityResourceSelector
            facilityGroups={facilityGroups}
            allocatedResourceIds={allocatedIds}
            onAdd={handleAdd}
          />
        </div>
      )}
    </div>
  );
}
