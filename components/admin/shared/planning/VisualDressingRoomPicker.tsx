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
import { Check, DoorOpen, X } from "lucide-react";
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
  /**
   * TRAINING-CENTER-PREMIUM-02 — "aggregated" shows free rooms first, then
   * occupied, with section labels. Default "default".
   */
  layout?: "default" | "aggregated";
  /** Label for aggregated available section. */
  availableLabel?: string;
  /** Label for aggregated occupied section. */
  occupiedLabel?: string;
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

// ── SelectedDressingRoomSummary ───────────────────────────────────────────────

function SelectedDressingRoomSummary({
  facilityGroups,
  selectedResourceIds,
  availabilityByResourceId,
  onDeselect,
  testId,
}: {
  facilityGroups: FacilityGroup[];
  selectedResourceIds: Set<string>;
  availabilityByResourceId: Map<string, ResourceAvailabilityAnnotation>;
  onDeselect: (resourceId: string) => void;
  testId?: string;
}) {
  const selected = facilityGroups
    .flatMap((fg) => fg.resources.map((r) => ({ ...r, facilityName: fg.facilityName })))
    .filter((r) => selectedResourceIds.has(r.id));

  if (selected.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-[var(--sce-primary)]/30 bg-blue-50/50 px-3 py-2"
      data-testid={testId ? `${testId}-selected-summary` : undefined}
    >
      {selected.map((resource) => {
        const annotation = availabilityByResourceId.get(resource.id);
        const isFree = annotation?.status === "FREE";
        const isOccupied = annotation?.status === "OCCUPIED";
        return (
          <div key={resource.id} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sce-primary)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-semibold text-[var(--foreground)]">{resource.name}</p>
                <button
                  type="button"
                  onClick={() => onDeselect(resource.id)}
                  aria-label={`${resource.name} entfernen`}
                  data-testid={testId ? `${testId}-remove-${resource.id}` : undefined}
                  className="shrink-0 rounded p-0.5 text-[var(--muted)] transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <p className="text-xs text-[var(--text-2)]">
                {isFree ? "verfügbar" : isOccupied ? "Mehrfachbelegung" : "ausgewählt"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CompactFreeDressingRoomRow ────────────────────────────────────────────────

function CompactFreeDressingRoomRow({
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
  const isFree = annotation?.status === "FREE";
  const isNeutral = !annotation;

  const handleClick = () => {
    if (disabled) return;
    if (isSelected) onDeselect();
    else onSelect();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId ? `${testId}-card-${resourceId}` : undefined}
      aria-pressed={isSelected}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
        isSelected
          ? "border-[var(--sce-primary)] bg-blue-50 ring-1 ring-[var(--sce-primary)]"
          : isFree
            ? "border-emerald-200 bg-[var(--surface)] hover:border-emerald-300"
            : "border-[var(--border)] bg-[var(--surface)]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <DoorOpen className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-[var(--sce-primary)]" : "text-emerald-600")} />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--foreground)]">{resourceName}</span>
      {isNeutral ? (
        <span className="text-[10px] text-[var(--muted)]">Zeit wählen</span>
      ) : isSelected ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--sce-primary)]">
          <Check className="h-2.5 w-2.5" />
          Gewählt
        </span>
      ) : isFree ? (
        <span className="text-[10px] font-medium text-emerald-600">Frei</span>
      ) : null}
    </button>
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
  layout = "default",
  availableLabel = "Verfügbar",
  occupiedLabel = "Belegt",
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

  if (layout === "aggregated") {
    return (
      <div className="space-y-3" data-testid={testId}>
        {label ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
        ) : null}

        <SelectedDressingRoomSummary
          facilityGroups={facilityGroups}
          selectedResourceIds={selectedResourceIds}
          availabilityByResourceId={availabilityByResourceId}
          onDeselect={onDeselect}
          testId={testId}
        />

        {hasAvailabilityData ? (
          <AvailabilitySummary facilityGroups={facilityGroups} availability={availabilityByResourceId} />
        ) : (
          <p className="text-xs text-[var(--text-2)]">Verfügbarkeit erscheint nach Auswahl von Tag &amp; Zeit.</p>
        )}

        {freeAndNeutral.length > 0 ? (
          <div data-testid={testId ? `${testId}-available` : undefined}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {availableLabel}
            </p>
            <div className={cn("grid gap-1.5", "grid-cols-1 sm:grid-cols-2")}>
              {freeAndNeutral.map((resource) => (
                <CompactFreeDressingRoomRow
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
        ) : hasAvailabilityData ? (
          <p className="text-xs text-[var(--muted)]">Keine freien Garderoben für diesen Zeitraum.</p>
        ) : null}

        {occupied.length > 0 ? (
          <div data-testid={testId ? `${testId}-occupied` : undefined}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {occupiedLabel}
            </p>
            <div className="space-y-1">
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
          </div>
        ) : null}
      </div>
    );
  }

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
