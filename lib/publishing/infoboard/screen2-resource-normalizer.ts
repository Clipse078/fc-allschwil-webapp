/**
 * lib/publishing/infoboard/screen2-resource-normalizer.ts
 *
 * Pure, synchronous resource normalization for Infoboard Screen 2.
 *
 * Accepts raw FacilityResource rows and produces an ordered list of
 * Screen2DisplayResource entries suitable for use as Screen 2 map fields.
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No environment variable access, no time access, no logging.
 *   - Inputs are never mutated.
 *   - Result arrays are always new arrays.
 *   - No hardcoded tenant IDs, facility IDs, or resource IDs.
 *   - No string-similarity heuristics.
 *
 * Filtering rules:
 *   - Excludes resources with type "DRESSING_ROOM".
 *   - Excludes resources with status "ARCHIVED" or "INACTIVE".
 *   - All other FacilityResourceType values (FULL_PITCH, HALF_PITCH, OTHER)
 *     are included as potential map fields.
 *
 * Map-key derivation (deterministic, tenant-agnostic):
 *   1. Take FacilityResource.code.
 *   2. Convert to uppercase.
 *   3. Replace all runs of non-alphanumeric characters with a single underscore.
 *   4. Trim leading and trailing underscores.
 *   5. Return null when the result is empty.
 *
 * Examples:
 *   "STADION_A"      → "STADION_A"
 *   "KUNSTRASEN_2_A" → "KUNSTRASEN_2_A"
 *   "kr2-a"          → "KR2_A"
 *   "Feld A"         → "FELD_A"
 *   ""               → null
 *
 * Ordering (stable):
 *   Primary:   sortOrder ascending
 *   Secondary: name ascending (locale-insensitive, case-insensitive)
 *   Tertiary:  id ascending (guarantees full determinism)
 */

import type { Screen2DisplayResource } from "./screen2-types";

// ── Raw DB row shape ──────────────────────────────────────────────────────────

/**
 * Raw FacilityResource row as returned by the DB query.
 * Includes the parent facility name for display purposes.
 */
export type Screen2FacilityResourceRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly facilityId: string;
  readonly name: string;
  readonly code: string;
  /** FacilityResourceType as a string (avoids Prisma enum import). */
  readonly type: string;
  /** FacilityStatus as a string (avoids Prisma enum import). */
  readonly status: string;
  readonly sortOrder: number;
  readonly facility: {
    readonly id: string;
    readonly name: string;
  };
};

// ── Constants ─────────────────────────────────────────────────────────────────

const EXCLUDED_RESOURCE_TYPES = new Set(["DRESSING_ROOM"]);
const EXCLUDED_STATUSES = new Set(["ARCHIVED", "INACTIVE"]);

// ── normalizeMapKey ────────────────────────────────────────────────────────────

/**
 * Derives a stable, deterministic map-placement key from a FacilityResource code.
 *
 * The key is safe for use as a CSS class suffix or data attribute.
 * Returns null when the code normalizes to an empty string.
 *
 * @pure — no side effects, no mutation, deterministic.
 */
export function normalizeMapKey(code: string): string | null {
  const normalized = code
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : null;
}

// ── normalizeScreen2Resources ─────────────────────────────────────────────────

/**
 * Normalizes raw FacilityResource rows into ordered Screen2DisplayResource entries.
 *
 * Filtering:
 *   - Removes DRESSING_ROOM resources (not displayed as map fields).
 *   - Removes ARCHIVED and INACTIVE resources.
 *
 * Map key:
 *   - Derived via normalizeMapKey(row.code).
 *
 * Ordering:
 *   - sortOrder ascending → name ascending (locale-insensitive) → id ascending.
 *
 * @param rows — Raw DB rows. May be empty; never mutated.
 * @returns A new, ordered array of Screen2DisplayResource. Empty when no rows survive filtering.
 */
export function normalizeScreen2Resources(
  rows: readonly Screen2FacilityResourceRow[],
): Screen2DisplayResource[] {
  const filtered = rows.filter(
    (row) =>
      !EXCLUDED_RESOURCE_TYPES.has(row.type) &&
      !EXCLUDED_STATUSES.has(row.status),
  );

  const sorted = [...filtered].sort((a, b) => {
    // Primary: sortOrder ascending
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    // Secondary: name ascending (case-insensitive for stability)
    const nameCompare = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (nameCompare !== 0) return nameCompare;
    // Tertiary: id ascending (guarantees full determinism)
    return a.id.localeCompare(b.id);
  });

  return sorted.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    facilityId: row.facilityId,
    facilityName: row.facility.name,
    name: row.name,
    code: row.code,
    resourceType: row.type,
    sortOrder: row.sortOrder,
    mapKey: normalizeMapKey(row.code),
  }));
}

// ── buildResourcesByCode ───────────────────────────────────────────────────────

/**
 * Builds a lookup map from FacilityResource.code → Screen2DisplayResource.
 *
 * Used by the event mapper and occupancy resolver to match event pitchCode
 * values to display resources.
 *
 * @param resources — Normalized display resources (output of normalizeScreen2Resources).
 * @returns A new Map. Empty when resources is empty.
 */
export function buildResourcesByCode(
  resources: readonly Screen2DisplayResource[],
): Map<string, Screen2DisplayResource> {
  const map = new Map<string, Screen2DisplayResource>();
  for (const resource of resources) {
    if (resource.code && !map.has(resource.code)) {
      map.set(resource.code, resource);
    }
  }
  return map;
}

// ── buildHalfPitchResourcesByFacilityId ───────────────────────────────────────

/**
 * Builds a lookup map from Facility.id → list of HALF_PITCH Screen2DisplayResource.
 *
 * Used by the event mapper to expand FULL_PITCH assignments to sibling
 * HALF_PITCH sub-fields within the same facility.
 *
 * Expansion via this map is the only supported full-pitch-to-sub-field expansion
 * in PP-03A. The FacilityResource model has no parentId hierarchy; expansion
 * is determined by resourceType and facilityId instead.
 *
 * @param resources — All normalized display resources for the tenant.
 * @returns A new Map. Facilities with no HALF_PITCH resources are not included.
 */
export function buildHalfPitchResourcesByFacilityId(
  resources: readonly Screen2DisplayResource[],
): Map<string, Screen2DisplayResource[]> {
  const map = new Map<string, Screen2DisplayResource[]>();
  for (const resource of resources) {
    if (resource.resourceType === "HALF_PITCH") {
      const existing = map.get(resource.facilityId);
      if (existing) {
        existing.push(resource);
      } else {
        map.set(resource.facilityId, [resource]);
      }
    }
  }
  return map;
}
