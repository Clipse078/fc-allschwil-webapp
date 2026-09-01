"use client";

/**
 * components/admin/shared/planning/VisualResourceAvailabilityPicker.tsx
 *
 * PLANNING-RESOURCE-UX-01 — shared visual resource picker for the complete
 * Planning family (TrainingCenter / MatchCenter / TournamentCenter /
 * Wochenplaner).
 *
 * PLANNING-RESOURCE-UX-01-C2 — corrective UX pass:
 *   - Resources grouped per facility (FULL + HALF_PITCH siblings visually
 *     associated under one facility header, not shown as unrelated cards).
 *   - Occupied cards compact (no large pitch visual, concise conflict label).
 *   - Hall resources rendered with neutral visual when facilityType="INDOOR_HALL".
 *   - Compact mode for narrow contexts (Wochenplaner editor).
 *
 * Conflict detection semantics (full/half pitch):
 *   The availability-service now enforces cross-resource FULL/HALF relationships
 *   server-side — the per-resource status from that service is the authoritative
 *   conflict signal. The picker renders them consistently without a second pass.
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { PitchVisual, type PitchVisualState } from "./PitchVisual";
import type { FacilityResourceType } from "@prisma/client";

// ── Re-export types callers need ──────────────────────────────────────────────

export type { FacilityGroup, ResourceOption } from "@/components/admin/training/FacilityResourceSelector";
export type { ResourceAvailabilityAnnotation } from "@/components/admin/training/FacilityResourceSelector";

import type {
  FacilityGroup,
  ResourceAvailabilityAnnotation,
} from "@/components/admin/training/FacilityResourceSelector";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VisualResourceAvailabilityPickerProps = {
  /** Non-archived resources grouped by facility (same shape as FacilityResourceSelector). */
  facilityGroups: FacilityGroup[];
  /** IDs of currently selected resources. */
  selectedResourceIds: Set<string>;
  /** Called when the user clicks an unselected resource. */
  onSelect: (resourceId: string) => void;
  /** Called when the user clicks an already-selected resource (deselects it). */
  onDeselect: (resourceId: string) => void;
  disabled?: boolean;
  /**
   * Live Frei/Belegt map from useFacilityAvailability / GET /api/facilities/availability.
   * When empty/undefined, all resources render as neutral (availability not yet known).
   */
  availabilityByResourceId?: Map<string, ResourceAvailabilityAnnotation>;
  /** How many recommended free resources to highlight at the top. Default 3. */
  maxRecommended?: number;
  /** When true, only one resource can be selected at a time. Default false. */
  singleSelect?: boolean;
  /** Stable identifier suffix for data-testid attributes. */
  testId?: string;
  /**
   * Nudge label shown above the recommended section.
   * Default: "Empfohlene Spielfelder"
   */
  recommendedLabel?: string;
  /**
   * Label shown above the full resource grid.
   * Default: "Alle Spielfelder"
   */
  allResourcesLabel?: string;
  /**
   * Shown when the tenant has no resources of this type.
   */
  emptyMessage?: string;
  /**
   * PLANNING-RESOURCE-UX-01-C2 — when true, use narrower compact card layout
   * (for Wochenplaner editor context). Default false.
   */
  compact?: boolean;
  /**
   * TRAINING-CENTER-PREMIUM-02 — "aggregated" shows all free resources first,
   * then all occupied, without facility hierarchy grouping. Default "facility".
   */
  layout?: "facility" | "aggregated";
  /** Label for the aggregated available section. */
  availableLabel?: string;
  /** Label for the aggregated occupied section. */
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

function availabilityState(
  annotation: ResourceAvailabilityAnnotation | undefined,
  isSelected: boolean,
): PitchVisualState {
  if (isSelected) return "selected";
  if (!annotation) return "neutral";
  return annotation.status === "FREE" ? "free" : "occupied";
}

/**
 * Deterministic recommendation order:
 * 1. Free (non-occupied) resources first.
 * 2. Within free: HALF_PITCH before FULL_PITCH (avoids wasting a whole
 *    pitch when halves are available).
 * 3. Facility sort order, then name (preserved from DB ordering in facilityGroups).
 */
function recommendFreeResources(
  facilityGroups: FacilityGroup[],
  availability: Map<string, ResourceAvailabilityAnnotation>,
  maxCount: number,
): string[] {
  const free: Array<{ id: string; type: FacilityResourceType; order: number }> = [];
  let order = 0;

  for (const fg of facilityGroups) {
    for (const r of fg.resources) {
      const a = availability.get(r.id);
      if (a && a.status === "FREE") {
        free.push({ id: r.id, type: r.type, order: order++ });
      }
    }
  }

  free.sort((a, b) => {
    if (a.type !== b.type) {
      if (a.type === "HALF_PITCH") return -1;
      if (b.type === "HALF_PITCH") return 1;
    }
    return a.order - b.order;
  });

  return free.slice(0, maxCount).map((r) => r.id);
}

// ── ResourceCard ──────────────────────────────────────────────────────────────

type ResourceCardProps = {
  facilityName: string;
  facilityType?: string;
  resourceName: string;
  resourceId: string;
  resourceType: FacilityResourceType;
  annotation: ResourceAvailabilityAnnotation | undefined;
  isSelected: boolean;
  isRecommended: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  testId?: string;
  compact?: boolean;
};

function ResourceCard({
  facilityName,
  facilityType,
  resourceName,
  resourceId,
  resourceType,
  annotation,
  isSelected,
  isRecommended,
  disabled,
  onSelect,
  onDeselect,
  testId,
  compact = false,
}: ResourceCardProps) {
  const [pendingOccupiedConfirm, setPendingOccupiedConfirm] = useState(false);
  const state = availabilityState(annotation, isSelected);
  const isFree = annotation?.status === "FREE";
  const isOccupied = annotation?.status === "OCCUPIED";
  const isNeutral = !annotation;
  const isSharedSelection = isSelected && isOccupied;

  useEffect(() => {
    if (isSelected || !isOccupied) setPendingOccupiedConfirm(false);
  }, [isSelected, isOccupied, resourceId]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (isSelected) {
      onDeselect();
      setPendingOccupiedConfirm(false);
      return;
    }
    if (isOccupied) {
      setPendingOccupiedConfirm(true);
      return;
    }
    onSelect();
  }, [disabled, isOccupied, isSelected, onSelect, onDeselect]);

  const handleConfirmOccupiedAssign = useCallback(() => {
    onSelect();
    setPendingOccupiedConfirm(false);
  }, [onSelect]);

  const conflictTime =
    annotation?.conflictStartAt && annotation?.conflictEndAt
      ? `${formatClockTime(annotation.conflictStartAt)}–${formatClockTime(annotation.conflictEndAt)}`
      : null;

  const rawLabel = annotation?.conflictLabel ?? null;
  const conflictLabel = rawLabel && rawLabel.length > 32
    ? rawLabel.slice(0, 30) + "…"
    : rawLabel;
  const additionalConflicts = (annotation?.conflicts?.length ?? 0) > 1 ? annotation!.conflicts!.slice(1) : [];
  const isMultiOccupied = additionalConflicts.length > 0;

  const borderClass = isSharedSelection
    ? "border-amber-400 ring-1 ring-amber-300"
    : isSelected
      ? "border-[var(--sce-primary)] ring-1 ring-[var(--sce-primary)]"
      : isFree
        ? "border-emerald-300 hover:border-emerald-400"
        : isOccupied
          ? pendingOccupiedConfirm
            ? "border-amber-300 ring-1 ring-amber-200"
            : "border-rose-200 hover:border-amber-300"
          : "border-[var(--border)]";

  const bgClass = isSharedSelection
    ? "bg-amber-50/70"
    : isSelected
      ? "bg-blue-50"
      : isOccupied
        ? pendingOccupiedConfirm
          ? "bg-amber-50/60"
          : "bg-rose-50/40"
        : "bg-[var(--surface)]";

  const isClickable = !disabled;

  // Occupied cards: compact horizontal layout — selectable with lightweight confirm
  if (isOccupied) {
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
          "relative flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
          borderClass,
          bgClass,
          isClickable
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1"
            : "cursor-default opacity-50",
        )}
      >
        <span
          className={cn(
            "mt-0.5 h-2 w-2 shrink-0 rounded-full inline-block",
            isSharedSelection ? "bg-amber-500" : "bg-rose-500",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight text-[var(--foreground)] truncate">{resourceName}</p>
          {isSharedSelection ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
              Mehrfachbelegung
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">Belegt</span>
          )}
          {isMultiOccupied ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">Mehrfach belegt</span>
          ) : null}
          {conflictLabel && (
            <p
              className={cn(
                "text-[10px] leading-tight truncate",
                isSharedSelection || isMultiOccupied ? "text-amber-800" : "text-amber-800",
              )}
            >
              {conflictLabel}
            </p>
          )}
          {conflictTime && (
            <p className={cn("text-[10px]", isSharedSelection || isMultiOccupied ? "text-amber-700" : "text-amber-700")}>
              {conflictTime}
            </p>
          )}
          {additionalConflicts.map((conflict, index) => {
            const extraTime =
              conflict.startAt && conflict.endAt
                ? `${formatClockTime(conflict.startAt)}–${formatClockTime(conflict.endAt)}`
                : null;
            return (
              <p key={`${conflict.label}-${index}`} className="text-[10px] leading-tight text-amber-700 truncate">
                {[conflict.label, extraTime].filter(Boolean).join(" · ")}
              </p>
            );
          })}
          {pendingOccupiedConfirm && !isSelected && (
            <div className="mt-1.5 space-y-1" data-testid={testId ? `${testId}-occupied-confirm-${resourceId}` : undefined}>
              <p className="text-[10px] leading-tight text-amber-800">
                {resourceName} ist in diesem Zeitraum bereits belegt.
              </p>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmOccupiedAssign();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirmOccupiedAssign();
                  }
                }}
                className="inline-flex text-[10px] font-semibold text-[var(--sce-primary)] underline underline-offset-2 hover:text-[var(--sce-primary)]"
                data-testid={testId ? `${testId}-assign-anyway-${resourceId}` : undefined}
              >
                Trotzdem zuweisen
              </span>
            </div>
          )}
          {isSharedSelection && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--sce-primary)]">
              <Check className="h-2.5 w-2.5" />
              Ausgewählt
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId ? `${testId}-card-${resourceId}` : undefined}
      aria-pressed={isSelected}
      aria-label={`${resourceName} ${isSelected ? "ausgewählt" : isFree ? "Frei" : ""}`}
      className={cn(
        "group relative flex w-full flex-col rounded-xl border p-2.5 text-left transition-all",
        borderClass,
        bgClass,
        isClickable ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1" : "cursor-default",
        disabled && "opacity-50",
      )}
    >
      {/* Recommended badge */}
      {isRecommended && (
        <span className="absolute -top-2 left-2 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
          <Star className="h-2 w-2" />
          Empfohlen
        </span>
      )}

      {/* Selected check */}
      {isSelected && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sce-primary)] text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}

      {/* Pitch/hall visual — compact size */}
      <div className="mb-1.5 flex justify-center">
        <PitchVisual
          resourceType={resourceType}
          resourceName={resourceName}
          state={state}
          compact
          facilityType={facilityType}
        />
      </div>

      {/* Resource name only (facility shown as section header above) */}
      <p className="text-xs font-semibold leading-tight text-[var(--foreground)] truncate">{resourceName}</p>

      {/* Status */}
      <div className="mt-1">
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
            Ausgewählt
          </span>
        )}
      </div>

      {/* Action hint */}
      {isFree && !isSelected && !disabled && (
        <p className="mt-1 text-[10px] font-medium text-[var(--sce-primary)] opacity-0 transition-opacity group-hover:opacity-100">
          Auswählen →
        </p>
      )}
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
  const { free, occupied, total } = useMemo(() => {
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
    return { free, occupied, total: free + occupied };
  }, [facilityGroups, availability]);

  if (total === 0) {
    return (
      <p className="text-xs text-[var(--text-2)]">
        Verfügbarkeit erscheint nach Auswahl von Tag &amp; Zeit.
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs font-medium">
      <span className="flex items-center gap-1 text-emerald-600">
        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
        {free} frei
      </span>
      {occupied > 0 && (
        <>
          <span className="text-[var(--muted)]">·</span>
          <span className="flex items-center gap-1 text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
            {occupied} belegt
          </span>
        </>
      )}
    </p>
  );
}

// ── Aggregated layout helpers ─────────────────────────────────────────────────

type FlatResourceEntry = {
  id: string;
  name: string;
  type: FacilityResourceType;
  facilityId: string;
  facilityName: string;
  facilityType?: string;
  order: number;
};

function flattenFacilityResources(facilityGroups: FacilityGroup[]): FlatResourceEntry[] {
  const entries: FlatResourceEntry[] = [];
  let order = 0;
  for (const fg of facilityGroups) {
    for (const r of fg.resources) {
      entries.push({
        id: r.id,
        name: r.name,
        type: r.type,
        facilityId: fg.facilityId,
        facilityName: fg.facilityName,
        facilityType: fg.facilityType ?? r.facilityType,
        order: order++,
      });
    }
  }
  return entries;
}

function sortFlatResources(entries: FlatResourceEntry[]): FlatResourceEntry[] {
  return [...entries].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "de"));
}

// ── CompactFreeResourceRow ────────────────────────────────────────────────────

function CompactFreeResourceRow({
  entry,
  annotation,
  isSelected,
  disabled,
  onSelect,
  onDeselect,
  testId,
}: {
  entry: FlatResourceEntry;
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

  const showFacilityContext = entry.name !== entry.facilityName;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId ? `${testId}-card-${entry.id}` : undefined}
      aria-pressed={isSelected}
      aria-label={`${entry.name} ${isSelected ? "ausgewählt" : isFree ? "Frei" : ""}`}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
        isSelected
          ? "border-[var(--sce-primary)] bg-blue-50 ring-1 ring-[var(--sce-primary)]"
          : isFree
            ? "border-emerald-200 bg-[var(--surface)] hover:border-emerald-300 hover:bg-emerald-50/40"
            : "border-[var(--border)] bg-[var(--surface)]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          isSelected ? "bg-[var(--sce-primary)]" : isFree ? "bg-emerald-500" : "bg-[var(--muted)]",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--foreground)]">{entry.name}</p>
        {showFacilityContext ? (
          <p className="truncate text-[10px] text-[var(--muted)]">{entry.facilityName}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
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
      </div>
    </button>
  );
}

// ── SelectedResourceSummary ───────────────────────────────────────────────────

function SelectedResourceSummary({
  facilityGroups,
  selectedResourceIds,
  availabilityByResourceId,
  testId,
}: {
  facilityGroups: FacilityGroup[];
  selectedResourceIds: Set<string>;
  availabilityByResourceId: Map<string, ResourceAvailabilityAnnotation>;
  testId?: string;
}) {
  const selected = flattenFacilityResources(facilityGroups).filter((r) => selectedResourceIds.has(r.id));
  if (selected.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-[var(--sce-primary)]/30 bg-blue-50/50 px-3 py-2"
      data-testid={testId ? `${testId}-selected-summary` : undefined}
    >
      {selected.map((entry) => {
        const annotation = availabilityByResourceId.get(entry.id);
        const isFree = annotation?.status === "FREE";
        const isOccupied = annotation?.status === "OCCUPIED";
        return (
          <div key={entry.id} className="flex items-center gap-2 text-sm">
            <Check className="h-3.5 w-3.5 shrink-0 text-[var(--sce-primary)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--foreground)]">{entry.name}</p>
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

// ── AggregatedLayout ──────────────────────────────────────────────────────────

function AggregatedLayout({
  facilityGroups,
  selectedResourceIds,
  availabilityByResourceId,
  disabled,
  onSelect,
  onDeselect,
  testId,
  availableLabel,
  occupiedLabel,
}: {
  facilityGroups: FacilityGroup[];
  selectedResourceIds: Set<string>;
  availabilityByResourceId: Map<string, ResourceAvailabilityAnnotation>;
  disabled: boolean;
  onSelect: (id: string) => void;
  onDeselect: (id: string) => void;
  testId?: string;
  availableLabel: string;
  occupiedLabel: string;
}) {
  const allEntries = useMemo(() => sortFlatResources(flattenFacilityResources(facilityGroups)), [facilityGroups]);
  const hasAvailabilityData = availabilityByResourceId.size > 0;

  const available = allEntries.filter((r) => {
    const status = availabilityByResourceId.get(r.id)?.status;
    return !hasAvailabilityData || status === "FREE" || !availabilityByResourceId.has(r.id);
  });
  const occupied = allEntries.filter((r) => availabilityByResourceId.get(r.id)?.status === "OCCUPIED");

  return (
    <div className="space-y-3">
      <SelectedResourceSummary
        facilityGroups={facilityGroups}
        selectedResourceIds={selectedResourceIds}
        availabilityByResourceId={availabilityByResourceId}
        testId={testId}
      />

      {hasAvailabilityData ? (
        <div data-testid={testId ? `${testId}-summary` : undefined}>
          <AvailabilitySummary facilityGroups={facilityGroups} availability={availabilityByResourceId} />
        </div>
      ) : (
        <p className="text-xs text-[var(--text-2)]">Verfügbarkeit erscheint nach Auswahl von Tag &amp; Zeit.</p>
      )}

      {available.length > 0 ? (
        <div data-testid={testId ? `${testId}-available` : undefined}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            {availableLabel}
          </p>
          <div className={cn("grid gap-1.5", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
            {available.map((entry) => (
              <CompactFreeResourceRow
                key={entry.id}
                entry={entry}
                annotation={availabilityByResourceId.get(entry.id)}
                isSelected={selectedResourceIds.has(entry.id)}
                disabled={disabled}
                onSelect={() => onSelect(entry.id)}
                onDeselect={() => onDeselect(entry.id)}
                testId={testId}
              />
            ))}
          </div>
        </div>
      ) : hasAvailabilityData ? (
        <p className="text-xs text-[var(--muted)]">Keine freien Spielfelder / Hallen für diesen Zeitraum.</p>
      ) : null}

      {occupied.length > 0 ? (
        <div data-testid={testId ? `${testId}-occupied` : undefined}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {occupiedLabel}
          </p>
          <div className="space-y-1">
            {occupied.map((entry) => (
              <ResourceCard
                key={entry.id}
                facilityName={entry.facilityName}
                facilityType={entry.facilityType}
                resourceName={entry.name}
                resourceId={entry.id}
                resourceType={entry.type}
                annotation={availabilityByResourceId.get(entry.id)}
                isSelected={selectedResourceIds.has(entry.id)}
                isRecommended={false}
                disabled={disabled}
                onSelect={() => onSelect(entry.id)}
                onDeselect={() => onDeselect(entry.id)}
                testId={testId}
                compact
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── FacilitySection ───────────────────────────────────────────────────────────

/**
 * Renders one facility group with a header and a grid of resource cards.
 * Groups FULL_PITCH + HALF_PITCH siblings visually under one facility banner.
 */
type FacilitySectionProps = {
  group: FacilityGroup;
  selectedResourceIds: Set<string>;
  availabilityByResourceId: Map<string, ResourceAvailabilityAnnotation>;
  recommendedIds: Set<string>;
  disabled: boolean;
  onSelect: (id: string) => void;
  onDeselect: (id: string) => void;
  testId?: string;
  compact?: boolean;
};

function FacilitySection({
  group,
  selectedResourceIds,
  availabilityByResourceId,
  recommendedIds,
  disabled,
  onSelect,
  onDeselect,
  testId,
  compact = false,
}: FacilitySectionProps) {
  const freeResources = group.resources.filter(
    (r) => availabilityByResourceId.get(r.id)?.status === "FREE" && !recommendedIds.has(r.id),
  );
  const occupiedResources = group.resources.filter((r) => availabilityByResourceId.get(r.id)?.status === "OCCUPIED");
  const neutralResources = group.resources.filter((r) => !availabilityByResourceId.has(r.id));

  // Show occupied resources first in a compact horizontal list, then free/neutral as cards
  // Recommended resources are excluded from freeResources (shown in the strip above).
  const selectableResources = [...freeResources, ...neutralResources];

  return (
    <div className="space-y-2">
      {/* Facility header */}
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {group.facilityName}
        </p>
        {group.facilityType === "INDOOR_HALL" && (
          <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Halle
          </span>
        )}
      </div>

      {/* Occupied: compact horizontal strip */}
      {occupiedResources.length > 0 && (
        <div className="space-y-1">
          {occupiedResources.map((r) => (
            <ResourceCard
              key={r.id}
              facilityName={group.facilityName}
              facilityType={group.facilityType ?? r.facilityType}
              resourceName={r.name}
              resourceId={r.id}
              resourceType={r.type}
              annotation={availabilityByResourceId.get(r.id)}
              isSelected={selectedResourceIds.has(r.id)}
              isRecommended={false}
              disabled={disabled}
              onSelect={() => onSelect(r.id)}
              onDeselect={() => onDeselect(r.id)}
              testId={testId}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Selectable: card grid */}
      {selectableResources.length > 0 && (
        <div className={cn(
          "grid gap-2",
          compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
        )}>
          {selectableResources.map((r) => (
            <ResourceCard
              key={r.id}
              facilityName={group.facilityName}
              facilityType={group.facilityType ?? r.facilityType}
              resourceName={r.name}
              resourceId={r.id}
              resourceType={r.type}
              annotation={availabilityByResourceId.get(r.id)}
              isSelected={selectedResourceIds.has(r.id)}
              isRecommended={recommendedIds.has(r.id)}
              disabled={disabled}
              onSelect={() => onSelect(r.id)}
              onDeselect={() => onDeselect(r.id)}
              testId={testId}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function VisualResourceAvailabilityPicker({
  facilityGroups,
  selectedResourceIds,
  onSelect,
  onDeselect,
  disabled = false,
  availabilityByResourceId = new Map(),
  maxRecommended = 3,
  testId,
  recommendedLabel = "Empfohlene Spielfelder",
  allResourcesLabel = "Alle Spielfelder",
  emptyMessage = "Keine Spielfelder / Hallen konfiguriert.",
  compact = false,
  layout = "facility",
  availableLabel = "Verfügbar",
  occupiedLabel = "Belegt",
}: VisualResourceAvailabilityPickerProps) {
  const allResources = useMemo(
    () => facilityGroups.flatMap((fg) => fg.resources),
    [facilityGroups],
  );

  const hasAvailabilityData = availabilityByResourceId.size > 0;

  const recommendedIds = useMemo(
    () =>
      hasAvailabilityData
        ? new Set(recommendFreeResources(facilityGroups, availabilityByResourceId, maxRecommended))
        : new Set<string>(),
    [facilityGroups, availabilityByResourceId, hasAvailabilityData, maxRecommended],
  );

  if (allResources.length === 0) {
    return <p className="text-sm text-[var(--muted)] italic">{emptyMessage}</p>;
  }

  if (layout === "aggregated") {
    return (
      <div data-testid={testId}>
        <AggregatedLayout
          facilityGroups={facilityGroups}
          selectedResourceIds={selectedResourceIds}
          availabilityByResourceId={availabilityByResourceId}
          disabled={disabled}
          onSelect={onSelect}
          onDeselect={onDeselect}
          testId={testId}
          availableLabel={availableLabel}
          occupiedLabel={occupiedLabel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid={testId}>
      {/* Availability summary */}
      <div data-testid={testId ? `${testId}-summary` : undefined}>
        <AvailabilitySummary facilityGroups={facilityGroups} availability={availabilityByResourceId} />
      </div>

      {/* Recommended strip — only shown when availability data is present */}
      {hasAvailabilityData && recommendedIds.size > 0 && (
        <div data-testid={testId ? `${testId}-recommended` : undefined}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {recommendedLabel}
          </p>
          <div className={cn(
            "grid gap-2",
            compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
          )}>
            {facilityGroups.flatMap((fg) =>
              fg.resources
                .filter((r) => recommendedIds.has(r.id))
                .map((r) => (
                  <ResourceCard
                    key={r.id}
                    facilityName={fg.facilityName}
                    facilityType={fg.facilityType ?? r.facilityType}
                    resourceName={r.name}
                    resourceId={r.id}
                    resourceType={r.type}
                    annotation={availabilityByResourceId.get(r.id)}
                    isSelected={selectedResourceIds.has(r.id)}
                    isRecommended={true}
                    disabled={disabled}
                    onSelect={() => onSelect(r.id)}
                    onDeselect={() => onDeselect(r.id)}
                    testId={testId}
                    compact={compact}
                  />
                ))
            )}
          </div>
        </div>
      )}

      {/* All resources — grouped per facility, with facility hierarchy */}
      <div
        className="space-y-4"
        data-testid={testId ? `${testId}-all` : undefined}
      >
        {hasAvailabilityData && recommendedIds.size > 0 && (
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {allResourcesLabel}
          </p>
        )}
        {facilityGroups.map((fg) => (
          <FacilitySection
            key={fg.facilityId}
            group={fg}
            selectedResourceIds={selectedResourceIds}
            availabilityByResourceId={availabilityByResourceId}
            recommendedIds={recommendedIds}
            disabled={disabled}
            onSelect={onSelect}
            onDeselect={onDeselect}
            testId={testId}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
