/**
 * lib/transport/transport-direction-groups.ts
 *
 * Generic direction-group classification for Infoboard transport departures.
 *
 * Classification runs in the normalized/config layer — UI receives pre-grouped
 * departures and must not implement destination string matching.
 */

import type { TransportDirectionGroupConfig } from "./transport-config";
import type { TransportDeparture, TransportDirectionGroup } from "./transport-types";

function effectiveDepartureMs(departure: TransportDeparture): number {
  const value = departure.realtimeDeparture ?? departure.plannedDeparture;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sortChronologically(departures: TransportDeparture[]): TransportDeparture[] {
  return [...departures].sort((a, b) => effectiveDepartureMs(a) - effectiveDepartureMs(b));
}

function normalizeMatchValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchesAny(value: string, matchers: string[] | undefined): boolean {
  if (!matchers || matchers.length === 0) {
    return false;
  }

  const normalizedValue = normalizeMatchValue(value);
  return matchers.some((matcher) => normalizedValue.includes(normalizeMatchValue(matcher)));
}

/**
 * Resolves the configured direction group for a single departure.
 *
 * Prefers provider next-stop topology, then direction/headsign, then destination fallback.
 */
export function resolveDepartureDirectionGroupId(
  departure: TransportDeparture,
  groups: TransportDirectionGroupConfig[],
): string | null {
  if (departure.nextStopName) {
    for (const group of groups) {
      if (matchesAny(departure.nextStopName, group.nextStopMatchers)) {
        return group.id;
      }
    }
  }

  if (departure.nextStopId) {
    for (const group of groups) {
      if (matchesAny(departure.nextStopId, group.nextStopIdMatchers)) {
        return group.id;
      }
    }
  }

  const providerDirection = departure.direction ?? departure.destination;

  for (const group of groups) {
    if (matchesAny(providerDirection, group.providerDirectionMatchers)) {
      return group.id;
    }
  }

  for (const group of groups) {
    if (matchesAny(departure.destination, group.destinationMatchers)) {
      return group.id;
    }
  }

  return null;
}

/**
 * Classifies departures into stable tenant-configured direction groups.
 * Each group is sorted chronologically by effective realtime departure.
 */
export function classifyDeparturesIntoDirectionGroups(
  departures: TransportDeparture[],
  groups: TransportDirectionGroupConfig[] | undefined,
  departuresPerGroup?: number,
): TransportDirectionGroup[] {
  if (!groups || groups.length === 0) {
    return [];
  }

  const grouped = new Map<string, TransportDeparture[]>(
    groups.map((group) => [group.id, []]),
  );

  for (const departure of departures) {
    const groupId = resolveDepartureDirectionGroupId(departure, groups);
    if (!groupId) {
      continue;
    }

    grouped.get(groupId)?.push(departure);
  }

  const limit = departuresPerGroup ?? Number.POSITIVE_INFINITY;

  return groups.map((group) => ({
    id: group.id,
    displayName: group.displayName,
    orientation: group.orientation,
    departures: sortChronologically(grouped.get(group.id) ?? []).slice(0, limit),
  }));
}
