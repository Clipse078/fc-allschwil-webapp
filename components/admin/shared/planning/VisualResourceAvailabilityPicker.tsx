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

import { useMemo, useCallback } from "react";
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
  const state = availabilityState(annotation, isSelected);
  const isFree = annotation?.status === "FREE";
  const isOccupied = annotation?.status === "OCCUPIED";
  const isNeutral = !annotation;

  const handleClick = useCallback(() => {
    if (disabled || isOccupied) return;
    if (isSelected) onDeselect();
    else onSelect();
  }, [disabled, isOccupied, isSelected, onSelect, onDeselect]);

  const conflictTime =
    annotation?.conflictStartAt && annotation?.conflictEndAt
      ? `${formatClockTime(annotation.conflictStartAt)}–${formatClockTime(annotation.conflictEndAt)}`
      : null;

  // Truncate the conflict label to max ~30 chars for display
  const rawLabel = annotation?.conflictLabel ?? null;
  const conflictLabel = rawLabel && rawLabel.length > 32
    ? rawLabel.slice(0, 30) + "…"
    : rawLabel;

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
      ? "bg-rose-50/40"
      : "bg-[var(--surface)]";

  const isClickable = !disabled && !isOccupied;

  // Occupied cards: compact horizontal layout — no large pitch visual
  if (isOccupied) {
    return (
      <div
        data-testid={testId ? `${testId}-card-${resourceId}` : undefined}
        className={cn(
          "relative flex w-full items-start gap-2 rounded-lg border px-2.5 py-2",
          borderClass,
          bgClass,
        )}
        title={rawLabel ?? undefined}
      >
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-500 inline-block" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight text-[var(--foreground)] truncate">{resourceName}</p>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600">Belegt</span>
          {conflictLabel && (
            <p className="text-[10px] leading-tight text-rose-700 truncate">{conflictLabel}</p>
          )}
          {conflictTime && (
            <p className="text-[10px] text-rose-600">{conflictTime}</p>
          )}
        </div>
      </div>
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
