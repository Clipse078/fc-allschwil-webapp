"use client";

/**
 * components/admin/shared/planning/VisualDressingRoomPicker.tsx
 *
 * PLANNING-RESOURCE-UX-01 — shared visual dressing-room picker for the
 * complete Planning family.
 *
 * Uses the same availability-first language as VisualResourceAvailabilityPicker:
 *   - Free rooms shown with green status
 *   - Occupied rooms remain visible with team/activity/time
 *   - Selected rooms shown with primary brand accent + check
 *
 * MatchCenter: pass `label` as "Heimkabine" or "Gastkabine" to semantically
 * distinguish the two assignment slots — the shared component renders them
 * identically, the caller differentiates via label.
 *
 * No pitch SVG — dressing rooms use a compact room icon layout.
 */

import { useCallback } from "react";
import { Check, DoorOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  FacilityGroup,
  ResourceAvailabilityAnnotation,
} from "@/components/admin/training/FacilityResourceSelector";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VisualDressingRoomPickerProps = {
  facilityGroups: FacilityGroup[];
  selectedResourceIds: Set<string>;
  onSelect: (resourceId: string) => void;
  onDeselect: (resourceId: string) => void;
  disabled?: boolean;
  availabilityByResourceId?: Map<string, ResourceAvailabilityAnnotation>;
  /** Semantic label shown as section heading (e.g. "Garderobe", "Heimkabine", "Gastkabine"). */
  label?: string;
  /** When true, only one room can be selected (for single-slot assignment like Heimkabine). Default false. */
  singleSelect?: boolean;
  /** Stable identifier suffix for data-testid attributes. */
  testId?: string;
  /** Empty state message when tenant has no dressing rooms configured. */
  emptyMessage?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatClockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ── DressingRoomCard ──────────────────────────────────────────────────────────

type DressingRoomCardProps = {
  resourceName: string;
  resourceId: string;
  annotation: ResourceAvailabilityAnnotation | undefined;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  testId?: string;
};

function DressingRoomCard({
  resourceName,
  resourceId,
  annotation,
  isSelected,
  disabled,
  onSelect,
  onDeselect,
  testId,
}: DressingRoomCardProps) {
  const isFree = annotation?.status === "FREE";
  const isOccupied = annotation?.status === "OCCUPIED";
  const isNeutral = !annotation;

  const conflictTime =
    annotation?.conflictStartAt && annotation?.conflictEndAt
      ? `${formatClockTime(annotation.conflictStartAt)}–${formatClockTime(annotation.conflictEndAt)}`
      : null;

  const handleClick = useCallback(() => {
    if (disabled || isOccupied) return;
    if (isSelected) onDeselect();
    else onSelect();
  }, [disabled, isOccupied, isSelected, onSelect, onDeselect]);

  const borderClass = isSelected
    ? "border-[var(--sce-primary)] ring-1 ring-[var(--sce-primary)]"
    : isFree
      ? "border-emerald-300 hover:border-emerald-400"
      : isOccupied
        ? "border-rose-200"
        : "border-[var(--border)]";

  const bgClass = isSelected
    ? "bg-blue-50"
    : isOccupied
      ? "bg-rose-50/50"
      : "bg-[var(--surface)]";

  const isClickable = !disabled && !isOccupied;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isOccupied}
      data-testid={testId ? `${testId}-card-${resourceId}` : undefined}
      aria-pressed={isSelected}
      aria-label={`${resourceName} ${isSelected ? "ausgewählt" : isFree ? "Frei" : isOccupied ? "Belegt" : ""}`}
      className={cn(
        "group relative flex w-full flex-col items-center rounded-xl border p-3 text-center transition-all",
        borderClass,
        bgClass,
        isClickable
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1"
          : "cursor-default",
        disabled && !isOccupied && "opacity-50",
      )}
    >
      {/* Selected check */}
      {isSelected && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sce-primary)] text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}

      {/* Room icon */}
      <div
        className={cn(
          "mb-2 flex h-10 w-10 items-center justify-center rounded-lg border-2",
          isSelected
            ? "border-[var(--sce-primary)] bg-blue-100 text-[var(--sce-primary)]"
            : isFree
              ? "border-emerald-300 bg-emerald-50 text-emerald-600"
              : isOccupied
                ? "border-rose-200 bg-rose-50 text-rose-500"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
        )}
      >
        <DoorOpen className="h-5 w-5" />
      </div>

      {/* Room name */}
      <p className="text-sm font-semibold text-[var(--foreground)] leading-tight">{resourceName}</p>

      {/* Status */}
      <div className="mt-1.5 min-h-[1.25rem]">
        {isNeutral && (
          <p className="text-[11px] text-[var(--muted)]">Verfügbarkeit nach Zeit</p>
        )}
        {isFree && !isSelected && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            Frei
          </span>
        )}
        {isSelected && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sce-primary)]">
            <Check className="h-2.5 w-2.5" />
            Ausgewählt
          </span>
        )}
        {isOccupied && (
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
              Belegt
            </span>
            {annotation?.conflictLabel && (
              <p className="mt-0.5 text-[10px] leading-tight text-rose-700 truncate" title={annotation.conflictLabel}>
                {annotation.conflictLabel}
              </p>
            )}
            {conflictTime && (
              <p className="text-[10px] text-rose-600">{conflictTime}</p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ── AvailabilitySummary ───────────────────────────────────────────────────────

function AvailabilitySummary({
  facilityGroups,
  availability,
}: {
  facilityGroups: FacilityGroup[];
  availability: Map<string, ResourceAvailabilityAnnotation>;
}) {
  let free = 0;
  let occupied = 0;
  for (const fg of facilityGroups) {
    for (const r of fg.resources) {
      const a = availability.get(r.id);
      if (!a) continue;
      if (a.status === "FREE") free++;
      else occupied++;
    }
  }

  const total = free + occupied;
  if (total === 0) return null;

  return (
    <p className="inline-flex items-center gap-2 text-xs font-medium">
      <span className="flex items-center gap-1 text-emerald-600">
        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
        {free} verfügbar
      </span>
      {occupied > 0 && (
        <>
          <span className="text-[var(--muted)]">·</span>
          <span className="flex items-center gap-1 text-rose-600">
            <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
            {occupied} belegt
          </span>
        </>
      )}
    </p>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function VisualDressingRoomPicker({
  facilityGroups,
  selectedResourceIds,
  onSelect,
  onDeselect,
  disabled = false,
  availabilityByResourceId = new Map(),
  label,
  singleSelect = false,
  testId,
  emptyMessage = "Keine Garderoben konfiguriert.",
}: VisualDressingRoomPickerProps) {
  const allResources = facilityGroups.flatMap((fg) => fg.resources);
  const hasAvailabilityData = availabilityByResourceId.size > 0;

  if (allResources.length === 0) {
    return <p className="text-sm text-[var(--muted)] italic">{emptyMessage}</p>;
  }

  const handleSelect = (resourceId: string) => {
    if (singleSelect) {
      // Deselect all others first (single-select mode for Heimkabine/Gastkabine)
      for (const id of selectedResourceIds) {
        if (id !== resourceId) onDeselect(id);
      }
    }
    onSelect(resourceId);
  };

  return (
    <div className="space-y-3" data-testid={testId}>
      {label && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
          {hasAvailabilityData && (
            <AvailabilitySummary facilityGroups={facilityGroups} availability={availabilityByResourceId} />
          )}
        </div>
      )}

      {!label && hasAvailabilityData && (
        <AvailabilitySummary facilityGroups={facilityGroups} availability={availabilityByResourceId} />
      )}

      <div
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
        data-testid={testId ? `${testId}-grid` : undefined}
      >
        {allResources.map((resource) => (
          <DressingRoomCard
            key={resource.id}
            resourceName={resource.name}
            resourceId={resource.id}
            annotation={availabilityByResourceId.get(resource.id)}
            isSelected={selectedResourceIds.has(resource.id)}
            disabled={disabled}
            onSelect={() => handleSelect(resource.id)}
            onDeselect={() => onDeselect(resource.id)}
            testId={testId}
          />
        ))}
      </div>
    </div>
  );
}
