"use client";

/**
 * components/admin/shared/planning/VisualResourceAvailabilityPicker.tsx
 *
 * PLANNING-RESOURCE-UX-01 — shared visual resource picker for the complete
 * Planning family (TrainingCenter / MatchCenter / TournamentCenter /
 * Wochenplaner).
 *
 * Replaces the dropdown-based FacilityResourceSelector with:
 *   1. A compact availability summary ("3 verfügbar · 4 belegt") shown as
 *      soon as date/time are known.
 *   2. "Empfohlene Spielfelder" — the top 2–3 free resources as prominent
 *      visual cards with football-pitch representation.
 *   3. "Alle Spielfelder" — the complete list, occupied resources remain
 *      visible with team/activity/time, never hidden.
 *   4. Consistent Frei / Belegt / Ausgewählt states, derived from the same
 *      availability map already produced by useFacilityAvailability /
 *      lib/facilities/availability-service.ts — no second engine.
 *
 * This component is additive: all data comes from props (FacilityGroup[],
 * availabilityByResourceId Map) that every existing create-form already
 * computes. No additional fetching is introduced here.
 *
 * Conflict detection semantics (full/half pitch):
 *   - The availability-service already surfaces whole-pitch conflicts
 *     caused by either half being allocated — the per-resource status
 *     from that service is the authoritative conflict signal.
 *   - The picker renders them consistently without any second conflict pass.
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
 *    pitch when halves are available) — unless the caller has already
 *    selected a full-pitch context.
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
    // Prefer HALF_PITCH (less wasteful)
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
};

function ResourceCard({
  facilityName,
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

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isOccupied}
      data-testid={testId ? `${testId}-card-${resourceId}` : undefined}
      aria-pressed={isSelected}
      aria-label={`${resourceName} ${isSelected ? "ausgewählt" : isFree ? "Frei" : isOccupied ? "Belegt" : ""}`}
      className={cn(
        "group relative flex w-full flex-col rounded-xl border p-3 text-left transition-all",
        borderClass,
        bgClass,
        isClickable ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1" : "cursor-default",
        disabled && !isOccupied && "opacity-50",
      )}
    >
      {/* Recommended badge */}
      {isRecommended && (
        <span className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <Star className="h-2.5 w-2.5" />
          Empfohlen
        </span>
      )}

      {/* Selected check */}
      {isSelected && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--sce-primary)] text-white">
          <Check className="h-3 w-3" />
        </span>
      )}

      {/* Pitch visual */}
      <div className="mb-2 flex justify-center">
        <PitchVisual resourceType={resourceType} resourceName={resourceName} state={state} />
      </div>

      {/* Names */}
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{facilityName}</p>
      <p className="mt-0.5 text-sm font-semibold leading-tight text-[var(--foreground)]">{resourceName}</p>

      {/* Status */}
      <div className="mt-1.5">
        {isNeutral && (
          <p className="text-xs text-[var(--muted)]">Verfügbarkeit nach Zeit</p>
        )}
        {isFree && !isSelected && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            Frei
          </span>
        )}
        {isSelected && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sce-primary)]">
            <Check className="h-3 w-3" />
            Ausgewählt
          </span>
        )}
        {isOccupied && (
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
              Belegt
            </span>
            {annotation?.conflictLabel && (
              <p className="mt-0.5 text-[11px] leading-tight text-rose-700 font-medium truncate" title={annotation.conflictLabel}>
                {annotation.conflictLabel}
              </p>
            )}
            {conflictTime && (
              <p className="text-[11px] text-rose-600">{conflictTime}</p>
            )}
          </div>
        )}
      </div>

      {/* Action hint */}
      {isFree && !isSelected && !disabled && (
        <p className="mt-2 text-[11px] font-medium text-[var(--sce-primary)] opacity-0 transition-opacity group-hover:opacity-100">
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

  const recommendedResources = useMemo(
    () => allResources.filter((r) => recommendedIds.has(r.id)),
    [allResources, recommendedIds],
  );

  const nonRecommendedResources = useMemo(
    () => allResources.filter((r) => !recommendedIds.has(r.id)),
    [allResources, recommendedIds],
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

      {/* Recommended resources */}
      {hasAvailabilityData && recommendedResources.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {recommendedLabel}
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-testid={testId ? `${testId}-recommended` : undefined}>
            {recommendedResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                facilityName={resource.facilityName}
                resourceName={resource.name}
                resourceId={resource.id}
                resourceType={resource.type}
                annotation={availabilityByResourceId.get(resource.id)}
                isSelected={selectedResourceIds.has(resource.id)}
                isRecommended={true}
                disabled={disabled}
                onSelect={() => onSelect(resource.id)}
                onDeselect={() => onDeselect(resource.id)}
                testId={testId}
              />
            ))}
          </div>
        </div>
      )}

      {/* All resources (non-recommended) — only rendered when there IS availability data */}
      {hasAvailabilityData && nonRecommendedResources.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {recommendedResources.length > 0 ? allResourcesLabel : "Spielfelder / Hallen"}
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-testid={testId ? `${testId}-all` : undefined}>
            {nonRecommendedResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                facilityName={resource.facilityName}
                resourceName={resource.name}
                resourceId={resource.id}
                resourceType={resource.type}
                annotation={availabilityByResourceId.get(resource.id)}
                isSelected={selectedResourceIds.has(resource.id)}
                isRecommended={false}
                disabled={disabled}
                onSelect={() => onSelect(resource.id)}
                onDeselect={() => onDeselect(resource.id)}
                testId={testId}
              />
            ))}
          </div>
        </div>
      )}

      {/* No availability data yet — show all resources as neutral */}
      {!hasAvailabilityData && allResources.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-testid={testId ? `${testId}-all` : undefined}>
          {allResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              facilityName={resource.facilityName}
              resourceName={resource.name}
              resourceId={resource.id}
              resourceType={resource.type}
              annotation={availabilityByResourceId.get(resource.id)}
              isSelected={selectedResourceIds.has(resource.id)}
              isRecommended={false}
              disabled={disabled}
              onSelect={() => onSelect(resource.id)}
              onDeselect={() => onDeselect(resource.id)}
              testId={testId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
