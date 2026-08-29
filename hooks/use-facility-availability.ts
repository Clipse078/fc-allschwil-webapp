"use client";

/**
 * hooks/use-facility-availability.ts
 *
 * RESOURCE-AVAILABILITY-UX-01 — single shared client hook wrapping
 * GET /api/facilities/availability for BOTH allocation groups
 * (Spielfeld/Halle + Garderobe) at once.
 *
 * PLANNING-CREATION-UX-01A/-01B/-01C already introduced this exact fetch
 * shape independently inside TournamentCreateForm, TrainingSeriesCreateForm,
 * and MatchCreateForm. This hook is the "smallest shared helper" extraction
 * point for every additional (edit-mode) surface this slice wires in
 * (TrainingSessionAllocationEditor, MatchcenterDetailOperational,
 * TournamentEditForm) — new call sites use this hook instead of
 * re-duplicating the effect a fourth/fifth/sixth time.
 *
 * Neutral-state contract: while `enabled` is false or `startAt` is empty,
 * both maps are empty (no fetch happens) — callers get a clean neutral
 * selector state before a usable date/time range exists, per module spec.
 */

import { useEffect, useState } from "react";
import type { ResourceAvailabilityAnnotation } from "@/components/admin/training/FacilityResourceSelector";

/** Shape of one row in GET /api/facilities/availability's `availability` array. */
type ResourceAvailabilityRow = ResourceAvailabilityAnnotation & { resourceId: string; resourceCode: string };

export type UseFacilityAvailabilityOptions = {
  /** Gate — e.g. `homeAway === "HOME"`. When false, no fetch runs and both maps are cleared. */
  enabled: boolean;
  /** Any value `new Date(...)` can parse (ISO string or a `datetime-local` input value). Empty string ⇒ neutral state. */
  startAt: string;
  endAt?: string | null;
  /** Excludes bookings belonging to this Event (Match/Tournament edit-mode self-exclusion). */
  excludeEventId?: string;
  /** Excludes this TrainingSession's own occurrence (TrainingSession edit-mode self-exclusion). */
  excludeTrainingSessionId?: string;
  /** WOCHENPLAN-2.0-01H-E2 — prospective occupancy buffers for the query window. */
  occupancyBeforeMinutes?: number;
  occupancyAfterMinutes?: number;
  /** WOCHENPLAN-2.0-01H-E2 — weekplanner plan context for effective-state availability. */
  weekplannerPlanId?: string;
  excludeWeekplannerActivityType?: "TRAINING" | "MATCH" | "TOURNAMENT";
  excludeWeekplannerActivityId?: string;
  /**
   * Which field of each availability row to key the returned maps by.
   * "id" (default) suits id-based selectors (FacilityResourceSelector).
   * "code" suits legacy string-code native <select> controls (MatchCenter).
   */
  keyBy?: "id" | "code";
};

export type FacilityAvailabilityMaps = {
  pitchAvailability: Map<string, ResourceAvailabilityAnnotation>;
  dressingRoomAvailability: Map<string, ResourceAvailabilityAnnotation>;
};

const EMPTY_AVAILABILITY_MAP = new Map<string, ResourceAvailabilityAnnotation>();

async function fetchAvailabilityGroup(
  group: "PITCH_HALL" | "DRESSING_ROOM",
  params: URLSearchParams,
  keyBy: "id" | "code",
): Promise<Map<string, ResourceAvailabilityAnnotation>> {
  try {
    const res = await fetch(`/api/facilities/availability?${params.toString()}&group=${group}`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { availability?: ResourceAvailabilityRow[] } | null;
    if (!res.ok || !data?.availability) return new Map();
    return new Map(data.availability.map((a) => [keyBy === "code" ? a.resourceCode : a.resourceId, a]));
  } catch {
    return new Map();
  }
}

/**
 * Live Frei/Belegt availability for the currently selected date/time,
 * reusing lib/facilities/availability-service.ts via the existing
 * GET /api/facilities/availability endpoint — never a second engine.
 */
export function useFacilityAvailability({
  enabled,
  startAt,
  endAt,
  excludeEventId,
  excludeTrainingSessionId,
  occupancyBeforeMinutes,
  occupancyAfterMinutes,
  weekplannerPlanId,
  excludeWeekplannerActivityType,
  excludeWeekplannerActivityId,
  keyBy = "id",
}: UseFacilityAvailabilityOptions): FacilityAvailabilityMaps {
  const [pitchAvailability, setPitchAvailability] = useState<Map<string, ResourceAvailabilityAnnotation>>(
    () => new Map(),
  );
  const [dressingRoomAvailability, setDressingRoomAvailability] = useState<
    Map<string, ResourceAvailabilityAnnotation>
  >(() => new Map());

  const isActive = enabled && !!startAt;

  useEffect(() => {
    // Neutral state (no usable date/time range yet, or gated off) is
    // expressed by masking the return value below rather than resetting
    // state synchronously here — avoids a same-tick setState-in-effect and
    // simply leaves the last fetched maps in memory, unused, until enabled
    // again.
    if (!isActive) return;

    let active = true;

    async function loadAvailability() {
      const params = new URLSearchParams({ startAt });
      if (endAt) params.set("endAt", endAt);
      if (excludeEventId) params.set("excludeEventId", excludeEventId);
      if (excludeTrainingSessionId) params.set("excludeTrainingSessionId", excludeTrainingSessionId);
      if (weekplannerPlanId) params.set("weekplannerPlanId", weekplannerPlanId);
      if (excludeWeekplannerActivityType) params.set("excludeWeekplannerActivityType", excludeWeekplannerActivityType);
      if (excludeWeekplannerActivityId) params.set("excludeWeekplannerActivityId", excludeWeekplannerActivityId);
      if (occupancyBeforeMinutes != null) params.set("occupancyBeforeMinutes", String(occupancyBeforeMinutes));
      if (occupancyAfterMinutes != null) params.set("occupancyAfterMinutes", String(occupancyAfterMinutes));

      const [pitch, room] = await Promise.all([
        fetchAvailabilityGroup("PITCH_HALL", params, keyBy),
        fetchAvailabilityGroup("DRESSING_ROOM", params, keyBy),
      ]);
      if (!active) return;
      setPitchAvailability(pitch);
      setDressingRoomAvailability(room);
    }

    loadAvailability();

    return () => {
      active = false;
    };
  }, [
    isActive,
    startAt,
    endAt,
    excludeEventId,
    excludeTrainingSessionId,
    occupancyBeforeMinutes,
    occupancyAfterMinutes,
    weekplannerPlanId,
    excludeWeekplannerActivityType,
    excludeWeekplannerActivityId,
    keyBy,
  ]);

  if (!isActive) {
    return { pitchAvailability: EMPTY_AVAILABILITY_MAP, dressingRoomAvailability: EMPTY_AVAILABILITY_MAP };
  }
  return { pitchAvailability, dressingRoomAvailability };
}
