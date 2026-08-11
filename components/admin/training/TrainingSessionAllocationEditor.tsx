"use client";

import { useCallback, useState, useTransition } from "react";
import { Building2, GripVertical, Loader2, MapPin, RotateCcw, X } from "lucide-react";
import type { TrainingAllocationDto, TrainingSessionAllocationDto } from "@/lib/training/types";
import type { FacilityGroup, ResourceAvailabilityAnnotation } from "./FacilityResourceSelector";
import { FacilityResourceSelector } from "./FacilityResourceSelector";
import type { FacilityResourceType } from "@prisma/client";
import {
  groupAllocationsByAllocationGroup,
  splitFacilityGroupsByAllocationGroup,
  TRAINING_ALLOCATION_GROUP_LABELS,
  type TrainingAllocationGroupKey,
} from "@/lib/training/allocation-groups";
import { useFacilityAvailability } from "@/hooks/use-facility-availability";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  /** The single canonical TrainingSession occurrence these overrides belong to. */
  sessionId: string;
  /** Current occurrence-level overrides loaded server-side. */
  initialAllocations: TrainingSessionAllocationDto[];
  /** The parent TrainingSeries' allocations — shown as the inherited default per group. */
  seriesAllocations: TrainingAllocationDto[];
  /** All non-archived resources grouped by facility for the selector. */
  facilityGroups: FacilityGroup[];
  /** Whether the current user can manage (add/remove) overrides. */
  canManage: boolean;
  /**
   * RESOURCE-AVAILABILITY-UX-01 — the session's own EFFECTIVE start/end
   * (ISO), used to show live Frei/Belegt availability for its resource
   * selectors. This occurrence's own allocation is excluded server-side
   * (excludeTrainingSessionId) so it is never flagged as a conflict with
   * itself in edit mode.
   */
  sessionStartAt: string;
  sessionEndAt: string;
};

const RESOURCE_TYPE_LABELS: Record<FacilityResourceType, string> = {
  FULL_PITCH: "Ganzes Feld",
  HALF_PITCH: "Halbes Feld",
  DRESSING_ROOM: "Garderobe",
  OTHER: "Sonstiges",
};

type AllocationLike = {
  id: string;
  facilityResourceId: string;
  facilityResourceName: string;
  facilityResourceCode: string;
  facilityResourceType: string;
  facilityName: string;
  notes: string | null;
};

// ── Row ───────────────────────────────────────────────────────────────────────

function AllocationRow({
  allocation,
  onRemove,
  canRemove,
}: {
  allocation: AllocationLike;
  onRemove?: (id: string) => Promise<void>;
  canRemove: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRemove = useCallback(() => {
    if (!onRemove) return;
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
          <span className="font-medium text-gray-900 truncate">{allocation.facilityResourceName}</span>
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
        {error && (
          <p className="mt-1 text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>

      {canRemove && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          aria-label={`Zuweisung von ${allocation.facilityResourceName} entfernen`}
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
        </button>
      )}
    </li>
  );
}

// ── Group section ─────────────────────────────────────────────────────────────

function GroupSection({
  groupKey,
  overrideRows,
  seriesRows,
  facilityGroupsForAdd,
  onAdd,
  onRemove,
  onUseSeriesDefault,
  canManage,
  availabilityByResourceId,
}: {
  groupKey: TrainingAllocationGroupKey;
  overrideRows: TrainingSessionAllocationDto[];
  seriesRows: TrainingAllocationDto[];
  facilityGroupsForAdd: FacilityGroup[];
  onAdd: (resourceId: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUseSeriesDefault: () => Promise<void>;
  canManage: boolean;
  availabilityByResourceId?: Map<string, ResourceAvailabilityAnnotation>;
}) {
  const isOverridden = overrideRows.length > 0;
  const rowsToShow: AllocationLike[] = isOverridden ? overrideRows : seriesRows;
  const label = TRAINING_ALLOCATION_GROUP_LABELS[groupKey];
  const testIdSuffix = groupKey.toLowerCase().replace(/_/g, "-");
  const [resetting, setResetting] = useState(false);

  const handleUseSeriesDefault = useCallback(async () => {
    setResetting(true);
    try {
      await onUseSeriesDefault();
    } finally {
      setResetting(false);
    }
  }, [onUseSeriesDefault]);

  return (
    <div data-testid={`training-session-allocations-${testIdSuffix}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        {isOverridden ? (
          <span
            className="inline-flex h-5 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-[0.65rem] font-semibold text-blue-700"
            data-testid={`training-session-allocations-${testIdSuffix}-override-badge`}
          >
            Für dieses Training angepasst
          </span>
        ) : (
          <span className="inline-flex h-5 items-center rounded-full border border-gray-200 bg-gray-50 px-2 text-[0.65rem] font-medium text-gray-500">
            Serienstandard
          </span>
        )}
      </div>

      {rowsToShow.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-gray-200 py-4 text-center text-sm text-gray-500">
          Keine Ressource zugewiesen.
        </p>
      ) : (
        <ul className="space-y-2">
          {rowsToShow.map((row) => (
            <AllocationRow key={row.id} allocation={row} onRemove={isOverridden ? onRemove : undefined} canRemove={isOverridden} />
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-2 space-y-2">
          <FacilityResourceSelector
            facilityGroups={facilityGroupsForAdd}
            allocatedResourceIds={new Set(rowsToShow.map((r) => r.facilityResourceId))}
            onAdd={onAdd}
            testId={`training-session-allocation-add-${testIdSuffix}`}
            placeholder="Für dieses Training auswählen…"
            addButtonLabel="Für dieses Training zuweisen"
            availabilityByResourceId={availabilityByResourceId}
          />
          {isOverridden && (
            <button
              type="button"
              onClick={handleUseSeriesDefault}
              disabled={resetting}
              data-testid={`training-session-allocations-${testIdSuffix}-use-default`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Serien-Standard verwenden
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main editor component ─────────────────────────────────────────────────────

export function TrainingSessionAllocationEditor({
  sessionId,
  initialAllocations,
  seriesAllocations,
  facilityGroups,
  canManage,
  sessionStartAt,
  sessionEndAt,
}: Props) {
  const [allocations, setAllocations] = useState<TrainingSessionAllocationDto[]>(initialAllocations);

  // RESOURCE-AVAILABILITY-UX-01 — this occurrence's own allocations are
  // excluded server-side via excludeTrainingSessionId, so the session's
  // pre-existing resource(s) never show up as "belegt durch sich selbst".
  const { pitchAvailability, dressingRoomAvailability } = useFacilityAvailability({
    enabled: true,
    startAt: sessionStartAt,
    endAt: sessionEndAt,
    excludeTrainingSessionId: sessionId,
  });

  const overridesByGroup = groupAllocationsByAllocationGroup(allocations);
  const seriesByGroup = groupAllocationsByAllocationGroup(seriesAllocations);
  const facilityGroupsByGroup = splitFacilityGroupsByAllocationGroup(facilityGroups);
  const hasOtherResources =
    facilityGroupsByGroup.OTHER.length > 0 ||
    overridesByGroup.OTHER.length > 0 ||
    seriesByGroup.OTHER.length > 0;

  const handleAdd = useCallback(
    async (facilityResourceId: string) => {
      const res = await fetch(`/api/training-sessions/${sessionId}/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityResourceId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
      }

      const data = (await res.json()) as { allocation: TrainingSessionAllocationDto };
      setAllocations((prev) => [...prev, data.allocation].sort((a, b) => a.displayOrder - b.displayOrder));
    },
    [sessionId],
  );

  const handleRemove = useCallback(
    async (allocationId: string) => {
      const res = await fetch(`/api/training-sessions/${sessionId}/allocations/${allocationId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
      }

      setAllocations((prev) => prev.filter((a) => a.id !== allocationId));
    },
    [sessionId],
  );

  const handleUseSeriesDefaultForGroup = useCallback(
    async (groupKey: TrainingAllocationGroupKey) => {
      const rowsToClear = groupAllocationsByAllocationGroup(allocations)[groupKey];
      for (const row of rowsToClear) {
        await handleRemove(row.id);
      }
    },
    [allocations, handleRemove],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Ressourcen für dieses Training</h2>
        <p className="mt-1 text-sm text-gray-500">
          Standardmässig übernimmt dieses Training die Ressourcen seiner Trainingsserie. Weisen Sie hier eine
          abweichende Ressource zu, wenn <span className="font-medium text-gray-700">nur dieser Termin</span>{" "}
          Spielfeld/Halle oder Garderobe wechseln muss — die Serie und alle anderen Termine bleiben unverändert.
        </p>
      </div>

      <div className="space-y-5">
        <GroupSection
          groupKey="PITCH_HALL"
          overrideRows={overridesByGroup.PITCH_HALL}
          seriesRows={seriesByGroup.PITCH_HALL}
          facilityGroupsForAdd={facilityGroupsByGroup.PITCH_HALL}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onUseSeriesDefault={() => handleUseSeriesDefaultForGroup("PITCH_HALL")}
          canManage={canManage}
          availabilityByResourceId={pitchAvailability}
        />
        <GroupSection
          groupKey="DRESSING_ROOM"
          overrideRows={overridesByGroup.DRESSING_ROOM}
          seriesRows={seriesByGroup.DRESSING_ROOM}
          facilityGroupsForAdd={facilityGroupsByGroup.DRESSING_ROOM}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onUseSeriesDefault={() => handleUseSeriesDefaultForGroup("DRESSING_ROOM")}
          canManage={canManage}
          availabilityByResourceId={dressingRoomAvailability}
        />
        {hasOtherResources && (
          <GroupSection
            groupKey="OTHER"
            overrideRows={overridesByGroup.OTHER}
            seriesRows={seriesByGroup.OTHER}
            facilityGroupsForAdd={facilityGroupsByGroup.OTHER}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onUseSeriesDefault={() => handleUseSeriesDefaultForGroup("OTHER")}
            canManage={canManage}
          />
        )}
      </div>
    </div>
  );
}
