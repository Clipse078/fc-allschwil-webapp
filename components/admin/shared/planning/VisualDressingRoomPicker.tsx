"use client";

/**
 * components/admin/shared/planning/VisualDressingRoomPicker.tsx
 *
 * PLANNING-RESOURCE-UX-01 — shared visual dressing-room picker for the
 * complete Planning family.
 *
 * PLANNING-RESOURCE-UX-01-C2 — corrective UX pass:
 *   - Occupied rooms: compact single-row display (name + "Belegt" + context),
 *     no longer rendered as large cards — fits more rooms in narrow columns.
 *   - Free rooms: clear card, easy to select.
 *   - Compact mode for Wochenplaner editor context.
 *
 * MatchCenter: pass `label` as "Heimkabine" or "Gastkabine" to semantically
 * distinguish the two assignment slots.
 */

import { useCallback, useEffect, useState } from "react";
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
  /** Compact layout for narrow contexts (Wochenplaner editor). */
  compact?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatClockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ── OccupiedRoomChip — compact occupied display, selectable with confirm ─────

function OccupiedRoomChip({
  resourceName,
  resourceId,
  annotation,
  isSelected,
  disabled,
  onSelect,
  onDeselect,
  testId,
}: {
  resourceName: string;
  resourceId: string;
  annotation: ResourceAvailabilityAnnotation | undefined;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  testId?: string;
}) {
  const [pendingOccupiedConfirm, setPendingOccupiedConfirm] = useState(false);
  const isSharedSelection = isSelected;

  useEffect(() => {
    if (isSelected) setPendingOccupiedConfirm(false);
  }, [isSelected, resourceId]);

  const conflictTime =
    annotation?.conflictStartAt && annotation?.conflictEndAt
      ? `${formatClockTime(annotation.conflictStartAt)}–${formatClockTime(annotation.conflictEndAt)}`
      : null;

  const rawLabel = annotation?.conflictLabel ?? null;
  const shortLabel = rawLabel && rawLabel.length > 28 ? rawLabel.slice(0, 26) + "…" : rawLabel;

  const handleClick = () => {
    if (disabled) return;
    if (isSelected) {
      onDeselect();
      setPendingOccupiedConfirm(false);
      return;
    }
    setPendingOccupiedConfirm(true);
  };

  const handleConfirmAssign = () => {
    onSelect();
    setPendingOccupiedConfirm(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId ? `${testId}-card-${resourceId}` : undefined}
      aria-pressed={isSelected}
      aria-label={`${resourceName} Belegt`}
      title={rawLabel ?? undefined}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all",
        isSharedSelection
          ? "border-amber-400 bg-amber-50/70 ring-1 ring-amber-300"
          : pendingOccupiedConfirm
            ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-200"
            : "border-rose-200 bg-rose-50/60 hover:border-amber-300",
        disabled ? "cursor-default opacity-50" : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1",
      )}
    >
      <span
        className={cn(
          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full inline-block",
          isSharedSelection ? "bg-amber-500" : "bg-rose-500",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-[var(--foreground)]">{resourceName}</span>
          {isSharedSelection ? (
            <span className="text-[10px] font-medium text-amber-700">Mehrfachbelegung</span>
          ) : (
            <span className="text-[10px] font-medium text-rose-600">Belegt</span>
          )}
        </div>
        {(shortLabel || conflictTime) && (
          <p
            className={cn(
              "text-[10px] leading-tight truncate",
              isSharedSelection ? "text-amber-800" : "text-rose-700",
            )}
          >
            {[shortLabel, conflictTime].filter(Boolean).join(" · ")}
          </p>
        )}
        {pendingOccupiedConfirm && !isSelected && (
          <div className="mt-1 space-y-0.5" data-testid={testId ? `${testId}-occupied-confirm-${resourceId}` : undefined}>
            <p className="text-[10px] leading-tight text-amber-800">
              {resourceName} ist in diesem Zeitraum bereits belegt.
            </p>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmAssign();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfirmAssign();
                }
              }}
              className="inline-flex text-[10px] font-semibold text-[var(--sce-primary)] underline underline-offset-2"
              data-testid={testId ? `${testId}-assign-anyway-${resourceId}` : undefined}
            >
              Trotzdem zuweisen
            </span>
          </div>
        )}
        {isSharedSelection && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--sce-primary)]">
            <Check className="h-2.5 w-2.5" />
            Gewählt
          </span>
        )}
      </div>
    </button>
  );
}

// ── FreeRoomCard ──────────────────────────────────────────────────────────────

type FreeRoomCardProps = {
  resourceName: string;
  resourceId: string;
  annotation: ResourceAvailabilityAnnotation | undefined;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  testId?: string;
  compact?: boolean;
};

function FreeRoomCard({
  resourceName,
  resourceId,
  annotation,
  isSelected,
  disabled,
  onSelect,
  onDeselect,
  testId,
  compact = false,
}: FreeRoomCardProps) {
  const isFree = annotation?.status === "FREE";
  const isNeutral = !annotation;

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (isSelected) onDeselect();
    else onSelect();
  }, [disabled, isSelected, onSelect, onDeselect]);

  const borderClass = isSelected
    ? "border-[var(--sce-primary)] ring-1 ring-[var(--sce-primary)]"
    : isFree
      ? "border-emerald-300 hover:border-emerald-400"
      : "border-[var(--border)]";

  const bgClass = isSelected
    ? "bg-blue-50"
    : "bg-[var(--surface)]";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId ? `${testId}-card-${resourceId}` : undefined}
      aria-pressed={isSelected}
      aria-label={`${resourceName} ${isSelected ? "ausgewählt" : isFree ? "Frei" : ""}`}
      className={cn(
        "group relative flex flex-col items-center rounded-xl border text-center transition-all",
        compact ? "px-2 py-1.5" : "p-3",
        borderClass,
        bgClass,
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1",
      )}
    >
      {/* Selected check */}
      {isSelected && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sce-primary)] text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}

      {/* Room icon — compact or normal */}
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border-2",
          compact ? "mb-1 h-8 w-8" : "mb-2 h-10 w-10",
          isSelected
            ? "border-[var(--sce-primary)] bg-blue-100 text-[var(--sce-primary)]"
            : isFree
              ? "border-emerald-300 bg-emerald-50 text-emerald-600"
              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
        )}
      >
        <DoorOpen className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </div>

      {/* Room name */}
      <p className={cn(
        "font-semibold text-[var(--foreground)] leading-tight",
        compact ? "text-xs" : "text-sm",
      )}>
        {resourceName}
      </p>

      {/* Status */}
      <div className="mt-1 min-h-[1rem]">
        {isNeutral && (
          <p className="text-[10px] text-[var(--muted)]">Zeit wählen</p>
        )}
        {isFree && !isSelected && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            Frei
          </span>
        )}
        {isSelected && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--sce-primary)]">
            <Check className="h-2.5 w-2.5" />
            Gewählt
          </span>
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
        {free} frei
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
  compact = false,
}: VisualDressingRoomPickerProps) {
  const allResources = facilityGroups.flatMap((fg) => fg.resources);
  const hasAvailabilityData = availabilityByResourceId.size > 0;

  if (allResources.length === 0) {
    return <p className="text-sm text-[var(--muted)] italic">{emptyMessage}</p>;
  }

  const handleSelect = (resourceId: string) => {
    if (singleSelect) {
      for (const id of selectedResourceIds) {
        if (id !== resourceId) onDeselect(id);
      }
    }
    onSelect(resourceId);
  };

  const freeAndNeutral = allResources.filter(
    (r) => availabilityByResourceId.get(r.id)?.status !== "OCCUPIED",
  );
  const occupied = allResources.filter(
    (r) => availabilityByResourceId.get(r.id)?.status === "OCCUPIED",
  );

  return (
    <div className="space-y-2.5" data-testid={testId}>
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

      {/* Occupied rooms — compact chip list */}
      {occupied.length > 0 && (
        <div className="space-y-1" data-testid={testId ? `${testId}-occupied` : undefined}>
          {occupied.map((r) => (
            <OccupiedRoomChip
              key={r.id}
              resourceName={r.name}
              resourceId={r.id}
              annotation={availabilityByResourceId.get(r.id)}
              isSelected={selectedResourceIds.has(r.id)}
              disabled={disabled}
              onSelect={() => handleSelect(r.id)}
              onDeselect={() => onDeselect(r.id)}
              testId={testId}
            />
          ))}
        </div>
      )}

      {/* Free / neutral rooms — card grid */}
      {freeAndNeutral.length > 0 && (
        <div
          className={cn(
            "grid gap-2",
            compact
              ? "grid-cols-3 sm:grid-cols-4"
              : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5",
          )}
          data-testid={testId ? `${testId}-grid` : undefined}
        >
          {freeAndNeutral.map((resource) => (
            <FreeRoomCard
              key={resource.id}
              resourceName={resource.name}
              resourceId={resource.id}
              annotation={availabilityByResourceId.get(resource.id)}
              isSelected={selectedResourceIds.has(resource.id)}
              disabled={disabled}
              onSelect={() => handleSelect(resource.id)}
              onDeselect={() => onDeselect(resource.id)}
              testId={testId}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
