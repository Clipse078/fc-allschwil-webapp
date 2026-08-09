"use client";

import { useState, useTransition, useCallback } from "react";
import { Loader2, Plus, Building2, MapPin } from "lucide-react";
import type { FacilityResourceType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResourceOption = {
  id: string;
  name: string;
  code: string;
  type: FacilityResourceType;
  facilityId: string;
  facilityName: string;
};

export type FacilityGroup = {
  facilityId: string;
  facilityName: string;
  resources: ResourceOption[];
};

/**
 * PLANNING-CREATION-UX-01A — optional live availability annotation for a
 * single FacilityResource, sourced from lib/facilities/availability-service.ts.
 * Purely additive: when a caller doesn't pass `availabilityByResourceId`,
 * the selector renders exactly as before.
 */
export type ResourceAvailabilityAnnotation = {
  status: "FREE" | "OCCUPIED";
  conflictLabel?: string | null;
  conflictStartAt?: string | null;
  conflictEndAt?: string | null;
};

type Props = {
  /** Non-archived resources for this allocation group, grouped by facility. */
  facilityGroups: FacilityGroup[];
  /** IDs of resources already allocated (will be shown as disabled). */
  allocatedResourceIds: Set<string>;
  /** Called when the user selects a resource to add. */
  onAdd: (resourceId: string) => Promise<void>;
  disabled?: boolean;
  /** Placeholder shown as the first, unselectable `<option>`. */
  placeholder?: string;
  /** Label for the submit button. */
  addButtonLabel?: string;
  /** Shown instead of the selector when the tenant has zero resources of this group's type. */
  noResourcesMessage?: string;
  /** Shown instead of the selector when resources exist but are all already allocated. */
  allAllocatedMessage?: string;
  /** Stable identifier suffix for data-testid hooks (e.g. "pitch-hall", "dressing-room"). */
  testId?: string;
  /**
   * PLANNING-CREATION-UX-01A — live Frei/Belegt availability per resource id
   * for the currently selected date/time. When provided, occupied resources
   * remain selectable (visible, never hidden) but are annotated inline, e.g.
   * "Kunstrasen 3 A — Belegt · Training E2 · 17:00–18:00".
   */
  availabilityByResourceId?: Map<string, ResourceAvailabilityAnnotation>;
};

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function formatAvailabilitySuffix(annotation: ResourceAvailabilityAnnotation | undefined): string {
  if (!annotation) return "";
  if (annotation.status === "FREE") return " — Frei";
  const timeRange =
    annotation.conflictStartAt && annotation.conflictEndAt
      ? ` · ${formatClockTime(annotation.conflictStartAt)}–${formatClockTime(annotation.conflictEndAt)}`
      : "";
  return ` — Belegt${annotation.conflictLabel ? ` · ${annotation.conflictLabel}` : ""}${timeRange}`;
}

// ── Resource type label map ───────────────────────────────────────────────────

const RESOURCE_TYPE_LABELS: Record<FacilityResourceType, string> = {
  FULL_PITCH: "Ganzes Feld",
  HALF_PITCH: "Halbes Feld",
  DRESSING_ROOM: "Garderobe",
  OTHER: "Sonstiges",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function FacilityResourceSelector({
  facilityGroups,
  allocatedResourceIds,
  onAdd,
  disabled = false,
  placeholder = "auswählen…",
  addButtonLabel = "Zuweisen",
  noResourcesMessage = "Keine Ressourcen dieses Typs konfiguriert.",
  allAllocatedMessage = "Alle verfügbaren Ressourcen wurden bereits zugewiesen.",
  testId,
  availabilityByResourceId,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalResourceCount = facilityGroups.reduce((sum, fg) => sum + fg.resources.length, 0);
  const hasAvailable = facilityGroups.some((fg) =>
    fg.resources.some((r) => !allocatedResourceIds.has(r.id)),
  );

  const handleAdd = useCallback(() => {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      try {
        await onAdd(selectedId);
        setSelectedId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Hinzufügen");
      }
    });
  }, [selectedId, onAdd]);

  if (totalResourceCount === 0) {
    return (
      <p className="text-sm text-gray-500 italic" data-testid={testId ? `${testId}-no-resources` : undefined}>
        {noResourcesMessage}
      </p>
    );
  }

  if (!hasAvailable) {
    return (
      <p className="text-sm text-gray-500 italic" data-testid={testId ? `${testId}-all-allocated` : undefined}>
        {allAllocatedMessage}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={disabled || isPending}
          data-testid={testId ? `${testId}-select` : undefined}
          aria-label={placeholder}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
        >
          <option value="">{placeholder}</option>
          {facilityGroups.map((fg) => {
            const available = fg.resources.filter((r) => !allocatedResourceIds.has(r.id));
            if (available.length === 0) return null;
            return (
              <optgroup key={fg.facilityId} label={fg.facilityName}>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({RESOURCE_TYPE_LABELS[r.type] ?? r.type})
                    {formatAvailabilitySuffix(availabilityByResourceId?.get(r.id))}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedId || disabled || isPending}
          data-testid={testId ? `${testId}-add-button` : undefined}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          {addButtonLabel}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-gray-400">
        <Building2 size={12} className="inline mr-1" />
        Ressourcen sind nach Anlage gruppiert.{" "}
        <MapPin size={12} className="inline mr-1" />
        Archivierte Ressourcen werden nicht angezeigt.
      </p>
    </div>
  );
}
